import { z } from "zod";

const email = z.string().trim().toLowerCase().email("A valid email is required");
const password = z.string().min(8, "Password must be at least 8 characters").max(200);
const name = z.string().trim().min(1).max(120).optional();

export const registerSchema = z.object({
  email,
  password,
  name,
  // Public self-service registration is GUEST or OWNER only. Admins use the
  // access-code flow.
  role: z.enum(["GUEST", "OWNER"]).default("GUEST"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({ email, password });
export type LoginInput = z.infer<typeof loginSchema>;

export const googleSchema = z.object({
  idToken: z.string().min(1, "Google credential is required"),
});
export type GoogleInput = z.infer<typeof googleSchema>;

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().toLowerCase().email("A valid email is required").optional(),
    phone: z.string().trim().max(40).nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.email !== undefined || v.phone !== undefined, {
    message: "Nothing to update",
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const adminRegisterSchema = z.object({
  email,
  password,
  name,
  accessCode: z.string().regex(/^\d{6}$/, "Access code must be 6 digits"),
});
export type AdminRegisterInput = z.infer<typeof adminRegisterSchema>;
