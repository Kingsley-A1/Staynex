import { z } from "zod";

export const assistantSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(1000),
  conversationId: z.string().optional(),
  // Optional grounding context — when a property slug is supplied, the assistant
  // answers from that property's verified public facts only.
  propertySlug: z.string().optional(),
});

export type AssistantInput = z.infer<typeof assistantSchema>;
