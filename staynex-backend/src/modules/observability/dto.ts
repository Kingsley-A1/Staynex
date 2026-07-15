import { z } from "zod";

export const WEB_VITAL_NAMES = ["FCP", "LCP", "CLS", "INP", "TTFB"] as const;
export const WEB_VITAL_RATINGS = ["good", "needs-improvement", "poor"] as const;

export const webVitalMetricSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.enum(WEB_VITAL_NAMES),
  value: z.number().finite().nonnegative(),
  rating: z.enum(WEB_VITAL_RATINGS).optional(),
  navigationType: z.string().trim().max(80).optional(),
  route: z.string().trim().max(220).optional(),
  target: z.number().finite().nonnegative().optional(),
  targetMet: z.boolean().optional(),
});

export type WebVitalMetricInput = z.infer<typeof webVitalMetricSchema>;
