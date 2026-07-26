import { randomBytes, timingSafeEqual } from "node:crypto";

export const CSRF_COOKIE = "staynex_csrf";
export const CSRF_HEADER = "x-csrf-token";
export const MAX_JSON_BODY_BYTES = 1024 * 1024;

interface SecurityRequest {
  method?: string;
  url?: string;
  originalUrl?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface SecurityResponse {
  setHeader(name: string, value: string): void;
  status(code: number): SecurityResponse;
  json(body: unknown): unknown;
}

type Next = () => void;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Provider webhooks authenticate with their own signature over the raw body,
// not with our CSRF token — they are server-to-server and carry no session.
const CSRF_EXEMPT_PATHS = new Set([
  "/payments/paystack/webhook",
  "/payments/opay/webhook",
  "/observability/web-vitals",
]);

export function createCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function readCookieValue(
  header: string | string[] | undefined,
  name: string,
): string | null {
  const raw = Array.isArray(header) ? header.join("; ") : header;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name)
      return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export function securityHeaders(production: boolean) {
  return (_req: SecurityRequest, res: SecurityResponse, next: Next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    if (production) {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
      );
    }
    next();
  };
}

export function requestSizeLimit(maxBytes = MAX_JSON_BODY_BYTES) {
  return (req: SecurityRequest, res: SecurityResponse, next: Next) => {
    const raw = header(req, "content-length");
    const length = raw ? Number.parseInt(raw, 10) : 0;
    if (Number.isFinite(length) && length > maxBytes) {
      res.status(413).json({
        statusCode: 413,
        error: "Payload Too Large",
        message: "Request body is too large.",
      });
      return;
    }
    next();
  };
}

export function requireJsonContentType() {
  return (req: SecurityRequest, res: SecurityResponse, next: Next) => {
    if (isSafe(req) || isCsrfExempt(req)) return next();

    const length = Number.parseInt(header(req, "content-length") ?? "0", 10);
    const contentType = header(req, "content-type") ?? "";
    if (length > 0 && !contentType.toLowerCase().includes("application/json")) {
      res.status(415).json({
        statusCode: 415,
        error: "Unsupported Media Type",
        message: "Use application/json for API mutations.",
      });
      return;
    }
    next();
  };
}

export function csrfProtection(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins.map(normalizeOrigin).filter(Boolean));

  return (req: SecurityRequest, res: SecurityResponse, next: Next) => {
    if (isSafe(req) || isCsrfExempt(req)) return next();

    const origin = requestOrigin(req);
    if (origin && !allowed.has(origin)) {
      res.status(403).json({
        statusCode: 403,
        error: "Forbidden",
        message: "Request origin is not allowed.",
      });
      return;
    }

    const cookieToken = readCookieValue(req.headers.cookie, CSRF_COOKIE);
    const headerToken = header(req, CSRF_HEADER);
    if (!cookieToken || !headerToken || !safeEquals(cookieToken, headerToken)) {
      res.status(403).json({
        statusCode: 403,
        error: "Forbidden",
        message: "CSRF token is missing or invalid.",
      });
      return;
    }

    next();
  };
}

function isSafe(req: SecurityRequest): boolean {
  return SAFE_METHODS.has((req.method ?? "GET").toUpperCase());
}

function isCsrfExempt(req: SecurityRequest): boolean {
  return CSRF_EXEMPT_PATHS.has(pathname(req));
}

function pathname(req: SecurityRequest): string {
  return (req.originalUrl ?? req.url ?? "").split("?")[0] || "/";
}

function requestOrigin(req: SecurityRequest): string | null {
  const origin = normalizeOrigin(header(req, "origin"));
  if (origin) return origin;

  const referer = header(req, "referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function header(req: SecurityRequest, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeOrigin(value: string | undefined): string {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) return "";
  try {
    return new URL(trimmed).origin;
  } catch {
    return "";
  }
}

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
