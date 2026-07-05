import { z } from "zod";

export const registerDeviceSchema = z.object({
  token: z.string().trim().min(20).max(4096),
  platform: z.enum(["WEB", "ANDROID", "IOS"]).default("WEB"),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export const inboxQuerySchema = z.object({
  cursor: z.string().trim().max(120).optional(),
  take: z.coerce.number().int().min(1).max(50).default(20),
});
export type InboxQuery = z.infer<typeof inboxQuerySchema>;

export const markReadSchema = z.object({
  /** Omit or send empty to mark ALL unread notifications read. */
  ids: z.array(z.string().min(1).max(64)).max(100).optional(),
});
export type MarkReadInput = z.infer<typeof markReadSchema>;
