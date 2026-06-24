import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadEnv } from "../config";

async function bootstrap() {
  const env = loadEnv();
  // rawBody is required to verify Paystack webhook signatures.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const allowedOrigins = (env.CORS_ORIGIN ?? env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: allowedOrigins });
  await app.listen(env.API_PORT);
}

void bootstrap();
