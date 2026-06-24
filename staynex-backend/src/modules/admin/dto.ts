import { z } from "zod";

export const approvalActionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES"]),
  note: z.string().max(1000).optional(),
});
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;
