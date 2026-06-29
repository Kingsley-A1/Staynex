import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Connection-class Prisma errors — the server is unreachable or the connection
 * dropped (vs. a query/constraint error). These are transient and retryable:
 *  - PrismaClientInitializationError: pool/handshake failed (server unreachable).
 *  - P1001: "Can't reach database server".
 *  - P1002: "Database server timed out".
 *  - P1008: "Operations timed out".
 *  - P1017: "Server has closed the connection".
 * CockroachDB serverless can briefly drop on cold start / network blips, so the
 * right response is to retry, not to surface a 500.
 */
const RETRYABLE_PRISMA_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);

export function isDbConnectionError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_PRISMA_CODES.has(err.code);
  }
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Warm the connection pool at boot with bounded exponential backoff. CockroachDB
 * serverless can take a moment to wake; retrying here turns a cold-start blip into
 * a short delay instead of a crash loop. Returns true once connected, false if all
 * attempts fail (the caller decides whether to proceed — Prisma reconnects lazily
 * on the first successful query regardless).
 */
export async function connectWithRetry(
  attempts = 5,
  baseDelayMs = 500,
): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prisma.$connect();
      return true;
    } catch (err) {
      if (attempt === attempts || !isDbConnectionError(err)) {
        if (!isDbConnectionError(err)) throw err;
        return false;
      }
      // Exponential backoff with light jitter to avoid thundering herd.
      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 200;
      await sleep(delay);
    }
  }
  return false;
}
