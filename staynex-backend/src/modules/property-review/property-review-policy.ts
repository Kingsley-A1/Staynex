export type PropertyReviewCheckKey =
  | "owner_identity"
  | "payout_ready"
  | "property_details"
  | "location_ready"
  | "media_ready"
  | "rooms_ready"
  | "availability_ready"
  | "duplicate_listing"
  | "content_safety";

export type PropertyReviewCheckStatus = "PASS" | "FAIL" | "WARNING";
export type PropertyReviewCheckSeverity = "BLOCKER" | "WARNING";

export interface PropertyReviewFacts {
  hasOwnerEmail: boolean;
  hasOwnerCapability: boolean;
  hasActivePayoutMethod: boolean;
  name: string;
  description: string | null;
  hasCity: boolean;
  propertyImageCount: number;
  roomTypeCount: number;
  pricedRoomTypeCount: number;
  activeUnitCount: number;
  availableFutureDays: number;
  duplicateCandidateCount: number;
  hasBannedContent: boolean;
}

export interface PropertyReviewPolicyCheck {
  key: PropertyReviewCheckKey;
  label: string;
  status: PropertyReviewCheckStatus;
  severity: PropertyReviewCheckSeverity;
  details: string;
}

export interface PropertyReviewPolicyResult {
  passed: boolean;
  riskScore: number;
  summary: string;
  checks: PropertyReviewPolicyCheck[];
}

const MIN_DESCRIPTION_CHARS = 40;
/** Exported: media management enforces this floor on live listings too. */
export const MIN_PROPERTY_IMAGES = 4;
const MIN_AVAILABLE_FUTURE_DAYS = 30;

export function evaluatePropertyReview(
  facts: PropertyReviewFacts,
): PropertyReviewPolicyResult {
  const checks = [
    ownerIdentityCheck(facts),
    payoutReadyCheck(facts),
    propertyDetailsCheck(facts),
    locationReadyCheck(facts),
    mediaReadyCheck(facts),
    roomsReadyCheck(facts),
    availabilityReadyCheck(facts),
    duplicateListingCheck(facts),
    contentSafetyCheck(facts),
  ];
  const failed = checks.filter((check) => check.status === "FAIL");
  const warnings = checks.filter((check) => check.status === "WARNING");
  const riskScore = Math.min(100, failed.length * 20 + warnings.length * 5);

  return {
    passed: failed.length === 0,
    riskScore,
    summary:
      failed.length === 0
        ? "Property meets Staynex auto-review criteria."
        : `${failed.length} blocker${failed.length === 1 ? "" : "s"} must be resolved before auto-publish.`,
    checks,
  };
}

export function hasBannedListingContent(input: string): boolean {
  const patterns = [
    /\b(whats\s*app|whatsapp|telegram|dm me|direct message)\b/i,
    /\b(pay\s*(cash|offline|direct|outside)|bank transfer only|avoid platform)\b/i,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    /\b(?:\+?\d[\s().-]*){8,}\b/,
    /\bhttps?:\/\//i,
  ];
  return patterns.some((pattern) => pattern.test(input));
}

function check(
  key: PropertyReviewCheckKey,
  label: string,
  isPassing: boolean,
  details: string,
): PropertyReviewPolicyCheck {
  return {
    key,
    label,
    status: isPassing ? "PASS" : "FAIL",
    severity: "BLOCKER",
    details,
  };
}

function ownerIdentityCheck(
  facts: PropertyReviewFacts,
): PropertyReviewPolicyCheck {
  return check(
    "owner_identity",
    "Owner identity",
    facts.hasOwnerEmail && facts.hasOwnerCapability,
    facts.hasOwnerEmail && facts.hasOwnerCapability
      ? "Owner account is identifiable and owner-capable."
      : "Owner account must have an email and owner capability.",
  );
}

function payoutReadyCheck(facts: PropertyReviewFacts): PropertyReviewPolicyCheck {
  return check(
    "payout_ready",
    "Payout readiness",
    facts.hasActivePayoutMethod,
    facts.hasActivePayoutMethod
      ? "Owner payout method is active."
      : "Owner needs an active payout method before automatic approval.",
  );
}

function propertyDetailsCheck(
  facts: PropertyReviewFacts,
): PropertyReviewPolicyCheck {
  const descriptionLength = facts.description?.trim().length ?? 0;
  const isPassing =
    facts.name.trim().length >= 2 && descriptionLength >= MIN_DESCRIPTION_CHARS;
  return check(
    "property_details",
    "Property details",
    isPassing,
    isPassing
      ? "Name and description are complete."
      : `Add a clear name and at least ${MIN_DESCRIPTION_CHARS} characters of description.`,
  );
}

function locationReadyCheck(
  facts: PropertyReviewFacts,
): PropertyReviewPolicyCheck {
  return check(
    "location_ready",
    "Location",
    facts.hasCity,
    facts.hasCity
      ? "Property is linked to a city."
      : "Property must be linked to a supported city.",
  );
}

function mediaReadyCheck(facts: PropertyReviewFacts): PropertyReviewPolicyCheck {
  return check(
    "media_ready",
    "Property photos",
    facts.propertyImageCount >= MIN_PROPERTY_IMAGES,
    facts.propertyImageCount >= MIN_PROPERTY_IMAGES
      ? "Property has enough photos for guest trust."
      : `Upload at least ${MIN_PROPERTY_IMAGES} property photos.`,
  );
}

function roomsReadyCheck(facts: PropertyReviewFacts): PropertyReviewPolicyCheck {
  const isPassing =
    facts.roomTypeCount > 0 &&
    facts.pricedRoomTypeCount === facts.roomTypeCount &&
    facts.activeUnitCount > 0;
  return check(
    "rooms_ready",
    "Rooms and pricing",
    isPassing,
    isPassing
      ? "Rooms, pricing, capacity, and active units are ready."
      : "Add at least one priced room type with an active unit.",
  );
}

function availabilityReadyCheck(
  facts: PropertyReviewFacts,
): PropertyReviewPolicyCheck {
  return check(
    "availability_ready",
    "Availability",
    facts.availableFutureDays >= MIN_AVAILABLE_FUTURE_DAYS,
    facts.availableFutureDays >= MIN_AVAILABLE_FUTURE_DAYS
      ? "Availability is configured for the next launch window."
      : `Configure at least ${MIN_AVAILABLE_FUTURE_DAYS} future days of availability.`,
  );
}

function duplicateListingCheck(
  facts: PropertyReviewFacts,
): PropertyReviewPolicyCheck {
  return check(
    "duplicate_listing",
    "Duplicate listing",
    facts.duplicateCandidateCount === 0,
    facts.duplicateCandidateCount === 0
      ? "No duplicate listing was detected for this owner and city."
      : "A similar listing already exists for this owner and city.",
  );
}

function contentSafetyCheck(
  facts: PropertyReviewFacts,
): PropertyReviewPolicyCheck {
  return check(
    "content_safety",
    "Content safety",
    !facts.hasBannedContent,
    !facts.hasBannedContent
      ? "Listing copy does not route guests off-platform."
      : "Remove phone numbers, email addresses, links, or off-platform payment instructions.",
  );
}
