import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const quoteSchema = z
  .object({
    roomTypeId: z.string().min(1),
    checkIn: dateString,
    checkOut: dateString,
    guests: z.coerce.number().int().positive().max(20).default(1),
  })
  .refine((v) => v.checkIn < v.checkOut, {
    path: ["checkOut"],
    message: "checkOut must be after checkIn",
  });
export type QuoteInput = z.infer<typeof quoteSchema>;

// Holds use the same shape as a quote.
export const createHoldSchema = quoteSchema;

export const checkoutSchema = z.object({
  holdId: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
