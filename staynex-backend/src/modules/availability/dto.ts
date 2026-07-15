import { z } from "zod";
import { utcToday } from "../../common/dates";

export const MAX_AVAILABILITY_RANGE_DAYS = 366;

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Expected a valid calendar date");
const validRange = (value: { from: string; to: string }) =>
  value.from <= value.to;
const rangeDays = (value: { from: string; to: string }) =>
  Math.floor(
    (Date.parse(`${value.to}T00:00:00.000Z`) -
      Date.parse(`${value.from}T00:00:00.000Z`)) /
      86_400_000,
  ) + 1;

const availabilityRangeSchema = z
  .object({
    from: dateString,
    to: dateString,
  })
  .refine(validRange, {
    path: ["to"],
    message: "to must be on or after from",
  })
  .refine(
    (value) => {
      const days = rangeDays(value);
      return (
        !Number.isFinite(days) ||
        !validRange(value) ||
        days <= MAX_AVAILABILITY_RANGE_DAYS
      );
    },
    {
      path: ["to"],
      message: `Availability ranges cannot exceed ${MAX_AVAILABILITY_RANGE_DAYS} days`,
    },
  );

export const setCapacitySchema = availabilityRangeSchema
  .and(
    z.object({
      roomTypeId: z.string().min(1),
      totalUnits: z.number().int().nonnegative(),
    }),
  )
  .refine((value) => value.from >= utcToday().toISOString().slice(0, 10), {
    path: ["from"],
    message: "Availability cannot be set before today",
  });
export type SetCapacityInput = z.infer<typeof setCapacitySchema>;

export const calendarQuerySchema = availabilityRangeSchema;
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
