// Typed access to runtime config injected via `app.config.ts` -> `extra`.
//
// This module + `app.config.ts` are the ONLY places the API base URL is read.
// No string literal for the API host appears anywhere else in the app.

import Constants from "expo-constants";

interface StaynexExtra {
  apiBaseUrl?: string;
  googleClientId?: string | null;
}

const extra = (Constants.expoConfig?.extra ?? {}) as StaynexExtra;

if (!extra.apiBaseUrl) {
  throw new Error(
    "Missing STAYNEX_API_BASE_URL. Set it in the environment before starting/" +
      "building the app (see app.config.ts).",
  );
}

/** Root of the NestJS API, with any trailing slash removed. */
export const API_BASE_URL = extra.apiBaseUrl.replace(/\/+$/, "");

/** Google OAuth web client id (Phase 2 — out of scope for Phase 0/1). */
export const GOOGLE_CLIENT_ID = extra.googleClientId ?? null;

/** Backend session cookie name (not a secret — the cookie value is). */
export const SESSION_COOKIE = "staynex_session";
