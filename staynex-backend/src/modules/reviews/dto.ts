import { z } from "zod";

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Rating is required").max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10, "Tell guests a little more").max(2000),
  guestName: z.string().trim().max(80).optional(),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const moderateReviewSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "PENDING"]),
});
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;
