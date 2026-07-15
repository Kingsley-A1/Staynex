import { NextResponse } from "next/server";
import { API_BASE } from "@/lib/api-base";

const METRIC_NAMES = new Set(["FCP", "LCP", "CLS", "INP", "TTFB"]);

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isWebVitalPayload(payload)) {
    return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
  }

  try {
    await fetch(`${API_BASE}/observability/web-vitals`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": request.headers.get("user-agent") ?? "staynex-web",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn(
      "web-vital-forward-failed",
      error instanceof Error ? error.message : "unknown",
    );
  }
  return new NextResponse(null, { status: 204 });
}

function isWebVitalPayload(value: unknown): value is {
  id: string;
  name: string;
  value: number;
  rating?: string;
  navigationType?: string;
  route?: string;
  target?: number;
  targetMet?: boolean;
} {
  if (!value || typeof value !== "object") return false;
  const metric = value as Record<string, unknown>;
  return (
    typeof metric.id === "string" &&
    typeof metric.name === "string" &&
    METRIC_NAMES.has(metric.name) &&
    typeof metric.value === "number" &&
    Number.isFinite(metric.value) &&
    (metric.target === undefined ||
      (typeof metric.target === "number" && Number.isFinite(metric.target))) &&
    (metric.targetMet === undefined || typeof metric.targetMet === "boolean")
  );
}
