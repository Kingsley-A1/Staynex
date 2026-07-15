// Phase 3 Track A — API conformance harness for push + inbox:
// device-token registry (register, idempotent re-register, deregister),
// the in-app inbox (page shape, unreadCount, mark-read semantics, detail),
// and the real trigger: a confirmed booking lands a BOOKING_CONFIRMED row.
//
// Replays the exact mobile-client wire protocol via the shared harness lib.
//
// Usage (backend must be running):
//   node staynex-mobile/test/phase3-notifications.mjs
//
// Footprint: one guest user + one CONFIRMED booking (real capacity until
// refunded) + one fake device token (registered then removed) + notification
// rows. The fake token also exercises the backend's dead-token pruning when
// FCM rejects it — by design.

import { API, MobileClient, createGate, createConfirmedBooking } from "./lib/harness.mjs";

const runTag = Date.now().toString(36);
const GUEST_EMAIL = `deblessedking001+stx-p3-${runTag}@gmail.com`;
const PASSWORD = `Phase3!${runTag}A`;
// Clearly fake but schema-valid (>= 20 chars) FCM-shaped token.
const DEVICE_TOKEN = `harness-device-token-${runTag}-${"x".repeat(24)}`;

async function main() {
  console.log(`Phase 3 Track A harness → ${API}\n`);
  const gate = createGate("PHASE 3 GATE");
  const { must, bail, artifacts } = gate;

  // 0. Health + guest
  const guest = new MobileClient();
  const health = await guest.get("/health/ready");
  if (!must(health.ok, "backend ready (GET /health/ready)", `status ${health.status}`)) {
    bail("backend is not reachable — start it with `pnpm dev:backend`");
  }
  await guest.mintCsrf();
  const reg = await guest.post("/auth/register", {
    email: GUEST_EMAIL,
    password: PASSWORD,
    phone: "08030000000",
    name: "Phase3 Harness",
    role: "GUEST",
  });
  if (!must(reg.ok, "register guest", reg.ok ? GUEST_EMAIL : `status ${reg.status}`)) {
    bail("registration failed");
  }
  artifacts.push(`guest: ${GUEST_EMAIL}`);

  // 1. Device registry — session-gated, idempotent register, deregister
  const anonReg = await new MobileClient().post("/notifications/devices", {
    token: DEVICE_TOKEN,
    platform: "ANDROID",
  });
  must(anonReg.status === 401, "device registration requires a session (401 anonymous)", `status ${anonReg.status}`);

  const dev1 = await guest.post("/notifications/devices", { token: DEVICE_TOKEN, platform: "ANDROID" });
  must(dev1.ok, "POST /notifications/devices registers an ANDROID token", `status ${dev1.status}`);
  const dev2 = await guest.post("/notifications/devices", { token: DEVICE_TOKEN, platform: "ANDROID" });
  must(dev2.ok, "re-registering the same token is idempotent (token rotation safe)", `status ${dev2.status}`);
  const badToken = await guest.post("/notifications/devices", { token: "short", platform: "ANDROID" });
  must(badToken.status === 400, "malformed token rejected (400)", `status ${badToken.status}`);
  artifacts.push(`device token (fake): registered + removed`);

  // 2. Inbox starts empty with the documented page shape
  const empty = await guest.get("/notifications");
  must(
    empty.ok &&
      Array.isArray(empty.json?.rows) &&
      empty.json.rows.length === 0 &&
      empty.json.unreadCount === 0 &&
      empty.json.nextCursor === null,
    "GET /notifications → empty NotificationsPage {rows, nextCursor, unreadCount}",
    `status ${empty.status}, ${empty.json?.rows?.length ?? "?"} rows`,
  );
  const anonInbox = await new MobileClient().get("/notifications");
  must(anonInbox.status === 401, "inbox requires a session (401 anonymous)", `status ${anonInbox.status}`);

  // 3. The real trigger: a confirmed booking must land an in-app row
  let trip;
  try {
    trip = await createConfirmedBooking(guest, { email: GUEST_EMAIL });
    gate.pass("confirmed-booking fixture", `${trip.stay.name} (ref ${trip.reference})`);
    artifacts.push(`confirmed booking: ${trip.bookingId} (ref ${trip.reference})`);
  } catch (err) {
    bail(`could not create the confirmed-booking fixture: ${err.message}`);
  }

  // The in-app row is written in the same onBookingConfirmed call as the push
  // outbox row; give the dispatcher a moment, then read the inbox.
  let inbox = null;
  for (let i = 0; i < 6; i++) {
    const res = await guest.get("/notifications");
    inbox = res.json;
    if (inbox?.rows?.length > 0) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  const confirmedRow = inbox?.rows?.find(
    (r) => r.type?.includes("BOOKING") && r.body?.includes(trip.stay.name),
  ) ?? inbox?.rows?.[0];
  must(
    Boolean(confirmedRow) && inbox.unreadCount >= 1,
    "booking confirmation lands in the in-app inbox (unread)",
    confirmedRow ? `type ${confirmedRow.type}, title "${confirmedRow.title}"` : "no rows arrived",
  );
  must(
    Boolean(confirmedRow?.linkUrl),
    "the notification carries a deep link (linkUrl) for tap navigation",
    confirmedRow?.linkUrl ?? "null",
  );

  // 4. Detail + mark-read semantics
  if (confirmedRow) {
    const one = await guest.get(`/notifications/${confirmedRow.id}`);
    must(one.ok && one.json?.id === confirmedRow.id, "GET /notifications/:id returns the row", `status ${one.status}`);

    const readOne = await guest.post("/notifications/read", { ids: [confirmedRow.id] });
    must(readOne.ok && readOne.json?.updated === 1, "POST /notifications/read marks one row read", `updated ${readOne.json?.updated}`);
    const afterOne = await guest.get("/notifications");
    const rowNow = afterOne.json?.rows?.find((r) => r.id === confirmedRow.id);
    must(
      Boolean(rowNow?.readAt) && afterOne.json.unreadCount === Math.max(0, inbox.unreadCount - 1),
      "readAt is set and unreadCount decrements",
      `unread ${inbox.unreadCount} → ${afterOne.json?.unreadCount}`,
    );

    const readAll = await guest.post("/notifications/read", {});
    must(readAll.ok, "POST /notifications/read {} marks everything read", `updated ${readAll.json?.updated}`);
    const afterAll = await guest.get("/notifications");
    must(afterAll.json?.unreadCount === 0, "unreadCount reaches zero", `unread ${afterAll.json?.unreadCount}`);
  }

  // 5. Deregistration (sign-out path)
  const remove = await guest.delete(`/notifications/devices/${encodeURIComponent(DEVICE_TOKEN)}`);
  must(remove.ok, "DELETE /notifications/devices/:token deregisters", `status ${remove.status}`);

  gate.report();
  process.exit(gate.state.failed ? 1 : 0);
}

main().catch((err) => {
  console.error(`\nUnhandled error: ${err instanceof Error ? err.stack : err}`);
  process.exit(1);
});
