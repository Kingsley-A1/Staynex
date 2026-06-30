// Native fetch client for the Staynex API.
//
// Auth is session-cookie only (no bearer tokens). Browsers manage the cookie jar
// automatically; a native client does not, so this wrapper:
//   1. captures `staynex_session` from `Set-Cookie` on responses, and
//   2. replays it as a `Cookie:` header on every subsequent request,
// persisting the value in `expo-secure-store` so the session survives restarts.

import * as SecureStore from "expo-secure-store";
import { API_BASE_URL, SESSION_COOKIE } from "./env";

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

interface RequestOptions {
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const cookie = await readSessionCookie();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (cookie) headers["Cookie"] = `${SESSION_COOKIE}=${cookie}`;

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
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("PATCH", path, { ...opts, body }),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, opts),
};
