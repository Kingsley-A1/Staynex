import { Body, Controller, Get, Headers, Ip, Post, Res } from "@nestjs/common";
import { parseBody } from "../../common/http";
import { AuthService, SESSION_COOKIE, SESSION_TTL_MS, readCookie } from "./auth.service";
import { adminRegisterSchema, loginSchema, registerSchema } from "./dto";

// Minimal structural type so we can set cookies without an @types/express dep.
interface CookieResponse {
  cookie(name: string, value: string, options: Record<string, unknown>): unknown;
  clearCookie(name: string, options?: Record<string, unknown>): unknown;
}

function cookieOptions() {
  const production = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: production ? "none" as const : "lax" as const,
    path: "/",
    secure: production,
    maxAge: SESSION_TTL_MS,
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}

function clearCookieOptions() {
  return {
    path: "/",
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: CookieResponse) {
    const result = await this.auth.register(parseBody(registerSchema, body));
    res.cookie(SESSION_COOKIE, result.token, cookieOptions());
    return result.user;
  }

  @Post("admin/register")
  async adminRegister(
    @Body() body: unknown,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    const result = await this.auth.adminRegister(parseBody(adminRegisterSchema, body), ip);
    res.cookie(SESSION_COOKIE, result.token, cookieOptions());
    return result.user;
  }

  @Post("login")
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: CookieResponse) {
    const result = await this.auth.login(parseBody(loginSchema, body));
    res.cookie(SESSION_COOKIE, result.token, cookieOptions());
    return result.user;
  }

  @Post("logout")
  async logout(
    @Headers("cookie") cookie: string | undefined,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    await this.auth.logout(readCookie(cookie, SESSION_COOKIE));
    res.clearCookie(SESSION_COOKIE, clearCookieOptions());
    return { ok: true };
  }

  @Get("me")
  me(
    @Headers("cookie") cookie: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
  ) {
    return this.auth.resolve(cookie, userId);
  }
}
