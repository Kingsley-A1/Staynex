import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { AppCapability as PrismaCapability, UserRole } from "@prisma/client";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../../../db";
import type { AppCapability, AuthUser } from "../../../types";
import { EmailService } from "../notifications/email.service";
import type { AdminRegisterInput, LoginInput, RegisterInput } from "./dto";
import { hashPassword, verifyPassword } from "./password";

export const SESSION_COOKIE = "staynex_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 * 6; // ~6 months
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour, single-use

// In-memory rate limiter for admin access-code attempts (POC; resets on restart).
const ADMIN_CODE_WINDOW_MS = 15 * 60_000;
const ADMIN_CODE_MAX_ATTEMPTS = 5;

// Include used to attach capability grants when materializing an AuthUser.
const USER_CAPS_INCLUDE = { capabilities: { select: { capability: true } } } as const;

interface AuthResult {
  user: AuthUser;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly adminAttempts = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly email: EmailService) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const role = (input.role ?? input.roleIntent ?? "GUEST") as UserRole;
    return this.createUserAndSession(input, role);
  }

  /** Owner-intent registration. Same internal auth service; OWNER is forced. */
  async registerOwner(input: { email: string; password: string; name?: string }): Promise<AuthResult> {
    return this.createUserAndSession(input, UserRole.OWNER);
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
    return this.startSession(user.id);
  }

  async logout(token: string | null): Promise<void> {
    if (token) await prisma.session.deleteMany({ where: { token } });
  }

  /**
   * Verify a Google ID token, link or create the user, and start a session.
   * Owner-intent upgrades the (new or existing) user to owner — no duplicate
   * account is created. We verify via Google's tokeninfo endpoint and check
   * `aud` matches our client id. No Google tokens are stored.
   */
  async googleSignIn(idToken: string, intent?: "GUEST" | "OWNER"): Promise<AuthResult> {
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
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    const userId = existing
      ? existing.id
      : (await prisma.user.create({ data: { email, name: payload.name ?? null, role: UserRole.GUEST } })).id;

    if (intent === "OWNER") await this.grantOwnerCapability(userId);
    return this.startSession(userId);
  }

  /**
   * Add OWNER capability to an existing user (guest -> owner upgrade path).
   * Idempotent; bumps the compat `role` mirror to OWNER only for a plain guest.
   */
  async grantOwnerCapability(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!user) throw new UnauthorizedException("Sign in required");
    await prisma.$transaction(async (tx) => {
      await tx.userCapability.upsert({
        where: { userId_capability: { userId, capability: PrismaCapability.OWNER } },
        update: {},
        create: { userId, capability: PrismaCapability.OWNER },
      });
      if (user.role === UserRole.GUEST) {
        await tx.user.update({ where: { id: userId }, data: { role: UserRole.OWNER } });
      }
    });
    return this.loadAuthUser(userId);
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
      include: USER_CAPS_INCLUDE,
    });
    return toAuthUser(updated);
  }

  /** Delete the signed-in user's account (cascades sessions, profiles, grants). */
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

  // --- Password recovery ----------------------------------------------------

  /**
   * Begin password recovery. Always returns a generic success so the response
   * never reveals whether an email is registered (no account enumeration).
   */
  async forgotPassword(email: string): Promise<{ ok: true }> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });
    if (user?.email) {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = sha256(rawToken);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      // One outstanding token at a time: drop previous unused ones first.
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
      await this.sendResetEmail(user.email, user.name, rawToken);
    }
    return { ok: true };
  }

  /** Complete password recovery with a single-use, unexpired token. */
  async resetPassword(token: string, newPassword: string): Promise<{ ok: true }> {
    const tokenHash = sha256(token);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("This reset link is invalid or has expired");
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: hashPassword(newPassword) },
      }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Invalidate existing sessions so a reset always re-authenticates.
      prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);
    return { ok: true };
  }

  // --- Session resolution & guards -----------------------------------------

  /** Resolve the current principal from the session cookie. Session-only. */
  async resolve(cookieHeader?: string): Promise<AuthUser | null> {
    const token = readCookie(cookieHeader, SESSION_COOKIE);
    if (!token) return null;
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: { include: USER_CAPS_INCLUDE } },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    return toAuthUser(session.user);
  }

  async requireUser(cookieHeader?: string): Promise<AuthUser> {
    const user = await this.resolve(cookieHeader);
    if (!user) throw new UnauthorizedException("Sign in required");
    return user;
  }

  /** Any admin-capable user (reviewer or manager). */
  async requireAdmin(cookieHeader?: string): Promise<AuthUser> {
    const user = await this.requireUser(cookieHeader);
    if (!user.capabilities.includes("ADMIN_REVIEWER") && !user.capabilities.includes("ADMIN_MANAGER")) {
      throw new ForbiddenException("Admin access required");
    }
    return user;
  }

  /** Super Admin only — sensitive operations (e.g. revealing payout details). */
  async requireAdminManager(cookieHeader?: string): Promise<AuthUser> {
    const user = await this.requireUser(cookieHeader);
    if (!user.capabilities.includes("ADMIN_MANAGER")) {
      throw new ForbiddenException("Super Admin access required");
    }
    return user;
  }

  /** Any owner-capable user. */
  async requireOwner(cookieHeader?: string): Promise<AuthUser> {
    const user = await this.requireUser(cookieHeader);
    if (!user.capabilities.includes("OWNER")) {
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

    const grants = capabilityGrantsForRole(role);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name ?? null,
        passwordHash: hashPassword(input.password),
        role,
        ...(grants.length ? { capabilities: { create: grants } } : {}),
      },
    });
    return this.startSession(user.id);
  }

  private async startSession(userId: string): Promise<AuthResult> {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.session.create({ data: { userId, token, expiresAt } });
    return { user: await this.loadAuthUser(userId), token, expiresAt };
  }

  private async loadAuthUser(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: USER_CAPS_INCLUDE });
    if (!user) throw new UnauthorizedException("Account not found");
    return toAuthUser(user);
  }

  private async sendResetEmail(email: string, name: string | null, rawToken: string): Promise<void> {
    const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
    const url = `${base}/reset-password?token=${rawToken}`;
    if (this.email.isConfigured()) {
      const greeting = name ? `Hi ${name},` : "Hi,";
      await this.email.send({
        to: email,
        subject: "Reset your Staynex password",
        html: `<p>${greeting}</p><p>We received a request to reset your Staynex password. This link expires in 1 hour and can be used once.</p><p><a href="${url}">Reset your password</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
        text: `${greeting}\n\nReset your Staynex password (expires in 1 hour, single use):\n${url}\n\nIf you didn't request this, ignore this email.`,
      });
    } else if (process.env.NODE_ENV !== "production") {
      // Dev-safe: no email provider configured, so surface the link in logs only.
      this.logger.warn(`Password reset link (dev only) for ${email}: ${url}`);
    }
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

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Capability grants implied by a role at creation time (guest grants nothing). */
function capabilityGrantsForRole(role: UserRole): { capability: PrismaCapability }[] {
  if (role === UserRole.OWNER) return [{ capability: PrismaCapability.OWNER }];
  if (role === UserRole.ADMIN_REVIEWER) return [{ capability: PrismaCapability.ADMIN_REVIEWER }];
  if (role === UserRole.ADMIN_MANAGER) return [{ capability: PrismaCapability.ADMIN_MANAGER }];
  return [];
}

/** Derive the capability set. GUEST is implicit for every signed-in user. */
export function deriveCapabilities(
  role: UserRole,
  grants: { capability: PrismaCapability }[],
): AppCapability[] {
  const caps = new Set<AppCapability>(["GUEST"]);
  if (role === UserRole.OWNER) caps.add("OWNER");
  if (role === UserRole.ADMIN_REVIEWER) caps.add("ADMIN_REVIEWER");
  if (role === UserRole.ADMIN_MANAGER) caps.add("ADMIN_MANAGER");
  for (const g of grants) caps.add(g.capability as AppCapability);
  return [...caps];
}

function toAuthUser(user: {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: UserRole;
  capabilities?: { capability: PrismaCapability }[];
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    capabilities: deriveCapabilities(user.role, user.capabilities ?? []),
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
