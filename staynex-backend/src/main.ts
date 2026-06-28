import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadEnv } from "../config";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://staynex-frontend.vercel.app",
  "https://staynexbookings.ng",
  "https://www.staynexbookings.ng",
];

function normalizeOrigin(origin: string): string {
  const trimmed = origin.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function allowedOriginsFromEnv(env: ReturnType<typeof loadEnv>): string[] {
  const raw = [
    env.CORS_ORIGIN,
    env.NEXT_PUBLIC_APP_URL,
    ...DEFAULT_ALLOWED_ORIGINS,
  ]
    .filter(Boolean)
    .join(",");

  return Array.from(
    new Set(raw.split(",").map(normalizeOrigin).filter(Boolean)),
  );
}

async function bootstrap() {
  const env = loadEnv();
  // rawBody is required to verify Paystack webhook signatures.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const allowedOrigins = allowedOriginsFromEnv(env);
  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) {
      if (!origin) return callback(null, true);
      const normalized = normalizeOrigin(origin);
      return callback(null, allowedOrigins.includes(normalized));
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-User-Id"],
    optionsSuccessStatus: 204,
  });
  await app.listen(env.API_PORT, "0.0.0.0");
}

void bootstrap();
