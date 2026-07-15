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
  assert.match(availability, /Availability days/);
  assert.match(availability, /Next 60 days/);
  assert.match(availability, /Next 30 days/);
  assert.match(availability, /Next 90 days/);
  assert.match(availability, /Choose a custom date range/);
  assert.match(availability, /Rooms available each night/);
  assert.match(availability, /Existing bookings and holds stay protected/);
  assert.match(availability, /aria-expanded={advancedOpen}/);
  assert.match(availability, /previousRoom/);
  assert.match(availability, /receivedFirstUnit/);
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

test("host room counts use explicit accessible increase and decrease controls", async () => {
  const [rooms, api] = await Promise.all([
    source("../src/features/properties/room-manager.tsx"),
    source("../src/lib/api.ts"),
  ]);
  assert.match(rooms, /Physical rooms/);
  assert.match(rooms, /aria-label={`Remove one/);
  assert.match(rooms, /aria-label={`Add one/);
  assert.match(rooms, /aria-live="polite"/);
  assert.match(api, /removeRoomUnit/);
});

test("host workspace label moves to the desktop header without sidebar duplication", async () => {
  const [chrome, hostNav, layout] = await Promise.all([
    source("../src/components/dashboard-chrome.tsx"),
    source("../src/components/nav-config.ts"),
    source("../src/app/(host)/host/layout.tsx"),
  ]);
  assert.match(layout, /workspace="Host Workspace"/);
  assert.match(chrome, /hidden text-sm font-semibold text-ink lg:block/);
  const hostItems = hostNav.slice(
    hostNav.indexOf("export const HOST_NAV"),
    hostNav.indexOf("export const ADMIN_NAV"),
  );
  assert.doesNotMatch(hostItems, /section: "Workspace"/);
});

test("notification inbox opens complete ID views with a reusable safe source CTA", async () => {
  const [list, detail, sourceButton] = await Promise.all([
    source("../src/features/notifications/notifications-view.tsx"),
    source("../src/features/notifications/notification-detail-view.tsx"),
    source("../src/features/notifications/view-source-button.tsx"),
  ]);
  assert.match(list, /encodeURIComponent\(item\.id\)/);
  assert.match(detail, /Notification ID:/);
  assert.match(detail, /<ViewSourceButton/);
  assert.match(sourceButton, /View source/);
  assert.match(sourceButton, /!href\.startsWith\("\/\/"\)/);
});

test("admin MFA uses one accessible OTP field rendered as six cells", async () => {
  const [form, codeInput] = await Promise.all([
    source("../src/features/auth/auth-form.tsx"),
    source("../src/ui/code-input.tsx"),
  ]);
  assert.match(form, /<CodeInput/);
  assert.match(codeInput, /grid-cols-6/);
  assert.match(codeInput, /autoComplete="one-time-code"/);
  assert.match(codeInput, /aria-invalid/);
});

test("guest images use bounded high-quality optimization and offline navigation fallback", async () => {
  const [image, gallery, config, worker, reporter] = await Promise.all([
    source("../src/ui/optimized-fill-image.tsx"),
    source("../src/ui/room-gallery-carousel.tsx"),
    source("../next.config.ts"),
    source("../src/app/firebase-messaging-sw.js/route.ts"),
    source("../src/components/web-vitals-reporter.tsx"),
  ]);
  assert.match(image, /quality = 82/);
  assert.match(gallery, /quality=\{88\}/);
  assert.match(config, /qualities: \[75, 82, 88\]/);
  assert.match(worker, /caches\.match\("\/offline"\)/);
  assert.match(reporter, /LCP: 2_500/);
  assert.match(reporter, /INP: 200/);
  assert.match(reporter, /CLS: 0\.1/);
});

test("approved property cards use the accessible Staynex verified mark", async () => {
  const [card, badge, icons] = await Promise.all([
    source("../src/ui/property-card.tsx"),
    source("../src/ui/badge.tsx"),
    source("../src/components/icons.tsx"),
  ]);
  assert.match(card, /property\.status === "APPROVED"/);
  assert.match(card, /<VerifiedBadge \/>/);
  assert.match(badge, /<span>Verified<\/span>/);
  assert.match(badge, /text-primary/);
  assert.match(icons, /export function IconVerified/);
});

test("new room types visibly and server-contractually default to one room", async () => {
  const [rooms, api] = await Promise.all([
    source("../src/features/properties/room-manager.tsx"),
    source("../src/lib/api.ts"),
  ]);
  assert.match(rooms, /const DEFAULT_ROOM_QUANTITY = 1/);
  assert.match(rooms, /label="Room quantity"/);
  assert.match(rooms, /unitCount: Number\(roomQuantity\)/);
  assert.match(api, /unitCount\?: number/);
});
