const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");

function source(path) {
  return readFileSync(join(root, path), "utf8");
}

test("public catalog only exposes approved stays with live configured availability", () => {
  const catalog = source("src/modules/catalog/catalog.service.ts");
  assert.match(catalog, /function publicCatalogWhere/);
  assert.match(catalog, /status: "APPROVED"/);
  assert.match(catalog, /availability: \{/);
  assert.match(catalog, /date: \{ gte: utcToday\(\) \}/);
  assert.match(catalog, /totalUnits: \{ gt: 0 \}/);
});

test("property availability expiry reminders include property identity and image context", () => {
  const notifications = source(
    "src/modules/notifications/notifications.service.ts",
  );
  const maintenance = source(
    "src/modules/bookings/booking-maintenance.service.ts",
  );
  assert.match(notifications, /sendAvailabilityExpiryReminders/);
  assert.match(notifications, /PROPERTY_AVAILABILITY/);
  assert.match(notifications, /const imageUrl = property\.media\[0\]\?\.url/);
  assert.match(notifications, /imageUrl,/);
  assert.match(notifications, /property-availability-expiring/);
  assert.match(maintenance, /availabilityReminderTimer/);
  assert.match(maintenance, /remindAvailabilityExpiry/);
  assert.match(maintenance, /sendAvailabilityExpiryReminders/);
});

test("property deletion is archival, audited, and blocked by active commercial state", () => {
  const properties = source("src/modules/properties/properties.service.ts");
  const controller = source("src/modules/properties/properties.controller.ts");
  const admin = source("src/modules/admin/admin.controller.ts");
  assert.match(properties, /archiveOwned/);
  assert.match(properties, /archiveForAdmin/);
  assert.match(properties, /status: "ARCHIVED"/);
  assert.match(properties, /active or upcoming booking/);
  assert.match(properties, /live checkout hold/);
  assert.match(properties, /audit\.record/);
  assert.match(controller, /@Controller\("host\/properties"\)/);
  assert.match(controller, /@Delete\(":id"\)/);
  assert.match(admin, /@Delete\("properties\/:id"\)/);
});

test("Google auth returns MFA challenges instead of converting admin managers to generic failure", () => {
  const authService = source("src/modules/auth/auth.service.ts");
  const authController = source("src/modules/auth/auth.controller.ts");
  assert.match(authService, /googleSignIn\([\s\S]*Promise<AuthFlowResult>/);
  assert.match(
    authService,
    /requiresAdminMfa\(authUser\)[\s\S]*return this\.issueMfaChallenge\(userId\)/,
  );
  assert.match(authController, /function completeAuth/);
  assert.match(authController, /"mfaRequired" in result/);
  assert.match(authController, /return completeAuth\(res, result\)/);
});
