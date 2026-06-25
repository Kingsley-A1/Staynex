import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../../../db";
import type { AuthUser } from "../../../types";
import type { AdminRegisterInput, LoginInput, RegisterInput } from "./dto";
import { hashPassword, verifyPassword } from "./password";

export const SESSION_COOKIE = "staynex_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 * 6; // ~6 months

const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN_REVIEWER, UserRole.ADMIN_MANAGER];

// In-memory rate limiter for admin access-code attempts (POC; resets on restart).
const ADMIN_CODE_WINDOW_MS = 15 * 60_000;
const ADMIN_CODE_MAX_ATTEMPTS = 5;

interface AuthResult {
  user: AuthUser;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly adminAttempts = new Map<string, { count: number; resetAt: number }>();

  async register(input: RegisterInput): Promise<AuthResult> {
    return this.createUserAndSession(input, input.role as UserRole);
  }

  async adminRegister(input: AdminRegisterInput, ip: string): Promise<AuthResult> {
    const codes = this.adminAccessCodes();
    this.assertAdminCodeRate(ip);
    const role = this.roleFromAdminAccessCode(input.accessCode, codes);
    this.adminAttempts.delete(ip); // success clears the counter
    return this.createUserAndSession(input, role);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid email or password");
    }
    return this.startSession(user);
  }

  async logout(token: string | null): Promise<void> {
    if (token) await prisma.session.deleteMany({ where: { token } });
  }

  /**
   * Verify a Google ID token, link or create the user, and start a session.
   * We verify via Google's tokeninfo endpoint and check `aud` matches our client
   * id. No Google tokens are stored.
   */
  async googleSignIn(idToken: string): Promise<AuthResult> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new ServiceUnavailableException("Google sign-in is not configured");

    let payload: { aud?: string; email?: string; email_verified?: string; name?: string } | null = null;
    try {
      const res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );
      if (res.ok) payload = await res.json();
    } catch {
      payload = null;
    }

    if (!payload || payload.aud !== clientId || !payload.email || payload.email_verified !== "true") {
      throw new UnauthorizedException("Could not verify Google sign-in");
    }

    const email = payload.email.toLowerCase();
    const user =
      (await prisma.user.findUnique({ where: { email } })) ??
      (await prisma.user.create({
        data: { email, name: payload.name ?? null, role: UserRole.GUEST },
      }));
    return this.startSession(user);
  }

  /** Update the signed-in user's profile (name, email, phone). */
  async updateProfile(
    user: AuthUser,
    input: { name?: string; email?: string; phone?: string | null },
  ): Promise<AuthUser> {
    const exists = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } });
    if (!exists) throw new ForbiddenException("Profile isn't editable for this session");

    if (input.email) {
      const clash = await prisma.user.findFirst({
        where: { email: input.email, NOT: { id: user.id } },
        select: { id: true },
      });
      if (clash) throw new ConflictException("That email is already in use");
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
    });
    return toAuthUser(updated);
  }

  /** Delete the signed-in user's account (cascades sessions). */
  async deleteAccount(user: AuthUser): Promise<{ ok: true }> {
    const exists = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } });
    if (!exists) throw new ForbiddenException("Account can't be deleted for this session");
    try {
      await prisma.user.delete({ where: { id: user.id } });
    } catch {
      // e.g. an owner that still has properties referencing them.
      throw new ConflictException(
        "This account has linked records (such as properties) and can't be deleted yet.",
      );
    }
    return { ok: true };
  }

  /** Resolve the current principal from the session cookie. Session-only. */
  async resolve(cookieHeader?: string): Promise<AuthUser | null> {
    const token = readCookie(cookieHeader, SESSION_COOKIE);
    if (!token) return null;
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    return toAuthUser(session.user);
  }

  async requireUser(cookieHeader?: string): Promise<AuthUser> {
    const user = await this.resolve(cookieHeader);
    if (!user) throw new UnauthorizedException("Sign in required");
    return user;
  }

  async requireAdmin(cookieHeader?: string): Promise<AuthUser> {
    const user = await this.requireUser(cookieHeader);
    if (!ADMIN_ROLES.includes(user.role as UserRole)) {
      throw new ForbiddenException("Admin access required");
    }
    return user;
  }

  async requireOwner(cookieHeader?: string): Promise<AuthUser> {
    const user = await this.requireUser(cookieHeader);
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException("Owner access required");
    }
    return user;
  }

  // --- internals -----------------------------------------------------------

  private async createUserAndSession(
    input: { email: string; password: string; name?: string },
    role: UserRole,
  ): Promise<AuthResult> {
    const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw new ConflictException("An account with this email already exists");

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name ?? null,
        passwordHash: hashPassword(input.password),
        role,
      },
    });
    return this.startSession(user);
  }

  private async startSession(user: {
    id: string;
    email: string | null;
    name: string | null;
    phone: string | null;
    role: UserRole;
  }): Promise<AuthResult> {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.session.create({ data: { userId: user.id, token, expiresAt } });
    return { user: toAuthUser(user), token, expiresAt };
  }

  private assertAdminCodeRate(ip: string): void {
    const now = Date.now();
    const entry = this.adminAttempts.get(ip);
    if (!entry || entry.resetAt < now) {
      this.adminAttempts.set(ip, { count: 1, resetAt: now + ADMIN_CODE_WINDOW_MS });
      return;
    }
    if (entry.count >= ADMIN_CODE_MAX_ATTEMPTS) {
      throw new HttpException("Too many attempts. Try again later.", HttpStatus.TOO_MANY_REQUESTS);
    }
    entry.count += 1;
  }

  private adminAccessCodes(): { reviewerCode: string; managerCode: string } {
    const reviewerCode = process.env.ADMIN_REVIEWER_ACCESS_CODE;
    const managerCode = process.env.ADMIN_MANAGER_ACCESS_CODE;
    if (!reviewerCode || !managerCode || reviewerCode === managerCode) {
      throw new ServiceUnavailableException("Admin registration is not configured");
    }
    return { reviewerCode, managerCode };
  }

  private roleFromAdminAccessCode(
    accessCode: string,
    codes: { reviewerCode: string; managerCode: string },
  ): UserRole {
    const { reviewerCode, managerCode } = codes;
    if (safeEquals(accessCode, reviewerCode)) return UserRole.ADMIN_REVIEWER;
    if (safeEquals(accessCode, managerCode)) return UserRole.ADMIN_MANAGER;
    throw new ForbiddenException("Invalid admin access code");
  }
}

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function toAuthUser(user: {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: UserRole;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
  };
}

/** The audit actor is simply the authenticated user's id (session-only auth). */
export function auditActorId(user: AuthUser): string {
  return user.id;
}

/** Parse a single cookie value out of a raw `Cookie` header. */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}
