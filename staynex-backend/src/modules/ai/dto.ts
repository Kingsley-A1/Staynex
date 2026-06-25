import { z } from "zod";

export const assistantSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(1000),
  conversationId: z.string().optional(),
  // Optional grounding context — when a property slug is supplied, the assistant
  // answers from that property's verified public facts only.
  propertySlug: z.string().optional(),
});

export type AssistantInput = z.infer<typeof assistantSchema>;

export const createConversationSchema = z.object({
  title: z.string().trim().max(120).optional(),
});

export const renameConversationSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
});

export const pinConversationSchema = z.object({
  pinned: z.boolean(),
});
