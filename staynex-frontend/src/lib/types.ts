// Frontend view of the Staynex API contract.
//
// The contract itself is owned by the backend and re-exported here, so that
// `@/lib/types` stays the single import site for frontend code while there is
// exactly one definition of each type in the repo. This file previously held a
// hand-maintained copy of all 84 backend types; nothing kept the two in sync,
// and the mobile app has already shipped a bug from exactly that pattern.
//
// Add API types to `staynex-backend/types/api.ts`, not here.
// Add shared status labels to `packages/shared/src/labels.ts`, not here.
//
// This file should only ever contain frontend-specific helpers, like the
// capability predicates below.

export * from "@staynex/backend/types";

// Status labels live in @staynex/shared so the web and mobile clients render
// the same words for the same state.
export {
  AREA_TYPE_LABELS,
  BOOKING_STATUS_LABELS,
  PAYMENT_STATE_LABELS,
  PAYOUT_METHOD_STATUS_LABELS,
  PAYOUT_STATUS_LABELS,
  PROPERTY_REVIEW_STATUS_LABELS,
  PROPERTY_STATUS_LABELS,
  ROLE_LABELS,
  TESTIMONIAL_STATUS_LABELS,
} from "@staynex/shared";

import type {
  AuthMfaChallenge,
  AuthResponse,
  AuthUser,
} from "@staynex/backend/types";

export function isAuthMfaChallenge(
  value: AuthResponse,
): value is AuthMfaChallenge {
  return "mfaRequired" in value && value.mfaRequired === true;
}

export function isOwnerCapable(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.capabilities.includes("OWNER"));
}

export function isAdminCapable(user: AuthUser | null | undefined): boolean {
  return Boolean(
    user?.capabilities.includes("ADMIN_REVIEWER") ||
    user?.capabilities.includes("ADMIN_MANAGER"),
  );
}

export function isAdminManager(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.capabilities.includes("ADMIN_MANAGER"));
}

/** Destination after auth, driven by capability (not just the compat role). */
export function capabilityHome(user: AuthUser): string {
  if (isAdminCapable(user)) return "/admin";
  if (isOwnerCapable(user)) return "/host/dashboard";
  return "/stays";
}
