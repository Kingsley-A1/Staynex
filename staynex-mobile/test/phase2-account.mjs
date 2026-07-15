// Phase 2 Track A — API conformance harness for the returning-guest surfaces:
// trips list (session-scoped ownership), profile management, revoke-others
// (session-safety invariant), and store-compliant account deletion.
//
// Replays the exact mobile-client wire protocol via the shared harness lib.
//
// Usage (backend must be running):
//   node staynex-mobile/test/phase2-account.mjs
//
// Footprint: two guest users + one CONFIRMED booking (real capacity for its
// nights until refunded). One guest is deleted by the deletion test; the other
// is deleted at the end (proving deletion detaches but preserves the booking).

import {
  API,
  MobileClient,
  createGate,
  createConfirmedBooking,
} from "./lib/harness.mjs";

const runTag = Date.now().toString(36);
const emailFor = (who) =>
  process.env.HARNESS_GUEST_EMAIL_PREFIX
    ? `${process.env.HARNESS_GUEST_EMAIL_PREFIX}+stx-p2-${who}-${runTag}@gmail.com`
    : `deblessedking001+stx-p2-${who}-${runTag}@gmail.com`;
const PASSWORD = `Phase2!${runTag}A`;

async function registerGuest(gate, who, name) {
  const client = new MobileClient();
  await client.mintCsrf();
  const email = emailFor(who);
  const reg = await client.post("/auth/register", {
    email,
    password: PASSWORD,
    phone: "08030000000",
    name,
    role: "GUEST",
  });
  if (!gate.must(reg.ok, `register guest ${who}`, reg.ok ? email : `status ${reg.status} ${JSON.stringify(reg.json?.message ?? "")}`)) {
    gate.bail(`could not register guest ${who}`);
  }
  return { client, email };
}

async function main() {
  console.log(`Phase 2 Track A harness → ${API}\n`);
  const gate = createGate("PHASE 2 GATE");

  // 0. Health
  const probe = new MobileClient();
  const health = await probe.get("/health/ready");
  if (!gate.must(health.ok, "backend ready (GET /health/ready)", `status ${health.status}`)) {
    gate.bail("backend is not reachable — start it with `pnpm dev:backend`");
  }

  // 1. Guest A registers and books a confirmed trip
  const a = await registerGuest(gate, "a", "Phase2 Guest A");
  gate.artifacts.push(`guest A: ${a.email}`);
  let trip;
  try {
    trip = await createConfirmedBooking(a.client, { email: a.email });
    gate.pass("guest A has a CONFIRMED booking (fixture)", `${trip.stay.name} (ref ${trip.reference})`);
    gate.artifacts.push(`confirmed booking: ${trip.bookingId} (ref ${trip.reference})`);
  } catch (err) {
    gate.bail(`could not create the confirmed-booking fixture: ${err.message}`);
  }

  // 2. Trips list — GET /bookings is session-scoped and contains the trip
  const tripsA = await a.client.get("/bookings");
  const listA = Array.isArray(tripsA.json) ? tripsA.json : [];
  gate.must(tripsA.ok && listA.length >= 1, "GET /bookings returns the guest's trips", `status ${tripsA.status}, ${listA.length} trips`);
  const mine = listA.find((b) => b.id === trip.bookingId);
  gate.must(
    mine && mine.status === "CONFIRMED" && mine.amountKobo === trip.totalKobo,
    "trips list includes the confirmed booking with snapshotted amount",
    mine ? `${mine.propertyName} / ${mine.roomName}` : "booking not in list",
  );
  gate.must(
    listA.every((b) => b.status !== "HOLD"),
    "trips list never shows raw HOLD rows",
    `statuses: ${[...new Set(listA.map((b) => b.status))].join(", ")}`,
  );

  // 3. Ownership isolation — guest B never sees guest A's trip
  const b = await registerGuest(gate, "b", "Phase2 Guest B");
  gate.artifacts.push(`guest B: ${b.email}`);
  const tripsB = await b.client.get("/bookings");
  const listB = Array.isArray(tripsB.json) ? tripsB.json : [];
  gate.must(
    tripsB.ok && !listB.some((x) => x.id === trip.bookingId),
    "another guest's trips list never leaks guest A's booking",
    `guest B sees ${listB.length} trips`,
  );

  // 4. Trips require a session (unauthenticated call is rejected)
  const anon = new MobileClient();
  const anonTrips = await anon.get("/bookings");
  gate.must(anonTrips.status === 401, "GET /bookings requires a session (401 anonymous)", `status ${anonTrips.status}`);

  // 5. Profile update — PATCH /auth/profile reflected in /auth/me
  const newName = `Renamed ${runTag}`;
  const newPhone = "08099999999";
  const patch = await a.client.patch("/auth/profile", { name: newName, phone: newPhone });
  gate.must(patch.ok && patch.json?.name === newName, "PATCH /auth/profile updates name", `status ${patch.status}`);
  const meA = await a.client.get("/auth/me");
  gate.must(
    meA.json?.name === newName && meA.json?.phone === newPhone,
    "GET /auth/me reflects the profile update",
    `name ${meA.json?.name}, phone ${meA.json?.phone}`,
  );

  // 6. Revoke-others keeps the caller's own session alive (single-session
  //    backend: revoked count may be 0, but it must NEVER sign you out).
  const revoke = await a.client.post("/auth/sessions/revoke-others");
  gate.must(revoke.ok, "POST /auth/sessions/revoke-others accepted", `status ${revoke.status}`);
  const meAfterRevoke = await a.client.get("/auth/me");
  gate.must(
    meAfterRevoke.json?.email === a.email.toLowerCase(),
    "revoke-others never signs out the current device",
    meAfterRevoke.json?.email ?? "session lost",
  );

  // 7. Account deletion (guest B, no bookings) — store-compliant clean delete
  const delB = await b.client.delete("/auth/profile");
  gate.must(delB.ok, "DELETE /auth/profile deletes a no-booking account", `status ${delB.status}`);
  const meB = await b.client.get("/auth/me");
  gate.must(meB.json === null, "deleted account resolves to no session (GET /auth/me null)");
  const reloginB = new MobileClient();
  const loginB = await reloginB.post("/auth/login", { email: b.email, password: PASSWORD });
  gate.must(loginB.status === 401, "deleted account can no longer sign in (401)", `status ${loginB.status}`);

  // 8. Account deletion (guest A, owns a CONFIRMED trip) — must NOT trap the
  //    user; the immutable booking record survives, detached from the account.
  const delA = await a.client.delete("/auth/profile");
  gate.must(delA.ok, "guest with a confirmed trip can still delete (no permanent-account trap)", `status ${delA.status}`);
  if (delA.ok) {
    const bookingAfter = await new MobileClient().get(`/bookings/${trip.bookingId}`);
    gate.must(
      bookingAfter.ok && bookingAfter.json?.status === "CONFIRMED",
      "the confirmed booking survives account deletion (money trail preserved)",
      `status ${bookingAfter.status}, booking ${bookingAfter.json?.status}`,
    );
    const voucherAfter = await fetch(`${API}/vouchers/${trip.reference}/pdf`);
    gate.must(voucherAfter.ok, "voucher still issues for the surviving booking", `status ${voucherAfter.status}`);
  }

  gate.report();
  process.exit(gate.state.failed ? 1 : 0);
}

main().catch((err) => {
  console.error(`\nUnhandled error: ${err instanceof Error ? err.stack : err}`);
  process.exit(1);
});
