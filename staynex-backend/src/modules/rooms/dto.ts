import { z } from "zod";

export const DEFAULT_ROOM_UNIT_COUNT = 1;
export const MAX_ROOM_UNIT_COUNT = 500;

export const createRoomTypeSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  basePriceKobo: z.number().int().nonnegative(),
  maxGuests: z.number().int().positive().max(20),
  unitCount: z
    .number()
    .int()
    .min(1)
    .max(MAX_ROOM_UNIT_COUNT)
    .default(DEFAULT_ROOM_UNIT_COUNT),
});
export type CreateRoomTypeInput = z.infer<typeof createRoomTypeSchema>;

export const updateRoomTypeSchema = createRoomTypeSchema
  .omit({ propertyId: true, unitCount: true })
  .partial();
export type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeSchema>;

export const createRoomUnitSchema = z.object({
  roomTypeId: z.string().min(1),
  code: z.string().max(60).optional(),
});
export type CreateRoomUnitInput = z.infer<typeof createRoomUnitSchema>;
