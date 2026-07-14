import { z } from "zod";

export const createAreaSchema = z.object({
  cityId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  type: z
    .enum(["LOCAL_GOVERNMENT_AREA", "NEIGHBORHOOD"])
    .default("NEIGHBORHOOD"),
  notable: z.boolean().optional(),
});
export type CreateAreaInput = z.infer<typeof createAreaSchema>;

export const updateAreaSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    type: z.enum(["LOCAL_GOVERNMENT_AREA", "NEIGHBORHOOD"]).optional(),
    notable: z.boolean().optional(),
  })
  .refine(
    (value) => Object.values(value).some((entry) => entry !== undefined),
    {
      message: "Nothing to update",
    },
  );
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;

export const createCitySchema = z.object({
  countryId: z.string().trim().min(1).max(60),
  regionId: z.string().trim().min(1).max(60).nullable().optional(),
  name: z.string().trim().min(2).max(120),
});
export type CreateCityInput = z.infer<typeof createCitySchema>;

export const updateCitySchema = z
  .object({
    countryId: z.string().trim().min(1).max(60).optional(),
    regionId: z.string().trim().min(1).max(60).nullable().optional(),
    name: z.string().trim().min(2).max(120).optional(),
  })
  .refine(
    (value) => Object.values(value).some((entry) => entry !== undefined),
    {
      message: "Nothing to update",
    },
  );
export type UpdateCityInput = z.infer<typeof updateCitySchema>;
