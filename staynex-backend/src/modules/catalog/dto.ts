import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const searchQuerySchema = z
  .object({
    city: z.string().min(1),
    checkIn: dateString.optional(),
    checkOut: dateString.optional(),
    guests: z.coerce.number().int().positive().max(20).optional(),
  })
  .refine((v) => (!v.checkIn && !v.checkOut) || Boolean(v.checkIn && v.checkOut), {
    path: ["checkOut"],
    message: "checkIn and checkOut must be provided together",
  })
  .refine((v) => !v.checkIn || !v.checkOut || v.checkIn < v.checkOut, {
    path: ["checkOut"],
    message: "checkOut must be after checkIn",
  });
export type SearchQuery = z.infer<typeof searchQuerySchema>;
