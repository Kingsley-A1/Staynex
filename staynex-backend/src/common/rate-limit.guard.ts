import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
  UseGuards,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RateLimiterService } from "./rate-limiter";

type RateLimitKeyPart = "ip" | "user" | "email";

interface RateLimitedRequest {
  ip?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  user?: { id: string };
}

export interface RateLimitOptions {
  bucket: string;
  limit: number;
  windowMs: number;
  keyBy?: RateLimitKeyPart[];
  message?: string;
}

const RATE_LIMIT_KEY = "staynex:rate-limit";

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly limiter: RateLimiterService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return true;

    const req = context.switchToHttp().getRequest<RateLimitedRequest>();
    const keyParts: RateLimitKeyPart[] = options.keyBy?.length
      ? options.keyBy
      : ["ip"];
    const keys = keysFor(req, options.bucket, keyParts);
    for (const key of keys) {
      if (this.limiter.check(key, options.limit, options.windowMs)) continue;
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: "Too Many Requests",
          message:
            options.message ?? "Too many requests. Please wait and try again.",
          retryable: true,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}

export const RateLimit = (options: RateLimitOptions) =>
  applyDecorators(
    SetMetadata(RATE_LIMIT_KEY, options),
    UseGuards(RateLimitGuard),
  );

function keysFor(
  req: RateLimitedRequest,
  bucket: string,
  parts: RateLimitKeyPart[],
): string[] {
  const keys = new Set<string>();
  for (const part of parts) {
    if (part === "ip") keys.add(`${bucket}:ip:${clientIp(req)}`);
    if (part === "user")
      keys.add(`${bucket}:user:${req.user?.id ?? clientIp(req)}`);
    if (part === "email") {
      const email = bodyEmail(req.body);
      keys.add(`${bucket}:email:${email ?? clientIp(req)}`);
    }
  }
  return [...keys];
}

function clientIp(req: RateLimitedRequest): string {
  const forwarded = firstHeader(req.headers["x-forwarded-for"]);
  return forwarded?.split(",")[0]?.trim() || req.ip || "unknown";
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function bodyEmail(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("email" in body)) return null;
  const value = (body as { email?: unknown }).email;
  return typeof value === "string" ? value.trim().toLowerCase() || null : null;
}
