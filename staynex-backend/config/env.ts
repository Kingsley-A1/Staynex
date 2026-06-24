import { z } from "zod";

/**
 * Backend environment contract. Keep this in sync with the root `.env.example`.
 * Validated once at boot via `loadEnv()` so the API fails fast on misconfig.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().optional(),
  // Payments (optional so the API boots in dev; PaystackService fails clearly if used unconfigured).
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  // Public base URL of the web app, used for the Paystack payment callback.
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  // Email (Resend). Optional so the API boots without it; NotificationsService
  // degrades to a logged "queued, not sent" state when unconfigured.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  // Push (Firebase Cloud Messaging). Foundation only — push is a documented
  // placeholder until these are provided.
  FCM_SERVER_KEY: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  // AI assistant (Google Gemini). Optional; AiModule fails gracefully (clear
  // "unavailable" state) when missing.
  GEMINI_API_KEY: z.string().optional(),
  // 6-digit access code required to register an admin account.
  ADMIN_ACCESS_CODE: z.string().regex(/^\d{6}$/, "ADMIN_ACCESS_CODE must be 6 digits").optional(),
  // Set in production so session cookies are marked Secure.
  COOKIE_DOMAIN: z.string().optional(),
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
  if (parsed.data.NODE_ENV === "production" && !parsed.data.ADMIN_ACCESS_CODE) {
    throw new Error("Invalid environment variables:\n  - ADMIN_ACCESS_CODE: required in production");
  }
  return parsed.data;
}
