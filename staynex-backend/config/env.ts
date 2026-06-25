import { z } from "zod";

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

const requiredString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().min(1),
);

const optionalString = z.preprocess(normalizeOptionalString, z.string().optional());

/**
 * Backend environment contract. Keep this in sync with the root `.env.example`.
 * Validated once at boot via `loadEnv()` so the API fails fast on misconfig.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: requiredString,
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: optionalString,
  // Payments (optional so the API boots in dev; PaystackService fails clearly if used unconfigured).
  PAYSTACK_SECRET_KEY: optionalString,
  PAYSTACK_PUBLIC_KEY: optionalString,
  // Public base URL of the web app, used for the Paystack payment callback.
  NEXT_PUBLIC_APP_URL: optionalString,
  // Platform commission in basis points (1 bps = 0.01%; 1000 = 10%). Snapshotted
  // onto each payment at checkout. Defaults to 10% when unset.
  PLATFORM_COMMISSION_BPS: z.coerce.number().int().min(0).max(10000).default(1000),
  // Email (Resend). Optional so the API boots without it; NotificationsService
  // degrades to a logged "queued, not sent" state when unconfigured.
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: optionalString,
  // Push (Firebase Cloud Messaging). Foundation only — push is a documented
  // placeholder until these are provided.
  FCM_SERVER_KEY: optionalString,
  FIREBASE_PROJECT_ID: optionalString,
  // AI assistant (Google Gemini). Optional; AiModule fails gracefully (clear
  // "unavailable" state) when missing.
  GEMINI_API_KEY: optionalString,
  // 6-digit access codes. Backend derives admin privilege from the code;
  // the client never chooses its own admin role.
  ADMIN_REVIEWER_ACCESS_CODE: z.preprocess(
    normalizeOptionalString,
    z.string().regex(/^\d{6}$/, "ADMIN_REVIEWER_ACCESS_CODE must be 6 digits").optional(),
  ),
  ADMIN_MANAGER_ACCESS_CODE: z.preprocess(
    normalizeOptionalString,
    z.string().regex(/^\d{6}$/, "ADMIN_MANAGER_ACCESS_CODE must be 6 digits").optional(),
  ),
  // Set in production so session cookies are marked Secure.
  COOKIE_DOMAIN: optionalString,
  // Google OAuth. The agent verifies the Google ID token's `aud` against this.
  // GOOGLE_CLIENT_SECRET is only needed for the auth-code flow (not used here).
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
});

export type Env = z.infer<typeof envSchema>;

/** Parse and validate process environment. Throws a readable error on failure. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  const { ADMIN_REVIEWER_ACCESS_CODE, ADMIN_MANAGER_ACCESS_CODE } = parsed.data;
  if (parsed.data.NODE_ENV === "production") {
    const missing: string[] = [];
    if (!ADMIN_REVIEWER_ACCESS_CODE) missing.push("ADMIN_REVIEWER_ACCESS_CODE");
    if (!ADMIN_MANAGER_ACCESS_CODE) missing.push("ADMIN_MANAGER_ACCESS_CODE");
    if (missing.length > 0) {
      throw new Error(
        `Invalid environment variables:\n${missing.map((name) => `  - ${name}: required in production`).join("\n")}`,
      );
    }
  }
  if (
    ADMIN_REVIEWER_ACCESS_CODE &&
    ADMIN_MANAGER_ACCESS_CODE &&
    ADMIN_REVIEWER_ACCESS_CODE === ADMIN_MANAGER_ACCESS_CODE
  ) {
    throw new Error(
      "Invalid environment variables:\n  - ADMIN_MANAGER_ACCESS_CODE: must differ from ADMIN_REVIEWER_ACCESS_CODE",
    );
  }
  return parsed.data;
}
