// Core HTTP client for the Staynex API.
//
// The frontend never touches Prisma or the database; every call goes over
// HTTP to the NestJS backend. This module owns URL resolution, CSRF handling,
// the error shape, and the single `request` helper. Endpoint groups live in
// sibling modules and are re-exported from ./index.

import { API_BASE, BROWSER_API_BASE } from "@/lib/api-base";
import type { AssistantRecovery } from "@/lib/types";

type RequestOptions = RequestInit;
const CSRF_COOKIE = "staynex_csrf";
const CSRF_HEADER = "X-CSRF-Token";
let csrfTokenCache: string | null = null;
let csrfTokenRequest: Promise<string | null> | null = null;

export function apiUrl(path: string): string {
  return `${typeof window === "undefined" ? API_BASE : BROWSER_API_BASE}${path}`;
}

function unsafeMethod(method: string | undefined): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes((method ?? "GET").toUpperCase());
}

function readBrowserCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix))
      return decodeURIComponent(trimmed.slice(prefix.length));
  }
  return null;
}

export async function csrfHeaderFor(
  method: string | undefined,
): Promise<Record<string, string>> {
  if (!unsafeMethod(method) || typeof window === "undefined") return {};

  let token = csrfTokenCache ?? readBrowserCookie(CSRF_COOKIE);
  if (!token) {
    csrfTokenRequest ??= fetch(apiUrl("/auth/csrf"), {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = (await res.json().catch(() => null)) as {
          csrfToken?: unknown;
        } | null;
        return typeof body?.csrfToken === "string"
          ? body.csrfToken
          : readBrowserCookie(CSRF_COOKIE);
      })
      .finally(() => {
        csrfTokenRequest = null;
      });
    token = await csrfTokenRequest;
  }

  csrfTokenCache = token;
  return token ? { [CSRF_HEADER]: token } : {};
}

function clearCsrfCache(path: string): void {
  if (path === "/auth/logout" || path === "/auth/profile")
    csrfTokenCache = null;
}

/**
 * Error thrown for non-2xx responses. `status` enables precise handling; the
 * message keeps the `Request failed: <status>` prefix (so existing
 * `message.includes("409")` checks still work) and appends the backend detail
 * after " — " when present, for user-facing messages.
 */
export class ApiError extends Error {
  status: number;
  detail: string | null;
  code: string | null;
  recovery: AssistantRecovery | null;
  requestId: string | null;
  retryAfterSeconds: number | null;
  constructor(
    status: number,
    statusText: string,
    detail: string | null,
    diagnostics: {
      code?: string | null;
      recovery?: AssistantRecovery | null;
      requestId?: string | null;
      retryAfterSeconds?: number | null;
    } = {},
  ) {
    super(
      `Request failed: ${status} ${statusText}${detail ? ` — ${detail}` : ""}`,
    );
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.code = diagnostics.code ?? null;
    this.recovery = diagnostics.recovery ?? null;
    this.requestId = diagnostics.requestId ?? null;
    this.retryAfterSeconds = diagnostics.retryAfterSeconds ?? null;
  }
}

/** Human-facing message for an error: the backend detail, else a fallback. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.detail) return err.detail;
  return fallback;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { headers, ...rest } = options;
  const csrfHeaders = await csrfHeaderFor(rest.method);
  const res = await fetch(apiUrl(path), {
    ...rest,
    // Send/receive the session cookie so auth-aware endpoints resolve the user.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...csrfHeaders,
      ...headers,
    },
  });
  if (!res.ok) {
    if (res.status === 403) csrfTokenCache = null;
    let detail: string | null = null;
    try {
      const data = (await res.json()) as {
        message?: unknown;
        issues?: Array<{ message?: string }>;
      };
      const issueDetail = Array.isArray(data.issues)
        ? data.issues
            .map((i) => i.message)
            .filter(Boolean)
            .join(", ")
        : "";
      if (issueDetail) detail = issueDetail;
      else if (typeof data.message === "string") detail = data.message;
      else if (Array.isArray(data.message)) detail = data.message.join(", ");
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, res.statusText, detail);
  }
  clearCsrfCache(path);
  return (await res.json()) as T;
}

// All host endpoints are authenticated by the session cookie (session-only auth).
