import { Injectable } from "@nestjs/common";
import { prisma } from "../../../db";
import type { WebVitalMetricInput } from "./dto";

const USER_AGENT_LIMIT = 300;

@Injectable()
export class ObservabilityService {
  async recordWebVital(input: WebVitalMetricInput, userAgent?: string): Promise<{ ok: true }> {
    await prisma.webVitalMetric.create({
      data: {
        metricId: input.id,
        name: input.name,
        value: input.value,
        rating: input.rating ?? null,
        navigationType: input.navigationType ?? null,
        route: normalizeRoute(input.route),
        target: input.target ?? null,
        targetMet: input.targetMet ?? null,
        userAgent: userAgent ? userAgent.slice(0, USER_AGENT_LIMIT) : null,
      },
    });
    return { ok: true };
  }
}

function normalizeRoute(route: string | undefined): string {
  const trimmed = route?.trim() || "/";
  const withoutQuery = trimmed.split("?")[0]?.split("#")[0] || "/";
  return withoutQuery.startsWith("/") ? withoutQuery.slice(0, 200) : `/${withoutQuery}`.slice(0, 200);
}
