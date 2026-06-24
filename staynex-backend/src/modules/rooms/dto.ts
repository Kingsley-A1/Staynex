import { z } from "zod";

export const createRoomTypeSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  basePriceKobo: z.number().int().nonnegative(),
  maxGuests: z.number().int().positive().max(20),
});
export type CreateRoomTypeInput = z.infer<typeof createRoomTypeSchema>;

export const updateRoomTypeSchema = createRoomTypeSchema.omit({ propertyId: true }).partial();
export type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeSchema>;

export const createRoomUnitSchema = z.object({
  roomTypeId: z.string().min(1),
  code: z.string().max(60).optional(),
});
export type CreateRoomUnitInput = z.infer<typeof createRoomUnitSchema>;
