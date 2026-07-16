const test = require("node:test");
const assert = require("node:assert/strict");

const {
  evaluatePropertyReview,
  hasBannedListingContent,
} = require("../dist/src/modules/property-review/property-review-policy.js");

function cleanFacts(overrides = {}) {
  return {
    hasOwnerEmail: true,
    hasOwnerCapability: true,
    hasActivePayoutMethod: true,
    name: "Marina Crest Hotel",
    description: "A calm waterfront property with clear guest amenities and verified rooms.",
    hasCity: true,
    propertyImageCount: 4,
    roomTypeCount: 1,
    pricedRoomTypeCount: 1,
    activeUnitCount: 2,
    availableFutureDays: 30,
    duplicateCandidateCount: 0,
    duplicateCandidateNames: [],
    cityName: "Calabar",
    hasBannedContent: false,
    ...overrides,
  };
}

test("passes a complete trusted listing", () => {
  const result = evaluatePropertyReview(cleanFacts());
  assert.equal(result.passed, true);
  assert.equal(result.riskScore, 0);
});

test("fails listings without the minimum property photos", () => {
  const result = evaluatePropertyReview(cleanFacts({ propertyImageCount: 3 }));
  assert.equal(result.passed, false);
  assert.equal(result.checks.find((check) => check.key === "media_ready").status, "FAIL");
});

test("fails duplicate and off-platform contact attempts", () => {
  const result = evaluatePropertyReview(
    cleanFacts({
      duplicateCandidateCount: 1,
      duplicateCandidateNames: ["Marina Crest Hotel"],
      hasBannedContent: true,
    }),
  );
  assert.equal(result.passed, false);
  assert.equal(result.checks.find((check) => check.key === "duplicate_listing").status, "FAIL");
  assert.equal(result.checks.find((check) => check.key === "content_safety").status, "FAIL");
  assert.match(
    result.checks.find((check) => check.key === "duplicate_listing").details,
    /Marina Crest Hotel.*Calabar.*Archive the duplicate/,
  );
});

test("detects off-platform listing content", () => {
  assert.equal(hasBannedListingContent("Call +234 800 123 4567 to pay by bank transfer"), true);
  assert.equal(hasBannedListingContent("Quiet rooms with verified Staynex checkout."), false);
});
