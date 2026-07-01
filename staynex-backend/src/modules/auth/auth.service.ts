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
import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { prisma } from "../../../db";
import type { AppCapability, AuthUser } from "../../../types";
import { EmailService } from "../notifications/email.service";
import type {
  AdminRegisterInput,
  CompleteMfaInput,
  LoginInput,
  OwnerRegisterInput,
  RegisterInput,
} from "./dto";
import { hashPassword, verifyPassword } from "./password";

export const SESSION_COOKIE = "staynex_session";
export const SESSION_TTL_MS = readPositiveIntEnv(
  "SESSION_TTL_MS",
  1000 * 60 * 60 * 24 * 30 * 6,
); // ~6 months
export const ADMIN_SESSION_TTL_MS = readPositiveIntEnv(
  "ADMIN_SESSION_TTL_MS",
  1000 * 60 * 60 * 12,
); // 12 hours
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour, single-use
const MFA_CODE_TTL_MS = 1000 * 60 * 10; // 10 minutes, single-use
const MFA_MAX_ATTEMPTS = 5;

// In-memory rate limiter for admin access-code attempts (POC; resets on restart).
const ADMIN_CODE_WINDOW_MS = 15 * 60_000;
const ADMIN_CODE_MAX_ATTEMPTS = 5;

// Include used to attach capability grants when materializing an AuthUser.
const USER_CAPS_INCLUDE = {
  capabilities: { select: { capability: true } },
} as const;

interface AuthResult {
  user: AuthUser;
  token: string;
  expiresAt: Date;
}

interface MfaRequiredResult {
  mfaRequired: true;
  challengeId: string;
  email: string;
  expiresAt: Date;
}

export type AuthFlowResult = AuthResult | MfaRequiredResult;

export interface SessionSummary {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

type PasswordRegistrationInput = {
  email: string;
  password: string;
  name?: string;
  phone: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly adminAttempts = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(private readonly email: EmailService) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const role = (input.role ?? input.roleIntent ?? "GUEST") as UserRole;
    return this.createUserAndSession(input, role);
  }

  /** Owner-intent registration. Same internal auth service; OWNER is forced. */
  async registerOwner(input: OwnerRegisterInput): Promise<AuthResult> {
    return this.createUserAndSession(input, UserRole.OWNER);
  }

  async adminRegister(
    input: AdminRegisterInput,
    ip: string,
  ): Promise<AuthFlowResult> {
    const codes = this.adminAccessCodes();
    this.assertAdminCodeRate(ip);
    const role = this.roleFromAdminAccessCode(input.accessCode, codes);
    this.adminAttempts.delete(ip); // success clears the counter
    const userId = await this.createUser(input, role);
    if (role === UserRole.ADMIN_MANAGER) return this.issueMfaChallenge(userId);
    return this.startSession(userId, { revokeExisting: true });
  }

  async login(input: LoginInput): Promise<AuthFlowResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const authUser = await this.loadAuthUser(user.id);
    if (requiresAdminMfa(authUser)) return this.issueMfaChallenge(user.id);
    return this.startSession(user.id, { revokeExisting: true });
  }

  async logout(token: string | null): Promise<void> {
    if (token) {
      await prisma.session.deleteMany({
        where: { token: { in: sessionTokenCandidates(token) } },
      });
    }
  }

  /**
   * Verify a Google ID token, link or create the user, and start a session.
   * Owner-intent upgrades the (new or existing) user to owner — no duplicate
   * account is created. We verify via Google's tokeninfo endpoint and check
   * `aud` matches our client id. No Google tokens are stored.
   */
  async googleSignIn(
    idToken: string,
    intent?: "GUEST" | "OWNER",
  ): Promise<AuthResult> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId)
      throw new ServiceUnavailableException("Google sign-in is not configured");

    let payload: {
      aud?: string;
      email?: string;
      email_verified?: string;
      name?: string;
    } | null = null;
    try {
      const res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );
      if (res.ok) payload = await res.json();
    } catch {
      payload = null;
    }

    if (
      !payload ||
      payload.aud !== clientId ||
      !payload.email ||
      payload.email_verified !== "true"
    ) {
      throw new UnauthorizedException("Could not verify Google sign-in");
    }

    const email = payload.email.toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    const userId = existing
      ? existing.id
      : (
          await prisma.user.create({
            data: { email, name: payload.name ?? null, role: UserRole.GUEST },
          })
        ).id;

    const authUser = await this.loadAuthUser(userId);
    if (requiresAdminMfa(authUser)) {
      throw new UnauthorizedException(
        "Admin managers must use staff sign-in and verification",
      );
    }

    if (intent === "OWNER") await this.grantOwnerCapability(userId);
    return this.startSession(userId, { revokeExisting: true });
  }

  /**
   * Add OWNER capability to an existing user (guest -> owner upgrade path).
   * Idempotent; bumps the compat `role` mirror to OWNER only for a plain guest.
   */
  async grantOwnerCapability(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new UnauthorizedException("Sign in required");
    await prisma.$transaction(async (tx) => {
      await tx.userCapability.upsert({
        where: {
          userId_capability: { userId, capability: PrismaCapability.OWNER },
        },
        update: {},
        create: { userId, capability: PrismaCapability.OWNER },
      });
      if (user.role === UserRole.GUEST) {
        await tx.user.update({
          where: { id: userId },
          data: { role: UserRole.OWNER },
        });
      }
    });
    return this.loadAuthUser(userId);
  }

  async grantOwnerCapabilityAndRotateSession(
    userId: string,
  ): Promise<AuthResult> {
    await this.grantOwnerCapability(userId);
    return this.startSession(userId, { revokeExisting: true });
  }

  /** Update the signed-in user's profile (name, email, phone). */
  async updateProfile(
    user: AuthUser,
    input: { name?: string; email?: string; phone?: string | null },
  ): Promise<AuthUser> {
    const exists = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true },
    });
    if (!exists)
      throw new ForbiddenException("Profile isn't editable for this session");

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
    const exists = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true },
    });
    if (!exists)
      throw new ForbiddenException("Account can't be deleted for this session");
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
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });
      await this.sendResetEmail(user.email, user.name, rawToken);
    }
    return { ok: true };
  }

  /** Complete password recovery with a single-use, unexpired token. */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    const tokenHash = sha256(token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(
        "This reset link is invalid or has expired",
      );
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: hashPassword(newPassword) },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate existing sessions so a reset always re-authenticates.
      prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);
    return { ok: true };
  }

  async completeMfa(input: CompleteMfaInput): Promise<AuthResult> {
    const challenge = await prisma.mfaChallenge.findUnique({
      where: { id: input.challengeId },
      include: { user: { include: USER_CAPS_INCLUDE } },
    });
    if (
      !challenge ||
      challenge.usedAt ||
      challenge.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException(
        "Verification code is invalid or has expired",
      );
    }
    if (challenge.attempts >= MFA_MAX_ATTEMPTS) {
      throw new UnauthorizedException(
        "Verification code is invalid or has expired",
      );
    }
    if (!verifyPassword(input.code, challenge.codeHash)) {
      await prisma.mfaChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException(
        "Verification code is invalid or has expired",
      );
    }

    const authUser = toAuthUser(challenge.user);
    if (!requiresAdminMfa(authUser)) {
      throw new UnauthorizedException(
        "Verification code is invalid or has expired",
      );
    }

    const claimed = await prisma.mfaChallenge.updateMany({
      where: { id: challenge.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new UnauthorizedException(
        "Verification code is invalid or has expired",
      );
    }
    return this.startSession(challenge.userId, { revokeExisting: true });
  }

  // --- Session resolution & guards -----------------------------------------

  /** Resolve the current principal from the session cookie. Session-only. */
  async resolve(cookieHeader?: string): Promise<AuthUser | null> {
    const token = readCookie(cookieHeader, SESSION_COOKIE);
    if (!token) return null;
    const session = await this.findSessionByRawToken(token);
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    return toAuthUser(session.user);
  }

  async listSessions(
    user: AuthUser,
    currentToken: string | null,
  ): Promise<SessionSummary[]> {
    const now = new Date();
    const sessions = await prisma.session.findMany({
      where: { userId: user.id, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      select: { id: true, token: true, createdAt: true, expiresAt: true },
    });
    const candidates = currentToken
      ? new Set(sessionTokenCandidates(currentToken))
      : new Set<string>();
    return sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: candidates.has(session.token),
    }));
  }

  async revokeOtherSessions(
    user: AuthUser,
    currentToken: string | null,
  ): Promise<{ revoked: number }> {
    const keep = currentToken ? sessionTokenCandidates(currentToken) : [];
    const result = await prisma.session.deleteMany({
      where: {
        userId: user.id,
        ...(keep.length ? { token: { notIn: keep } } : {}),
      },
    });
    return { revoked: result.count };
  }

  // --- internals -----------------------------------------------------------

  private async createUserAndSession(
    input: PasswordRegistrationInput,
    role: UserRole,
  ): Promise<AuthResult> {
    const userId = await this.createUser(input, role);
    return this.startSession(userId, { revokeExisting: true });
  }

  private async createUser(
    input: PasswordRegistrationInput,
    role: UserRole,
  ): Promise<string> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException("An account with this email already exists");

    const grants = capabilityGrantsForRole(role);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name ?? null,
        phone: input.phone,
        passwordHash: hashPassword(input.password),
        role,
        ...(grants.length ? { capabilities: { create: grants } } : {}),
      },
    });
    return user.id;
  }

  private async startSession(
    userId: string,
    options: { revokeExisting?: boolean } = {},
  ): Promise<AuthResult> {
    const user = await this.loadAuthUser(userId);
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + sessionTtlMs(user));
    await prisma.$transaction(async (tx) => {
      if (options.revokeExisting)
        await tx.session.deleteMany({ where: { userId } });
      await tx.session.create({
        data: { userId, token: sessionTokenHash(token), expiresAt },
      });
    });
    return { user, token, expiresAt };
  }

  private async loadAuthUser(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: USER_CAPS_INCLUDE,
    });
    if (!user) throw new UnauthorizedException("Account not found");
    return toAuthUser(user);
  }

  private async findSessionByRawToken(rawToken: string) {
    const tokenHash = sessionTokenHash(rawToken);
    const include = { user: { include: USER_CAPS_INCLUDE } } as const;
    const hashed = await prisma.session.findUnique({
      where: { token: tokenHash },
      include,
    });
    if (hashed) return hashed;

    const legacy = await prisma.session.findUnique({
      where: { token: rawToken },
      include,
    });
    if (!legacy) return null;
    if (legacy.expiresAt.getTime() > Date.now()) {
      await prisma.session
        .update({ where: { id: legacy.id }, data: { token: tokenHash } })
        .catch(() => {});
    }
    return legacy;
  }

  private async issueMfaChallenge(userId: string): Promise<MfaRequiredResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user?.email)
      throw new UnauthorizedException(
        "This account cannot receive verification codes",
      );

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const expiresAt = new Date(Date.now() + MFA_CODE_TTL_MS);
    await prisma.mfaChallenge.deleteMany({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    });
    const challenge = await prisma.mfaChallenge.create({
      data: { userId, codeHash: hashPassword(code), expiresAt },
      select: { id: true },
    });
    await this.sendMfaEmail(user.email, user.name, code);
    return {
      mfaRequired: true,
      challengeId: challenge.id,
      email: user.email,
      expiresAt,
    };
  }

  private async sendResetEmail(
    email: string,
    name: string | null,
    rawToken: string,
  ): Promise<void> {
    const base = (
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");
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

  private async sendMfaEmail(
    email: string,
    name: string | null,
    code: string,
  ): Promise<void> {
    if (this.email.isConfigured()) {
      const greeting = name ? `Hi ${name},` : "Hi,";
      await this.email.send({
        to: email,
        subject: "Your Staynex admin verification code",
        html: `<p>${greeting}</p><p>Use this code to finish signing in to Staynex Admin. It expires in 10 minutes.</p><p><strong>${code}</strong></p><p>If you didn't request this, reset your password and contact platform support.</p>`,
        text: `${greeting}\n\nUse this code to finish signing in to Staynex Admin. It expires in 10 minutes:\n${code}\n\nIf you didn't request this, reset your password and contact platform support.`,
      });
    } else if (process.env.NODE_ENV !== "production") {
      this.logger.warn(`Admin MFA code (dev only) for ${email}: ${code}`);
    } else {
      throw new ServiceUnavailableException(
        "Admin verification email is not configured",
      );
    }
  }

  private assertAdminCodeRate(ip: string): void {
    const now = Date.now();
    const entry = this.adminAttempts.get(ip);
    if (!entry || entry.resetAt < now) {
      this.adminAttempts.set(ip, {
        count: 1,
        resetAt: now + ADMIN_CODE_WINDOW_MS,
      });
      return;
    }
    if (entry.count >= ADMIN_CODE_MAX_ATTEMPTS) {
      throw new HttpException(
        "Too many attempts. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    entry.count += 1;
  }

  private adminAccessCodes(): { reviewerCode: string; managerCode: string } {
    const reviewerCode = process.env.ADMIN_REVIEWER_ACCESS_CODE;
    const managerCode = process.env.ADMIN_MANAGER_ACCESS_CODE;
    if (!reviewerCode || !managerCode || reviewerCode === managerCode) {
      throw new ServiceUnavailableException(
        "Admin registration is not configured",
      );
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

function sessionTokenHash(rawToken: string): string {
  return sha256(rawToken);
}

function sessionTokenCandidates(rawToken: string): string[] {
  const hashed = sessionTokenHash(rawToken);
  return hashed === rawToken ? [hashed] : [hashed, rawToken];
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sessionTtlMs(user: AuthUser): number {
  return isAdminCapable(user) ? ADMIN_SESSION_TTL_MS : SESSION_TTL_MS;
}

function isAdminCapable(user: AuthUser): boolean {
  return (
    user.capabilities.includes("ADMIN_REVIEWER") ||
    user.capabilities.includes("ADMIN_MANAGER")
  );
}

function requiresAdminMfa(user: AuthUser): boolean {
  return user.capabilities.includes("ADMIN_MANAGER");
}

/** Capability grants implied by a role at creation time (guest grants nothing). */
function capabilityGrantsForRole(
  role: UserRole,
): { capability: PrismaCapability }[] {
  if (role === UserRole.OWNER) return [{ capability: PrismaCapability.OWNER }];
  if (role === UserRole.ADMIN_REVIEWER)
    return [{ capability: PrismaCapability.ADMIN_REVIEWER }];
  if (role === UserRole.ADMIN_MANAGER)
    return [{ capability: PrismaCapability.ADMIN_MANAGER }];
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
export function readCookie(
  header: string | undefined,
  name: string,
): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name)
      return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}
