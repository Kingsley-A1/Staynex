import { type NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/api-base";

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

const BODYLESS_METHODS = new Set<HttpMethod>(["GET", "HEAD"]);

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyBackend(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyBackend(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyBackend(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyBackend(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyBackend(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxyBackend(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxyBackend(request, context);
}

async function proxyBackend(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { path } = await context.params;
  const target = new URL(path.map(encodeURIComponent).join("/"), `${API_BASE}/`);
  target.search = request.nextUrl.search;

  const headers = proxyRequestHeaders(request);
  const method = request.method as HttpMethod;
  const upstream = await fetch(target, {
    method,
    headers,
    body: BODYLESS_METHODS.has(method) ? undefined : await request.arrayBuffer(),
    cache: "no-store",
    redirect: "manual",
  });

  const responseHeaders = proxyResponseHeaders(upstream.headers);
  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

function proxyRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("accept-encoding");
  return headers;
}

function proxyResponseHeaders(headers: Headers): Headers {
  const nextHeaders = new Headers(headers);
  nextHeaders.delete("connection");
  nextHeaders.delete("content-encoding");
  nextHeaders.delete("transfer-encoding");
  nextHeaders.delete("set-cookie");

  for (const cookie of getSetCookieHeaders(headers)) {
    nextHeaders.append("set-cookie", stripCookieDomain(cookie));
  }
  return nextHeaders;
}

function getSetCookieHeaders(headers: Headers): string[] {
  const withSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  const values = withSetCookie.getSetCookie?.();
  if (values && values.length > 0) return values;

  const single = headers.get("set-cookie");
  return single ? splitCombinedSetCookie(single) : [];
}

function splitCombinedSetCookie(value: string): string[] {
  return value.split(/,(?=\s*[^;,\s]+=)/g).map((part) => part.trim());
}

function stripCookieDomain(cookie: string): string {
  return cookie
    .split(";")
    .filter((part) => !part.trim().toLowerCase().startsWith("domain="))
    .join(";");
}
