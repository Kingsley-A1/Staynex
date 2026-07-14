import { createCsrfToken, CSRF_COOKIE } from "../../common/security";
import { SESSION_COOKIE, SESSION_TTL_MS } from "./auth.service";

// Minimal structural type so we can set cookies without an @types/express dep.
export interface CookieResponse {
  cookie(
    name: string,
    value: string,
    options: Record<string, unknown>,
  ): unknown;
  clearCookie(name: string, options?: Record<string, unknown>): unknown;
}

function baseCookieOptions(maxAge: number) {
  const production = process.env.NODE_ENV === "production";
  return {
    sameSite: production ? ("none" as const) : ("lax" as const),
    path: "/",
    secure: production,
    maxAge,
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}

export function clearCookieOptions() {
  return {
    path: "/",
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}

export function setSessionCookie(
  res: CookieResponse,
  token: string,
  expiresAt: Date,
): void {
  res.cookie(SESSION_COOKIE, token, {
    ...baseCookieOptions(Math.max(0, expiresAt.getTime() - Date.now())),
    httpOnly: true,
  });
}

export function setCsrfCookie(res: CookieResponse): string {
  const csrfToken = createCsrfToken();
  res.cookie(CSRF_COOKIE, csrfToken, {
    ...baseCookieOptions(SESSION_TTL_MS),
    httpOnly: false,
  });
  return csrfToken;
}
