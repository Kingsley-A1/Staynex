"use client";

import { useReportWebVitals } from "next/web-vitals";

const VITAL_NAMES = new Set(["FCP", "LCP", "CLS", "INP", "TTFB"]);
const CORE_TARGETS: Partial<Record<string, number>> = {
  LCP: 2_500,
  INP: 200,
  CLS: 0.1,
};

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!VITAL_NAMES.has(metric.name)) return;

    const target = CORE_TARGETS[metric.name];
    const body = JSON.stringify({
      id: metric.id,
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      navigationType: metric.navigationType,
      route: window.location.pathname,
      ...(target === undefined
        ? {}
        : { target, targetMet: metric.value <= target }),
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/web-vitals",
        new Blob([body], { type: "application/json" }),
      );
      return;
    }

    void fetch("/api/web-vitals", {
      method: "POST",
      body,
      keepalive: true,
      headers: { "Content-Type": "application/json" },
    });
  });

  return null;
}
