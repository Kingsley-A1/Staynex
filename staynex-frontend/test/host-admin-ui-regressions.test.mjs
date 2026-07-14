import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("AI mark places AI strokes inside a complete orbit of dots", async () => {
  const icons = await source("../src/components/icons.tsx");
  const mark = icons.slice(
    icons.indexOf("export function IconAi"),
    icons.indexOf("export function IconBell"),
  );
  assert.equal((mark.match(/<circle/g) ?? []).length, 8);
  assert.match(mark, /M15\.35 9v6/);
});

test("shared buttons wrap safely and retain touch target height", async () => {
  const button = await source("../src/ui/button.tsx");
  assert.match(button, /whitespace-normal/);
  assert.match(button, /break-words/);
  assert.match(button, /min-h-11/);
  assert.doesNotMatch(button, /md: "h-11/);
});

test("room creation closes after save and R2 signed PUT origins are allowed by CSP", async () => {
  const [rooms, config] = await Promise.all([
    source("../src/features/properties/room-manager.tsx"),
    source("../next.config.ts"),
  ]);
  assert.match(rooms, /setAdding\(false\);\s*router\.refresh/);
  assert.match(config, /r2\.cloudflarestorage\.com/);
  assert.match(config, /mediaUploadOrigin/);
});

test("property review blockers link to every editable remediation section", async () => {
  const review = await source(
    "../src/features/properties/review-status-panel.tsx",
  );
  for (const key of [
    "owner_identity",
    "payout_ready",
    "property_details",
    "location_ready",
    "media_ready",
    "rooms_ready",
    "availability_ready",
    "duplicate_listing",
    "content_safety",
  ]) {
    assert.match(review, new RegExp(`${key}:`));
  }
  assert.match(review, /check\.status === "FAIL"/);
  assert.match(review, /aria-label={`Edit/);
});

test("property editor exposes availability and places photos before review status", async () => {
  const [page, availability] = await Promise.all([
    source("../src/app/(host)/host/properties/[id]/page.tsx"),
    source("../src/features/properties/availability-editor.tsx"),
  ]);
  assert.ok(
    page.indexOf('id="property-photos"') < page.indexOf('id="review-status"'),
  );
  assert.match(page, /<AvailabilityEditor/);
  assert.match(availability, /hostApi\.setCapacity/);
  assert.match(availability, /Next 30 days/);
  assert.match(availability, /Next 90 days/);
  assert.match(availability, /Choose dates/);
  assert.match(availability, /Rooms offered for booking/);
  assert.match(availability, /Existing bookings and holds are protected automatically/);
  assert.match(availability, /aria-pressed={selected}/);
  assert.match(availability, /aria-expanded={advancedOpen}/);
});

test("workspace chrome uses the shared accessible breadcrumb", async () => {
  const [breadcrumb, chrome] = await Promise.all([
    source("../src/ui/breadcrumb.tsx"),
    source("../src/components/dashboard-chrome.tsx"),
  ]);
  assert.match(breadcrumb, /aria-label="Breadcrumb"/);
  assert.match(breadcrumb, /aria-current/);
  assert.match(chrome, /workspaceBreadcrumbs/);
  assert.match(chrome, /<Breadcrumbs/);
});

test("welcome gradient avoids oversized conic textures and blur filters", async () => {
  const motion = await source("../src/styles/motion.css");
  const gradient = motion.slice(
    motion.indexOf(".animated-gradient {"),
    motion.indexOf(".page-loading-line {"),
  );
  assert.match(gradient, /linear-gradient/);
  assert.match(gradient, /sx-gradient-drift-a/);
  assert.doesNotMatch(gradient, /conic-gradient|220vw|filter:\s*blur/);
});
