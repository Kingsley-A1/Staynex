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
  return parsed.data;
}
