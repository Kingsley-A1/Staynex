import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const quoteSchema = z
  .object({
    roomTypeId: z.string().min(1),
    checkIn: dateString,
    checkOut: dateString,
    // Airbnb-style occupancy split. All optional so legacy `guests`-only callers
    // keep working; the canonical occupancy is derived in the transform below.
    adults: z.coerce.number().int().min(1).max(20).optional(),
    children: z.coerce.number().int().min(0).max(20).optional(),
    infants: z.coerce.number().int().min(0).max(10).optional(),
    guests: z.coerce.number().int().positive().max(40).optional(),
  })
  .refine((v) => v.checkIn < v.checkOut, {
    path: ["checkOut"],
    message: "checkOut must be after checkIn",
  })
  .transform((v) => {
    const hasSplit = v.adults !== undefined || v.children !== undefined;
    // Fall back to the legacy `guests` total when no split is provided.
    const adults = Math.max(1, v.adults ?? (hasSplit ? 0 : (v.guests ?? 1)));
    const children = v.children ?? 0;
    const infants = v.infants ?? 0;
    return {
      roomTypeId: v.roomTypeId,
      checkIn: v.checkIn,
      checkOut: v.checkOut,
      adults,
      children,
      infants,
      // Occupancy that counts toward the room's maxGuests (infants are free).
      guests: adults + children,
    };
  });
export type QuoteInput = z.infer<typeof quoteSchema>;

// Holds use the same shape as a quote.
export const createHoldSchema = quoteSchema;

export const checkoutSchema = z.object({
  holdId: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
