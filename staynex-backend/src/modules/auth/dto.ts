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

export const adminRegisterSchema = z.object({
  email,
  password,
  name,
  role: z.enum(["ADMIN_REVIEWER", "ADMIN_MANAGER"]).default("ADMIN_REVIEWER"),
  accessCode: z.string().regex(/^\d{6}$/, "Access code must be 6 digits"),
});
export type AdminRegisterInput = z.infer<typeof adminRegisterSchema>;
