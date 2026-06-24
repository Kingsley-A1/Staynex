import { z } from "zod";

export const createAreaSchema = z.object({
  cityId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["LOCAL_GOVERNMENT_AREA", "NEIGHBORHOOD"]).default("NEIGHBORHOOD"),
  notable: z.boolean().optional(),
});
export type CreateAreaInput = z.infer<typeof createAreaSchema>;

export const updateAreaSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  type: z.enum(["LOCAL_GOVERNMENT_AREA", "NEIGHBORHOOD"]).optional(),
  notable: z.boolean().optional(),
});
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
