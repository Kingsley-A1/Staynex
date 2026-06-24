import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const validRange = (value: { from: string; to: string }) => value.from <= value.to;

export const setCapacitySchema = z.object({
  roomTypeId: z.string().min(1),
  from: dateString,
  to: dateString,
  totalUnits: z.number().int().nonnegative(),
}).refine(validRange, { path: ["to"], message: "to must be on or after from" });
export type SetCapacityInput = z.infer<typeof setCapacitySchema>;

export const calendarQuerySchema = z.object({
  from: dateString,
  to: dateString,
}).refine(validRange, { path: ["to"], message: "to must be on or after from" });
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
