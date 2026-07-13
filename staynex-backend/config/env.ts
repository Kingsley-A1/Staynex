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

const optionalString = z.preprocess(
  normalizeOptionalString,
  z.string().optional(),
);

/**
 * Backend environment contract. Keep this in sync with the root `.env.example`.
 * Validated once at boot via `loadEnv()` so the API fails fast on misconfig.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: requiredString,
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: optionalString,
  // Payments (optional so the API boots in dev; PaystackService fails clearly if used unconfigured).
  PAYSTACK_SECRET_KEY: optionalString,
  PAYSTACK_PUBLIC_KEY: optionalString,
  // Public base URL of the web app, used for the Paystack payment callback.
  NEXT_PUBLIC_APP_URL: optionalString,
  // Platform commission as a percentage (e.g. 10 or 12.5). Snapshotted onto
  // each payment at checkout. Takes precedence over PLATFORM_COMMISSION_BPS.
  PLATFORM_FEE: z.coerce.number().min(0).max(100).optional(),
  // Legacy: commission in basis points (1 bps = 0.01%; 1000 = 10%). Used only
  // when PLATFORM_FEE is unset. Defaults to 10% when both are unset.
  PLATFORM_COMMISSION_BPS: z.coerce
    .number()
    .int()
    .min(0)
    .max(10000)
    .default(1000),
  // Email (Resend). Optional so the API boots without it; NotificationsService
  // degrades to a logged "queued, not sent" state when unconfigured.
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: optionalString,
  // Push (Firebase Cloud Messaging, HTTP v1). Either provide the whole
  // service-account JSON in FIREBASE_SERVICE_ACCOUNT_KEY (raw or base64), or the
  // discrete trio FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
  // Optional so the API boots without push; PushService degrades to an honest
  // "not delivered" state when unconfigured or incomplete.
  FIREBASE_SERVICE_ACCOUNT_KEY: optionalString,
  FIREBASE_PROJECT_ID: optionalString,
  FIREBASE_CLIENT_EMAIL: optionalString,
  FIREBASE_PRIVATE_KEY: optionalString,
  // AI assistant (Google Gemini). Optional; AiModule fails gracefully (clear
  // "unavailable" state) when missing.
  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: optionalString,
  // 6-digit access codes. Backend derives admin privilege from the code;
  // the client never chooses its own admin role.
  ADMIN_REVIEWER_ACCESS_CODE: z.preprocess(
    normalizeOptionalString,
    z
      .string()
      .regex(/^\d{6}$/, "ADMIN_REVIEWER_ACCESS_CODE must be 6 digits")
      .optional(),
  ),
  ADMIN_MANAGER_ACCESS_CODE: z.preprocess(
    normalizeOptionalString,
    z
      .string()
      .regex(/^\d{6}$/, "ADMIN_MANAGER_ACCESS_CODE must be 6 digits")
      .optional(),
  ),
  SESSION_TTL_MS: z.coerce.number().int().positive().optional(),
  ADMIN_SESSION_TTL_MS: z.coerce.number().int().positive().optional(),
  // Set in production so session cookies are marked Secure.
  COOKIE_DOMAIN: optionalString,
  // Google OAuth. The agent verifies the Google ID token's `aud` against this.
  // GOOGLE_CLIENT_SECRET is only needed for the auth-code flow (not used here).
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  // Owner payout encryption. 64 hex chars (32-byte AES-256-GCM key). When unset,
  // only masked payout details (bank, name, last 4) are stored — never the full
  // account number. Validated at use-time in the payout crypto helper.
  OWNER_PAYOUT_ENCRYPTION_KEY: z.preprocess(
    normalizeOptionalString,
    z
      .string()
      .regex(
        /^[0-9a-fA-F]{64}$/,
        "OWNER_PAYOUT_ENCRYPTION_KEY must be 64 hex characters",
      )
      .optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

/** Parse and validate process environment. Throws a readable error on failure. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const isProduction = source.NODE_ENV === "production";
  const normalizedSource = {
    ...source,
    // Railway exposes PORT and routes traffic only to that assigned port. Keep
    // API_PORT for local/dev ergonomics, but never let it override PORT in prod.
    API_PORT: isProduction
      ? (source.PORT ?? source.API_PORT)
      : (source.API_PORT ?? source.PORT),
  };
  const parsed = envSchema.safeParse(normalizedSource);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(
        (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
      )
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  const { ADMIN_REVIEWER_ACCESS_CODE, ADMIN_MANAGER_ACCESS_CODE } = parsed.data;
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
