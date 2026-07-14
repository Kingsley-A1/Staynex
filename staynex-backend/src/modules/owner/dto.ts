import { z } from "zod";

const id = (max = 60) => z.string().trim().min(1).max(max);

export const ownerProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    businessName: z.string().trim().min(1).max(160).optional(),
    phone: z.string().trim().min(3).max(40).optional(),
  })
  .refine(
    (v) =>
      v.displayName !== undefined ||
      v.businessName !== undefined ||
      v.phone !== undefined,
    {
      message: "Nothing to update",
    },
  );
export type OwnerProfileInput = z.infer<typeof ownerProfileSchema>;

export const createLocationSchema = z.object({
  cityId: id(),
  areaId: id().nullable().optional(),
  label: z.string().trim().max(80).nullable().optional(),
  addressLine: z.string().trim().max(200).nullable().optional(),
  isPrimary: z.boolean().optional(),
});
export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export const updateLocationSchema = z
  .object({
    cityId: id().optional(),
    areaId: id().nullable().optional(),
    label: z.string().trim().max(80).nullable().optional(),
    addressLine: z.string().trim().max(200).nullable().optional(),
    isPrimary: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Nothing to update",
  });
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const deleteLocationSchema = z.object({
  // Required only when the location is still linked to listings: the listings are
  // migrated to this replacement in one transaction; otherwise the delete 409s.
  replacementLocationId: id().optional(),
});
export type DeleteLocationInput = z.infer<typeof deleteLocationSchema>;

export const payoutMethodSchema = z.object({
  bankCode: z.string().trim().min(1).max(20),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Account number must be 10 digits"),
});
export type PayoutMethodInput = z.infer<typeof payoutMethodSchema>;
export const verifyPayoutAccountSchema = payoutMethodSchema;

export const completeOnboardingSchema = z.object({
  // Owner can finish without a payout method and add it later from settings.
  skipPayout: z.boolean().optional(),
});
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
