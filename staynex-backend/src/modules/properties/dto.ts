import { z } from "zod";

export const createPropertySchema = z.object({
  name: z.string().min(2).max(120),
  cityId: z.string().min(1),
  description: z.string().max(2000).optional(),
});
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

export const updatePropertySchema = createPropertySchema.partial();
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
