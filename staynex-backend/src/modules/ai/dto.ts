import { z } from "zod";

export const assistantSchema = z
  .object({
    message: z.string().trim().min(1, "Message is required").max(1000),
    conversationId: z.string().optional(),
    // Optional grounding context — when a property slug is supplied, the assistant
    // answers from that property's verified public facts only.
    propertySlug: z.string().optional(),
    // Browser pathname only (never a role/authority claim). The server combines
    // this with the authenticated principal to select safe page context.
    pagePath: z
      .string()
      .trim()
      .max(240)
      .regex(/^\/[^\r\n?#]*$/, "Page path must be a pathname")
      .optional(),
    operation: z
      .discriminatedUnion("type", [
        z.object({
          type: z.literal("retry"),
          assistantMessageId: z.string().min(1),
        }),
        z.object({
          type: z.literal("edit"),
          userMessageId: z.string().min(1),
        }),
      ])
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.operation && !value.conversationId) {
      context.addIssue({
        code: "custom",
        path: ["conversationId"],
        message: "Conversation is required for retry or edit",
      });
    }
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

export const messageFeedbackSchema = z.object({
  feedback: z.enum(["UP", "DOWN"]).nullable(),
});
