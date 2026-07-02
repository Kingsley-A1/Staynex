import { NextResponse } from "next/server";

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

  console.info("web-vital", payload);
  return new NextResponse(null, { status: 204 });
}

function isWebVitalPayload(value: unknown): value is {
  id: string;
  name: string;
  value: number;
  rating?: string;
  navigationType?: string;
  route?: string;
} {
  if (!value || typeof value !== "object") return false;
  const metric = value as Record<string, unknown>;
  return (
    typeof metric.id === "string" &&
    typeof metric.name === "string" &&
    METRIC_NAMES.has(metric.name) &&
    typeof metric.value === "number" &&
    Number.isFinite(metric.value)
  );
}
