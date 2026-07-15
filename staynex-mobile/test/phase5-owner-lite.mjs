// Phase 5 gate — Owner Lite, machine-verified against the real backend.
//
// Proves the mobile host surface end-to-end with a REAL owner it creates
// itself, through the same go-live pipeline every Staynex host walks:
//   register(OWNER) → payout method (Paystack test resolve) → property draft
//   → priced room type → 4 photos (R2 signed uploads) → 45 days availability
//   → submit → auto-review PASS → auto-publish → a real guest books & pays
//   → host bookings list/detail (settlement split) → QR verify card
//   → availability quick actions (close/reopen + guards) → host push contract.
//
// Run:  node staynex-mobile/test/phase5-owner-lite.mjs
// Env:  backend on :4000 with PROPERTY_AUTO_PUBLISH_DELAY_MS/INTERVAL_MS set
//       low (e.g. 3000/2000) so auto-publish lands within the poll budget.
//
// Footprint (shared dev DB, Paystack test mode — no real money): creates two
// owners + one guest account, one property (retired to DRAFT and fully closed
// at the end), one CONFIRMED booking on that harness-owned property (so no
// third-party inventory is consumed). Artifacts are listed on exit.

import {
  MobileClient,
  createGate,
  isoPlusDays,
  pollPayment,
  sendWebhook,
} from "./lib/harness.mjs";

const gate = createGate("PHASE 5 GATE");
const { pass, fail, must, report, bail, artifacts } = gate;

const suffix = Date.now().toString(36);
const PASSWORD = "Str0ng!Harness-p5";
const PHONE = "+2348000000000";
// 1×1 PNG — real image bytes so the attach-time content-type re-check passes.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * Register with one retry: the dev backend's email-deliverability (MX) probe
 * can flake on the first DNS query after boot. A second attempt a moment later
 * distinguishes "bad request" from "cold resolver".
 */
async function register(client, body) {
  let res = await client.post("/auth/register", body);
  if (!res.ok) {
    await new Promise((r) => setTimeout(r, 2500));
    res = await client.post("/auth/register", body);
  }
  return res;
}

async function main() {
  const anon = new MobileClient();

  // 1 — backend ready
  const ready = await anon.get("/health/ready");
  if (!must(ready.status === 200, "backend ready (GET /health/ready)", `status ${ready.status}`)) {
    bail("backend is not reachable on :4000");
  }

  // 2 — owner registration carries the OWNER capability (Host tab truth source)
  const owner = new MobileClient();
  const ownerEmail = `deblessedking001+stx-p5-owner-${suffix}@gmail.com`;
  const reg = await register(owner, {
    email: ownerEmail,
    password: PASSWORD,
    name: "Phase Five Host",
    phone: PHONE,
    role: "OWNER",
  });
  artifacts.push(`owner: ${ownerEmail}`);
  if (
    !must(
      reg.ok && Array.isArray(reg.json?.capabilities) && reg.json.capabilities.includes("OWNER"),
      "owner registration carries the OWNER capability (Host tab truth source)",
      `status ${reg.status}, capabilities=${JSON.stringify(reg.json?.capabilities)}`,
    )
  ) {
    bail("cannot continue without an owner session");
  }

  // 3 — a plain guest cannot enter /host (server-side capability gate)
  const guest = new MobileClient();
  const guestEmail = `deblessedking001+stx-p5-guest-${suffix}@gmail.com`;
  const guestReg = await register(guest, {
    email: guestEmail,
    password: PASSWORD,
    name: "Phase Five Guest",
    phone: PHONE,
  });
  artifacts.push(`guest: ${guestEmail}`);
  if (!guestReg.ok) bail(`guest registration failed: ${guestReg.status}`);
  const forbidden = await guest.get("/host/bookings");
  must(
    forbidden.status === 403,
    "GUEST session is rejected by /host/bookings (capability enforced server-side)",
    `status ${forbidden.status}`,
  );

  // 4 — a brand-new host sees an honest empty dashboard
  const empty = await owner.get("/host/bookings");
  must(
    empty.ok &&
      empty.json?.kpis?.confirmedBookings === 0 &&
      Array.isArray(empty.json?.bookings) &&
      empty.json.bookings.length === 0,
    "new owner sees zeroed KPIs and an empty booking list",
    `status ${empty.status}`,
  );

  // 5 — payout method activates via the provider's test resolve
  const banks = await owner.get("/host/settings/payout-banks");
  if (!must(banks.ok && Array.isArray(banks.json?.banks) && banks.json.banks.length > 0,
    "payout bank directory is served", `${banks.json?.banks?.length ?? 0} banks (${banks.json?.source ?? "?"})`)) {
    bail("no bank directory — cannot reach payout readiness");
  }
  const bankCode = banks.json.banks.find((b) => b.code === "057")?.code ?? banks.json.banks[0].code;
  const payout = await owner.put("/host/settings/payout-method", {
    bankCode,
    accountNumber: "0000000000", // Paystack's documented test-mode resolve account
  });
  if (!must(payout.ok && payout.json?.status === "ACTIVE",
    "payout method resolves and activates (go-live blocker cleared)",
    `status ${payout.status}${payout.json?.message ? ` — ${payout.json.message}` : ""}`)) {
    bail("payout method is a go-live blocker; auto-review would fail");
  }

  // 6 — property draft in a launch city
  const cities = await owner.get("/catalog/cities");
  const calabar = cities.json?.find?.((c) => c.name === "Calabar");
  if (!calabar) bail("catalog has no Calabar — geography seed missing");
  const propertyName = `Harness Cove Suites ${suffix}`;
  const draft = await owner.post("/host/properties", {
    name: propertyName,
    cityId: calabar.id,
    description:
      "A calm waterfront apartment stay near the Calabar marina with self check-in, " +
      "fast Wi-Fi, a dedicated workspace, and housekeeping on request for longer visits.",
  });
  if (!must(draft.ok && draft.json?.id && draft.json?.status === "DRAFT",
    "property draft created", `id ${draft.json?.id ?? "?"}`)) {
    bail("no property draft");
  }
  const propertyId = draft.json.id;
  const propertySlug = draft.json.slug;
  artifacts.push(`property: ${propertyName} (${propertyId}, retired to DRAFT at the end)`);

  // 7 — priced room type with two physical units
  const room = await owner.post("/host/room-types", {
    propertyId,
    name: "Standard Room",
    description: "Queen bed, blackout curtains, and a compact work desk.",
    basePriceKobo: 2_500_000, // ₦25,000/night in kobo — integer money only
    maxGuests: 2,
    unitCount: 2,
  });
  if (!must(room.ok && room.json?.id, "room type created (priced, 2 units)", `id ${room.json?.id ?? "?"}`)) {
    bail("no room type");
  }
  const roomTypeId = room.json.id;

  // 8 — four photos through the real signed-upload flow (R2)
  let attached = 0;
  for (let i = 1; i <= 4; i++) {
    const target = await owner.post("/host/media/upload-url", {
      scope: "property",
      filename: `phase5-${suffix}-${i}.png`,
      contentType: "image/png",
    });
    if (!target.ok) { fail("media upload-url", `photo ${i}: status ${target.status}`); break; }
    const put = await fetch(target.json.uploadUrl, {
      method: "PUT",
      headers: target.json.headers,
      body: TINY_PNG,
    });
    if (!put.ok) { fail("media PUT to storage", `photo ${i}: status ${put.status}`); break; }
    const attach = await owner.post(`/host/media/property/${propertyId}`, { key: target.json.key });
    if (!attach.ok) { fail("media attach", `photo ${i}: status ${attach.status}`); break; }
    attached++;
  }
  must(attached === 4, "four property photos uploaded and attached (media_ready)", `${attached}/4`);

  // 9 — availability quick action opens 45 days (the same call the mobile screen makes)
  const from = isoPlusDays(0);
  const to = isoPlusDays(44);
  const open = await owner.put("/availability/capacity", { roomTypeId, from, to, totalUnits: 2 });
  must(
    open.ok && open.json?.updatedDays === 45,
    "PUT /availability/capacity opens 45 days and reports the exact contract",
    `updatedDays=${open.json?.updatedDays}`,
  );

  // 10 — submit: every automated go-live check passes
  const submitted = await owner.post(`/host/properties/${propertyId}/submit`);
  const checks = submitted.json?.latestReview?.checks ?? [];
  const failedChecks = checks.filter((c) => c.status === "FAIL").map((c) => c.label);
  // With the harness's short PROPERTY_AUTO_PUBLISH_DELAY_MS the publisher can
  // legitimately beat the submit response — SCHEDULED and PUBLISHED both mean
  // "review passed"; the next check still requires the property to go APPROVED.
  must(
    submitted.ok &&
      failedChecks.length === 0 &&
      ["SCHEDULED", "PUBLISHED"].includes(submitted.json?.reviewStatus),
    "auto-review passes every go-live check and schedules publish",
    failedChecks.length
      ? `FAILED: ${failedChecks.join(", ")}`
      : `${checks.length} checks PASS, reviewStatus=${submitted.json?.reviewStatus}`,
  );

  // 11 — auto-publisher takes it live
  let live = null;
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await owner.get(`/host/properties/${propertyId}`);
    if (res.json?.status === "APPROVED") { live = res.json; break; }
  }
  if (!must(Boolean(live), "property auto-publishes to APPROVED",
    live ? `reviewStatus=${live.reviewStatus}` : "timed out after 90s")) {
    bail("property never went live — cannot host a booking");
  }

  // 12 — the listing is publicly discoverable (what the guest app searches)
  const search = await anon.get(`/search?city=${encodeURIComponent("Calabar")}`);
  must(
    Array.isArray(search.json) && search.json.some((p) => p.id === propertyId),
    "published harness property appears in public search",
    `slug ${propertySlug}`,
  );

  // 13 — a real guest books and pays (mobile wire protocol; harness-owned inventory)
  const stay = { roomTypeId, checkIn: isoPlusDays(30), checkOut: isoPlusDays(32), adults: 2, children: 0, infants: 0 };
  const quote = await guest.post("/bookings/quote", stay);
  if (!quote.ok) bail(`quote failed: ${quote.status}`);
  const hold = await guest.post("/bookings/holds", stay);
  if (!hold.ok) bail(`hold failed: ${hold.status}`);
  const checkout = await guest.post("/checkout", { holdId: hold.json.holdId, email: guestEmail, platform: "mobile" });
  if (!checkout.ok) bail(`checkout failed: ${checkout.status}`);
  const reference = checkout.json.reference;
  const bookingId = checkout.json.bookingId;
  artifacts.push(`booking: ${bookingId} ref ${reference} (CONFIRMED, on the harness property)`);
  const hook = await sendWebhook(
    "charge.success",
    { reference, amount: quote.json.totalKobo, currency: "NGN", status: "success" },
    { retries: 3 },
  );
  if (hook.status !== 200) bail(`webhook rejected: ${hook.status}`);
  const paid = await pollPayment(guest, reference);
  must(
    paid?.paymentStatus === "SUCCESS" && paid?.bookingStatus === "CONFIRMED",
    "guest booking confirms after the signed webhook",
    `${paid?.paymentStatus}/${paid?.bookingStatus}`,
  );

  // 14 — the host list shows the business, with an honest settlement split
  const list = await owner.get("/host/bookings");
  const row = list.json?.bookings?.find?.((b) => b.id === bookingId);
  must(
    list.ok && list.json?.kpis?.confirmedBookings === 1 && Boolean(row),
    "host bookings list shows the new confirmed stay (KPI + row)",
    `confirmed=${list.json?.kpis?.confirmedBookings}`,
  );
  if (row) {
    must(
      row.grossAmountKobo === quote.json.totalKobo &&
        row.grossAmountKobo === row.platformFeeKobo + row.ownerPayoutKobo,
      "settlement split is exact: gross = platform fee + owner payout = guest charge",
      `gross=${row.grossAmountKobo} fee=${row.platformFeeKobo} payout=${row.ownerPayoutKobo}`,
    );
  }

  // 15 — host booking detail (the push tap target's screen)
  const detail = await owner.get(`/host/bookings/${bookingId}`);
  must(
    detail.ok &&
      detail.json?.status === "CONFIRMED" &&
      detail.json?.paymentStatus === "SUCCESS" &&
      detail.json?.paymentReference === reference &&
      detail.json?.roomName === "Standard Room",
    "host booking detail carries status, payment, reference, and room truth",
    `status ${detail.status}`,
  );

  // 16 — another owner cannot read it (owner-scoped reads)
  const owner2 = new MobileClient();
  const owner2Email = `deblessedking001+stx-p5-owner2-${suffix}@gmail.com`;
  const reg2 = await register(owner2, {
    email: owner2Email,
    password: PASSWORD,
    name: "Phase Five Rival",
    phone: PHONE,
    role: "OWNER",
  });
  artifacts.push(`second owner (scoping probe): ${owner2Email}`);
  if (!reg2.ok) bail(`second owner registration failed: ${reg2.status}`);
  const foreign = await owner2.get(`/host/bookings/${bookingId}`);
  must(
    foreign.status === 404,
    "another owner cannot read the booking (owner-scoped, 404 not 200)",
    `status ${foreign.status}`,
  );

  // 17 — the QR's verify card: live, public, and honest
  const verify = await anon.get(`/verify/${reference}`);
  must(
    verify.ok &&
      verify.json?.valid === true &&
      verify.json?.status === "CONFIRMED" &&
      verify.json?.propertyName === propertyName &&
      verify.json?.nights === 2 &&
      verify.json?.reference === reference,
    "verify card confirms the paid booking with live details",
    `status=${verify.json?.status} nights=${verify.json?.nights}`,
  );
  must(
    typeof verify.json?.guestEmailMasked === "string" &&
      verify.json.guestEmailMasked !== guestEmail &&
      /[•*]/.test(verify.json.guestEmailMasked),
    "verify card masks the guest email (no PII to whoever holds the QR)",
    verify.json?.guestEmailMasked ?? "null",
  );
  const badVerify = await anon.get("/verify/stx_0000000000000000");
  must(
    badVerify.ok && badVerify.json?.status === "NOT_FOUND" && badVerify.json?.valid === false,
    "an unknown reference verifies as NOT_FOUND, never as a booking",
    `status=${badVerify.json?.status}`,
  );
  const qr = await fetch(`${process.env.STAYNEX_API_BASE_URL ?? "http://localhost:4000"}/vouchers/${reference}/qr.svg`);
  const qrBody = await qr.text();
  must(
    qr.ok && qrBody.includes("<svg"),
    "the voucher QR the host will scan is served",
    `status ${qr.status}`,
  );

  // 18 — quick actions: close 3 future days, verify, reopen
  const closeFrom = isoPlusDays(40);
  const closeTo = isoPlusDays(42);
  const close = await owner.put("/availability/capacity", { roomTypeId, from: closeFrom, to: closeTo, totalUnits: 0 });
  must(close.ok && close.json?.updatedDays === 3, "quick action closes a 3-day range", `updatedDays=${close.json?.updatedDays}`);
  const closedCal = await anon.get(`/availability/room-types/${roomTypeId}?from=${closeFrom}&to=${closeTo}`);
  must(
    Array.isArray(closedCal.json) &&
      closedCal.json.length === 3 &&
      closedCal.json.every((d) => d.totalUnits === 0 && d.availableUnits === 0),
    "closed days sell zero units on the public calendar",
    `${closedCal.json?.length ?? 0} days checked`,
  );
  const reopen = await owner.put("/availability/capacity", { roomTypeId, from: closeFrom, to: closeTo, totalUnits: 2 });
  const reopenedCal = await anon.get(`/availability/room-types/${roomTypeId}?from=${closeFrom}&to=${closeTo}`);
  must(
    reopen.ok &&
      reopen.json?.updatedDays === 3 &&
      Array.isArray(reopenedCal.json) &&
      reopenedCal.json.every((d) => d.availableUnits === 2),
    "reopening restores the sellable units",
    `updatedDays=${reopen.json?.updatedDays}`,
  );

  // 19 — booked nights keep their inventory regardless of quick actions
  const bookedCal = await anon.get(`/availability/room-types/${roomTypeId}?from=${stay.checkIn}&to=${isoPlusDays(31)}`);
  must(
    Array.isArray(bookedCal.json) &&
      bookedCal.json.length === 2 &&
      bookedCal.json.every((d) => d.bookedUnits === 1 && d.availableUnits === 1),
    "the confirmed booking holds its unit on both nights (backend inventory truth)",
    bookedCal.json?.map?.((d) => `${d.date}:${d.bookedUnits}b/${d.availableUnits}a`).join(" ") ?? "?",
  );

  // 20 — the backend rejects what the mobile screen must never send anyway
  const past = await owner.put("/availability/capacity", { roomTypeId, from: isoPlusDays(-1), to: isoPlusDays(1), totalUnits: 1 });
  must(past.status === 400, "capacity in the past is rejected (400)", `status ${past.status}`);
  const tooMany = await owner.put("/availability/capacity", { roomTypeId, from, to, totalUnits: 99 });
  must(tooMany.status === 400, "capacity above the physical unit count is rejected (400)", `status ${tooMany.status}`);

  // 21 — host push contract: the owner's inbox row deep-links to the booking
  let hostNote = null;
  for (let i = 0; i < 6 && !hostNote; i++) {
    const inbox = await owner.get("/notifications?take=50");
    hostNote = inbox.json?.rows?.find?.(
      (n) => n.type === "BOOKING_CONFIRMED" && n.linkUrl === `/host/bookings/${bookingId}`,
    ) ?? null;
    if (!hostNote) await new Promise((r) => setTimeout(r, 2000));
  }
  must(
    Boolean(hostNote),
    "owner inbox carries BOOKING_CONFIRMED linking to /host/bookings/<id> (push tap target)",
    hostNote ? `"${hostNote.title}"` : "not found within 12s",
  );

  // 22 — booked nights cannot be closed out from under the guest (409), so the
  // retirement closes around them: [today..check-in) and [check-out..end].
  const closeOverBooked = await owner.put("/availability/capacity", { roomTypeId, from, to, totalUnits: 0 });
  must(
    closeOverBooked.status === 409,
    "closing a range that contains booked nights is refused (409) — committed stays stay protected",
    `status ${closeOverBooked.status}`,
  );
  const closeBefore = await owner.put("/availability/capacity", { roomTypeId, from, to: isoPlusDays(29), totalUnits: 0 });
  const closeAfter = await owner.put("/availability/capacity", { roomTypeId, from: stay.checkOut, to, totalUnits: 0 });
  must(
    closeBefore.ok && closeBefore.json?.updatedDays === 30 &&
      closeAfter.ok && closeAfter.json?.updatedDays === 13,
    "every unbooked harness day is closed to new bookings (30 + 13 days)",
    `before=${closeBefore.json?.updatedDays} after=${closeAfter.json?.updatedDays}`,
  );
  const retire = await owner.patch(`/host/properties/${propertyId}`, { name: `${propertyName} (retired)` });
  must(
    retire.ok && retire.json?.status === "DRAFT",
    "owner content edit unpublishes the listing (review integrity) — property retired to DRAFT",
    `status=${retire.json?.status}`,
  );
  const searchAfter = await anon.get(`/search?city=${encodeURIComponent("Calabar")}`);
  must(
    Array.isArray(searchAfter.json) && !searchAfter.json.some((p) => p.id === propertyId),
    "retired harness property is delisted from public search",
  );

  report();
  process.exit(gate.state.failed ? 1 : 0);
}

main().catch((err) => bail(err instanceof Error ? err.message : String(err)));
