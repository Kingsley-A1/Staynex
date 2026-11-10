import { z } from "zod";

export const approvalActionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES"]),
  note: z.string().max(1000).optional(),
});
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;

/** Cursor-paginated admin money lists (search + status filter). */
export const adminListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  cursor: z.string().trim().max(120).optional(),
  take: z.coerce.number().int().min(1).max(50).default(25),
});
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

export const markPayoutPaidSchema = z.object({
  /** External bank or transfer identifier proving out-of-band settlement. */
  settlementReference: z
    .string()
    .trim()
    .min(3, "A bank or transfer settlement reference is required")
    .max(120),
  /** Internal context, including the mandatory reason for an early override. */
  note: z.string().trim().max(500).optional(),
  /** Explicit acknowledgement required to settle before eligibleAt. */
  overrideEligibility: z.boolean().optional(),
});
export type MarkPayoutPaidInput = z.infer<typeof markPayoutPaidSchema>;

export const markPayoutFailedSchema = z.object({
  reason: z.string().trim().min(3, "A reason is required").max(500),
});
export type MarkPayoutFailedInput = z.infer<typeof markPayoutFailedSchema>;

export const refundPaymentSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
