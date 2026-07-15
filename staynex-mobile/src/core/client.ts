// Native fetch client for the Staynex API.
//
// Auth is session-cookie only (no bearer tokens). Browsers manage the cookie jar
// automatically; a native client does not, so this wrapper:
//   1. captures `staynex_session` from `Set-Cookie` on responses, and
//   2. replays it as a `Cookie:` header on every subsequent request,
// persisting the value in `expo-secure-store` so the session survives restarts.
//
// CSRF: the API guards every mutating route with a double-submit check — the
// `staynex_csrf` cookie must match the `x-csrf-token` header. This client mints
// a token from `GET /auth/csrf` once per launch and sends it as both, so the
// pair always matches by construction.

import * as SecureStore from "expo-secure-store";
import { API_BASE_URL, CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE } from "./env";

/** Thrown for any non-2xx response. `status` enables precise handling. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | null;
  constructor(status: number, statusText: string, detail: string | null) {
    super(`Request failed: ${status} ${statusText}${detail ? ` — ${detail}` : ""}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/** Human-facing message for an error: the backend detail, else a fallback. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.detail) return err.detail;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

async function readSessionCookie(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_COOKIE);
}

/** Clear the persisted session (used on logout / account delete). */
export async function clearSessionCookie(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_COOKIE);
}

// Capture/refresh the session cookie from a response's Set-Cookie header. Native
// runtimes (unlike browsers) expose Set-Cookie, which is the whole mechanism.
async function captureSessionCookie(res: Response): Promise<void> {
  const header = res.headers.get("set-cookie");
  if (!header) return;
  const match = header.match(new RegExp(`${SESSION_COOKIE}=([^;]*)`));
  if (!match) return;
  const value = match[1];
  // An empty value (e.g. on logout) means the server cleared the cookie.
  if (value) {
    await SecureStore.setItemAsync(SESSION_COOKIE, value);
  } else {
    await SecureStore.deleteItemAsync(SESSION_COOKIE);
  }
}

// --- CSRF (double-submit) -------------------------------------------------
// The token is not a server-side secret: the middleware only checks that the
// cookie and header values match. One token per app launch is sufficient; it
// is re-minted once if the server ever rejects it.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

let csrfToken: string | null = null;
let csrfInFlight: Promise<string> | null = null;

async function mintCsrfToken(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/auth/csrf`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new ApiError(res.status, res.statusText, "Couldn't initialise a secure session.");
  }
  const data = (await res.json()) as { csrfToken?: unknown };
  if (typeof data.csrfToken !== "string" || !data.csrfToken) {
    throw new ApiError(0, "Bad CSRF response", "Couldn't initialise a secure session.");
  }
  return data.csrfToken;
}

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfInFlight) {
    csrfInFlight = mintCsrfToken()
      .then((token) => {
        csrfToken = token;
        return token;
      })
      .finally(() => {
        csrfInFlight = null;
      });
  }
  return csrfInFlight;
}

function isCsrfRejection(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && /csrf/i.test(err.detail ?? "");
}

// ---------------------------------------------------------------------------

interface RequestOptions {
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  try {
    return await performRequest<T>(method, path, options);
  } catch (err) {
    // A stale/rejected CSRF token is recoverable: mint a fresh one and retry once.
    if (!isCsrfRejection(err)) throw err;
    csrfToken = null;
    return performRequest<T>(method, path, options);
  }
}

/**
 * The exact auth headers this client sends: session cookie replay + CSRF
 * double-submit on mutating methods. Exported so the SSE assistant client can
 * speak the identical wire protocol without duplicating it.
 */
export async function buildAuthHeaders(method: string): Promise<Record<string, string>> {
  const cookie = await readSessionCookie();
  const headers: Record<string, string> = {};
  const cookies: string[] = [];
  if (cookie) cookies.push(`${SESSION_COOKIE}=${cookie}`);
  if (!SAFE_METHODS.has(method)) {
    const token = await ensureCsrfToken();
    headers[CSRF_HEADER] = token;
    cookies.push(`${CSRF_COOKIE}=${token}`);
  }
  if (cookies.length > 0) headers["Cookie"] = cookies.join("; ");
  return headers;
}

async function performRequest<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(await buildAuthHeaders(method)),
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (err) {
    // Network failure / no connectivity — surface as a typed error (status 0).
    throw new ApiError(0, "Network error", apiErrorMessage(err, "Network request failed"));
  }

  await captureSessionCookie(res);

  if (!res.ok) {
    let detail: string | null = null;
    try {
      const data = (await res.json()) as {
        message?: unknown;
        issues?: Array<{ message?: string }>;
      };
      if (typeof data.message === "string") detail = data.message;
      else if (Array.isArray(data.message)) detail = data.message.join(", ");
      else if (Array.isArray(data.issues))
        detail = data.issues.map((i) => i.message).filter(Boolean).join(", ");
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, res.statusText, detail);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>("GET", path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("POST", path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("PUT", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("PATCH", path, { ...opts, body }),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, opts),
};
