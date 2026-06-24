import { z } from "zod";

export const requestUploadSchema = z.object({
  scope: z.enum(["property", "room"]),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
});
export type RequestUploadInput = z.infer<typeof requestUploadSchema>;

export const attachMediaSchema = z.object({
  publicUrl: z.string().url(),
  altText: z.string().max(200).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});
export type AttachMediaInput = z.infer<typeof attachMediaSchema>;
