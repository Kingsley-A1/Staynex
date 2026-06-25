import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadEnv } from "../config";

function normalizeOrigin(origin: string): string {
  const trimmed = origin.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function allowedOriginsFromEnv(env: ReturnType<typeof loadEnv>): string[] {
  const raw = [env.CORS_ORIGIN, env.NEXT_PUBLIC_APP_URL, "http://localhost:3000"]
    .filter(Boolean)
    .join(",");

  return Array.from(
    new Set(
      raw
        .split(",")
        .map(normalizeOrigin)
        .filter(Boolean),
    ),
  );
}

async function bootstrap() {
  const env = loadEnv();
  // rawBody is required to verify Paystack webhook signatures.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const allowedOrigins = allowedOriginsFromEnv(env);
  app.enableCors({
    origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      if (!origin) return callback(null, true);
      const normalized = normalizeOrigin(origin);
      return callback(null, allowedOrigins.includes(normalized));
    },
    credentials: true,
  });
  await app.listen(env.API_PORT);
}

void bootstrap();
