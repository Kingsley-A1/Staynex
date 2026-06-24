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
    const expected = process.env.ADMIN_ACCESS_CODE;
    if (!expected) {
      throw new ServiceUnavailableException("Admin registration is not configured");
    }
    this.assertAdminCodeRate(ip);
    const a = Buffer.from(input.accessCode);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException("Invalid admin access code");
    }
    this.adminAttempts.delete(ip); // success clears the counter
    return this.createUserAndSession(input, input.role as UserRole);
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
   * Resolve the current principal from the session cookie, falling back to the
   * legacy `x-user-id` header (demo stand-in) so existing dashboards keep working
   * during the auth transition.
   */
  async resolve(cookieHeader?: string, fallbackUserId?: string): Promise<AuthUser | null> {
    const token = readCookie(cookieHeader, SESSION_COOKIE);
    if (token) {
      const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
      if (session && session.expiresAt.getTime() > Date.now()) {
        return toAuthUser(session.user);
      }
    }

    const fallback = fallbackUserId?.trim();
    if (fallback) {
      const user = await prisma.user.findUnique({ where: { id: fallback } });
      if (user) return toAuthUser(user);
      // Synthetic demo principals (no row) — keep the POC dashboards usable.
      if (fallback === "demo-admin") return demoPrincipal(fallback, UserRole.ADMIN_MANAGER);
      if (fallback === "demo-reviewer") return demoPrincipal(fallback, UserRole.ADMIN_REVIEWER);
      if (fallback === "demo-owner") return demoPrincipal(fallback, UserRole.OWNER);
      return demoPrincipal(fallback, UserRole.GUEST);
    }
    return null;
  }

  async requireUser(cookieHeader?: string, fallbackUserId?: string): Promise<AuthUser> {
    const user = await this.resolve(cookieHeader, fallbackUserId);
    if (!user) throw new UnauthorizedException("Sign in required");
    return user;
  }

  async requireAdmin(cookieHeader?: string, fallbackUserId?: string): Promise<AuthUser> {
    const user = await this.requireUser(cookieHeader, fallbackUserId);
    if (!ADMIN_ROLES.includes(user.role as UserRole)) {
      throw new ForbiddenException("Admin access required");
    }
    return user;
  }

  async requireOwner(cookieHeader?: string, fallbackUserId?: string): Promise<AuthUser> {
    const user = await this.requireUser(cookieHeader, fallbackUserId);
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
}

function toAuthUser(user: {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
}): AuthUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

function demoPrincipal(id: string, role: UserRole): AuthUser {
  return { id, email: null, name: null, role };
}

export function auditActorId(user: AuthUser): string | null {
  return user.email === null && user.id.startsWith("demo-") ? null : user.id;
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
