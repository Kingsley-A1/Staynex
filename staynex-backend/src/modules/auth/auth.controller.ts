import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Patch,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "../../../types";
import { parseBody } from "../../common/http";
import { RateLimit } from "../../common/rate-limit.guard";
import { CSRF_COOKIE } from "../../common/security";
import { CurrentUser, SessionGuard } from "./access-control";
import {
  AuthService,
  SESSION_COOKIE,
  readCookie,
  type AuthFlowResult,
} from "./auth.service";
import {
  clearCookieOptions,
  type CookieResponse,
  setCsrfCookie,
  setSessionCookie,
} from "./cookies";
import {
  adminRegisterSchema,
  completeMfaSchema,
  forgotPasswordSchema,
  googleSchema,
  loginSchema,
  ownerRegisterSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "./dto";

const AUTH_WINDOW_MS = 15 * 60_000;
const MUTATION_WINDOW_MS = 60_000;

function completeAuth(res: CookieResponse, result: AuthFlowResult) {
  if ("mfaRequired" in result) {
    return {
      ...result,
      expiresAt: result.expiresAt.toISOString(),
    };
  }
  setSessionCookie(res, result.token, result.expiresAt);
  return result.user;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get("csrf")
  csrf(@Res({ passthrough: true }) res: CookieResponse) {
    return { csrfToken: setCsrfCookie(res) };
  }

  @Post("register")
  @RateLimit({
    bucket: "auth:register",
    limit: 6,
    windowMs: AUTH_WINDOW_MS,
    keyBy: ["ip", "email"],
  })
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    const result = await this.auth.register(parseBody(registerSchema, body));
    setSessionCookie(res, result.token, result.expiresAt);
    return result.user;
  }

  @Post("host/register")
  @RateLimit({
    bucket: "auth:host-register",
    limit: 6,
    windowMs: AUTH_WINDOW_MS,
    keyBy: ["ip", "email"],
  })
  async ownerRegister(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    const result = await this.auth.registerOwner(
      parseBody(ownerRegisterSchema, body),
    );
    setSessionCookie(res, result.token, result.expiresAt);
    return result.user;
  }

  @Post("admin/register")
  @RateLimit({
    bucket: "auth:admin-register",
    limit: 3,
    windowMs: AUTH_WINDOW_MS,
    keyBy: ["ip", "email"],
    message: "Too many admin registration attempts. Please try again later.",
  })
  async adminRegister(
    @Body() body: unknown,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    const result = await this.auth.adminRegister(
      parseBody(adminRegisterSchema, body),
      ip,
    );
    return completeAuth(res, result);
  }

  @Post("login")
  @RateLimit({
    bucket: "auth:login",
    limit: 8,
    windowMs: AUTH_WINDOW_MS,
    keyBy: ["ip", "email"],
  })
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    const result = await this.auth.login(parseBody(loginSchema, body));
    return completeAuth(res, result);
  }

  @Post("mfa/complete")
  @RateLimit({
    bucket: "auth:mfa",
    limit: 5,
    windowMs: AUTH_WINDOW_MS,
    keyBy: ["ip"],
    message: "Too many verification attempts. Please wait and try again.",
  })
  async completeMfa(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    const result = await this.auth.completeMfa(
      parseBody(completeMfaSchema, body),
    );
    setSessionCookie(res, result.token, result.expiresAt);
    return result.user;
  }

  @Post("google")
  @RateLimit({
    bucket: "auth:google",
    limit: 12,
    windowMs: AUTH_WINDOW_MS,
    keyBy: ["ip"],
  })
  async google(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    const input = parseBody(googleSchema, body);
    const result = await this.auth.googleSignIn(input.idToken, input.intent);
    setSessionCookie(res, result.token, result.expiresAt);
    return result.user;
  }

  @Post("password/forgot")
  @RateLimit({
    bucket: "auth:forgot-password",
    limit: 5,
    windowMs: AUTH_WINDOW_MS,
    keyBy: ["ip", "email"],
  })
  async forgotPassword(@Body() body: unknown) {
    // Always returns a generic success (no account enumeration).
    return this.auth.forgotPassword(
      parseBody(forgotPasswordSchema, body).email,
    );
  }

  @Post("password/reset")
  @RateLimit({
    bucket: "auth:reset-password",
    limit: 5,
    windowMs: AUTH_WINDOW_MS,
    keyBy: ["ip"],
  })
  async resetPassword(@Body() body: unknown) {
    const input = parseBody(resetPasswordSchema, body);
    return this.auth.resetPassword(input.token, input.password);
  }

  @Patch("profile")
  @UseGuards(SessionGuard)
  @RateLimit({
    bucket: "auth:profile",
    limit: 20,
    windowMs: MUTATION_WINDOW_MS,
    keyBy: ["user"],
  })
  async updateProfile(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.auth.updateProfile(user, parseBody(updateProfileSchema, body));
  }

  @Delete("profile")
  @UseGuards(SessionGuard)
  @RateLimit({
    bucket: "auth:delete-profile",
    limit: 3,
    windowMs: AUTH_WINDOW_MS,
    keyBy: ["user"],
  })
  async deleteProfile(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    const result = await this.auth.deleteAccount(user);
    res.clearCookie(SESSION_COOKIE, clearCookieOptions());
    res.clearCookie(CSRF_COOKIE, clearCookieOptions());
    return result;
  }

  @Post("logout")
  @RateLimit({
    bucket: "auth:logout",
    limit: 30,
    windowMs: MUTATION_WINDOW_MS,
    keyBy: ["ip"],
  })
  async logout(
    @Headers("cookie") cookie: string | undefined,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    await this.auth.logout(readCookie(cookie, SESSION_COOKIE));
    res.clearCookie(SESSION_COOKIE, clearCookieOptions());
    res.clearCookie(CSRF_COOKIE, clearCookieOptions());
    return { ok: true };
  }

  @Get("sessions")
  @UseGuards(SessionGuard)
  sessions(
    @Headers("cookie") cookie: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.auth.listSessions(user, readCookie(cookie, SESSION_COOKIE));
  }

  @Post("sessions/revoke-others")
  @UseGuards(SessionGuard)
  @RateLimit({
    bucket: "auth:revoke-sessions",
    limit: 10,
    windowMs: MUTATION_WINDOW_MS,
    keyBy: ["user"],
  })
  revokeOtherSessions(
    @Headers("cookie") cookie: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.auth.revokeOtherSessions(
      user,
      readCookie(cookie, SESSION_COOKIE),
    );
  }

  @Get("me")
  me(@Headers("cookie") cookie: string | undefined) {
    return this.auth.resolve(cookie);
  }
}
