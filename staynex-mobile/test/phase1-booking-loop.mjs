// Phase 1 Track A — API conformance harness for the Staynex mobile client.
//
// Replays the EXACT wire protocol of `staynex-mobile/src/core/client.ts`
// against a running backend and drives the full guest booking loop:
//
//   health → CSRF mint → register (Set-Cookie capture) → /auth/me → login
//   → discovery (cities/search/stay/availability) → quote → hold → checkout
//   → HMAC-signed Paystack `charge.success` webhook → payment SUCCESS +
//   booking CONFIRMED → verify card + voucher PDF
//   → failed-payment path (`charge.failed` → FAILED/CANCELLED)
//   → consumed-hold semantics (checkout on a spent hold is rejected).
//
// Protocol mirror rules (any divergence from src/core/client.ts is a bug):
//   - No `Origin` header (native clients send none; backend skips origin check).
//   - Session: `staynex_session` captured from Set-Cookie, replayed as `Cookie:`.
//   - CSRF: token minted once from GET /auth/csrf, sent as BOTH the
//     `staynex_csrf` cookie and the `x-csrf-token` header on every mutation.
//   - The client never asserts booking/payment state — it reads it back.
//
// Usage (backend must be running):
//   node staynex-mobile/test/phase1-booking-loop.mjs
//
// Env:
//   STAYNEX_API_BASE_URL   default http://localhost:4000
//   PAYSTACK_SECRET_KEY    default: parsed from staynex-backend/.env (used only
//                          to sign the simulated webhook; never printed)
//   HARNESS_GUEST_EMAIL    default: a +tagged address so the confirmation
//                          email/voucher lands somewhere visible
//
// Footprint (unavoidable — the money trail is immutable by design):
//   - one guest user, one CONFIRMED booking (real capacity for its nights,
//     released only by an admin refund), one CANCELLED booking (self-released),
//     payments + PaymentEvent audit rows, notification outbox rows.
//   The script books the FURTHEST-OUT available nights it can find to keep
//   real near-term inventory untouched, and prints every row it created.

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = (process.env.STAYNEX_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const SESSION_COOKIE = "staynex_session";
const CSRF_COOKIE = "staynex_csrf";
const CSRF_HEADER = "x-csrf-token";
const NIGHTS = 2;
const LOOKAHEAD_DAYS = 180;

const runTag = Date.now().toString(36);
const GUEST_EMAIL =
  process.env.HARNESS_GUEST_EMAIL ?? `deblessedking001+stx-phase1-${runTag}@gmail.com`;
const GUEST_PHONE = "08030000000";
const GUEST_PASSWORD = `Phase1!${runTag}A`;

// --- webhook signing key (read locally, never printed) ----------------------

function paystackSecret() {
  if (process.env.PAYSTACK_SECRET_KEY) return process.env.PAYSTACK_SECRET_KEY;
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "../../staynex-backend/.env");
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("PAYSTACK_SECRET_KEY="));
  if (!line) throw new Error("PAYSTACK_SECRET_KEY not found (env or staynex-backend/.env)");
  return line.slice("PAYSTACK_SECRET_KEY=".length).trim().replace(/^"|"$/g, "");
}

// --- protocol-exact mobile client mirror ------------------------------------

class MobileClient {
  sessionCookie = null; // value of staynex_session
  csrfToken = null; // minted once per "launch", like src/core/client.ts

  async mintCsrf() {
    const res = await fetch(`${API}/auth/csrf`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`CSRF mint failed: ${res.status}`);
    const data = await res.json();
    if (typeof data.csrfToken !== "string" || !data.csrfToken) {
      throw new Error("CSRF mint returned no token");
    }
    this.csrfToken = data.csrfToken;
    return this.csrfToken;
  }

  captureSession(res) {
    const cookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [res.headers.get("set-cookie")].filter(Boolean);
    for (const c of cookies) {
      const m = c.match(new RegExp(`${SESSION_COOKIE}=([^;]*)`));
      if (m) this.sessionCookie = m[1] || null;
    }
  }

  async request(method, path, body) {
    const safe = ["GET", "HEAD", "OPTIONS"].includes(method);
    const headers = { Accept: "application/json", "Content-Type": "application/json" };
    const cookies = [];
    if (this.sessionCookie) cookies.push(`${SESSION_COOKIE}=${this.sessionCookie}`);
    if (!safe) {
      if (!this.csrfToken) await this.mintCsrf();
      headers[CSRF_HEADER] = this.csrfToken;
      cookies.push(`${CSRF_COOKIE}=${this.csrfToken}`);
    }
    if (cookies.length) headers["Cookie"] = cookies.join("; ");

    const res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    this.captureSession(res);
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body (e.g. PDF probe uses raw fetch instead) */
    }
    return { status: res.status, ok: res.ok, json, text };
  }

  get(path) {
    return this.request("GET", path);
  }
  post(path, body) {
    return this.request("POST", path, body);
  }
}

// --- gate bookkeeping --------------------------------------------------------

const results = [];
const artifacts = [];
let failed = false;

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  failed = true;
  console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}
function must(cond, name, detail = "") {
  if (cond) pass(name, detail);
  else fail(name, detail);
  return Boolean(cond);
}
const bail = (msg) => {
  fail("aborted", msg);
  report();
  process.exit(1);
};

function isoPlusDays(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function sendWebhook(event, data) {
  const raw = Buffer.from(JSON.stringify({ event, data }), "utf8");
  const signature = createHmac("sha512", paystackSecret()).update(raw).digest("hex");
  const res = await fetch(`${API}/payments/paystack/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-paystack-signature": signature },
    body: raw,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function pollPayment(client, reference, tries = 12, intervalMs = 2500) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    const res = await client.get(`/payments/${reference}`);
    last = res.json;
    if (last && ["SUCCESS", "FAILED", "REFUNDED", "REQUIRES_REFUND"].includes(last.paymentStatus)) {
      return last;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last;
}

/** Furthest-out run of `nights` consecutive days each with availableUnits >= 1. */
function furthestWindow(days, nights) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const dates = days.map((d) => d.date).sort();
  for (let i = dates.length - 1; i >= 0; i--) {
    const start = dates[i];
    const run = [];
    for (let n = 0; n < nights; n++) {
      const d = new Date(`${start}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      const key = d.toISOString().slice(0, 10);
      const day = byDate.get(key);
      if (!day || day.availableUnits < 1) break;
      run.push(key);
    }
    if (run.length === nights) {
      const out = new Date(`${start}T00:00:00Z`);
      out.setUTCDate(out.getUTCDate() + nights);
      return { checkIn: start, checkOut: out.toISOString().slice(0, 10) };
    }
  }
  return null;
}

// --- the run ------------------------------------------------------------------

async function main() {
  console.log(`Phase 1 Track A harness → ${API}`);
  console.log(`Guest identity: ${GUEST_EMAIL}\n`);

  // 1. Health
  const guest = new MobileClient();
  const health = await guest.get("/health/ready");
  if (!must(health.ok, "backend ready (GET /health/ready)", `status ${health.status}`)) {
    bail("backend is not reachable — start it with `pnpm dev:backend`");
  }

  // 2. CSRF + register + Set-Cookie capture + /auth/me
  await guest.mintCsrf();
  pass("CSRF token minted (GET /auth/csrf)");
  const reg = await guest.post("/auth/register", {
    email: GUEST_EMAIL,
    password: GUEST_PASSWORD,
    phone: GUEST_PHONE,
    name: "Phase1 Harness",
    role: "GUEST",
  });
  if (!must(reg.ok, "register accepted CSRF double-submit + body", `status ${reg.status} ${JSON.stringify(reg.json?.message ?? "")}`)) {
    bail("registration failed — nothing downstream can run");
  }
  must(Boolean(guest.sessionCookie), "Set-Cookie captured (staynex_session)");
  artifacts.push(`guest user: ${GUEST_EMAIL}`);

  const me = await guest.get("/auth/me");
  must(
    me.ok && me.json && me.json.email === GUEST_EMAIL.toLowerCase(),
    "cookie replay authenticates (GET /auth/me)",
    me.json?.email ?? `status ${me.status}`,
  );

  // 3. Login round-trip on a fresh "launch" (new client, empty jar).
  // NOTE: the backend revokes all existing sessions on login
  // (auth.service.ts `startSession(..., { revokeExisting: true })`) — single
  // active session per user. The register session above is dead from here on,
  // so the flow continues on the newest session, exactly like a real device.
  const fresh = new MobileClient();
  const login = await fresh.post("/auth/login", { email: GUEST_EMAIL, password: GUEST_PASSWORD });
  const freshMe = login.ok ? await fresh.get("/auth/me") : { json: null };
  must(
    login.ok && Boolean(fresh.sessionCookie) && freshMe.json?.email === GUEST_EMAIL.toLowerCase(),
    "login round-trip on a fresh session",
    `status ${login.status}`,
  );
  const staleMe = await guest.get("/auth/me");
  must(
    staleMe.json === null || staleMe.json?.email !== GUEST_EMAIL.toLowerCase(),
    "login revoked the previous session (single active session)",
  );
  guest.sessionCookie = fresh.sessionCookie; // adopt the live session

  // 4. Discovery: cities → search → stay detail
  const cities = await guest.get("/catalog/cities");
  must(cities.ok && Array.isArray(cities.json) && cities.json.length > 0, "GET /catalog/cities", `${cities.json?.length ?? 0} cities`);

  let stays = [];
  let cityName = null;
  for (const c of cities.json ?? []) {
    const res = await guest.get(`/search?city=${encodeURIComponent(c.name)}`);
    if (res.ok && Array.isArray(res.json) && res.json.length > 0) {
      stays = res.json;
      cityName = c.name;
      break;
    }
  }
  if (!must(stays.length > 0, "GET /search returns bookable stays", cityName ? `${stays.length} in ${cityName}` : "no city had results")) {
    bail("no searchable stays — seed the catalog first");
  }

  // Find a stay + room type + furthest-out available window
  let stay = null;
  let room = null;
  let window_ = null;
  const from = isoPlusDays(1);
  const to = isoPlusDays(LOOKAHEAD_DAYS);
  for (const s of stays) {
    const detail = await guest.get(`/stays/${encodeURIComponent(s.slug)}`);
    if (!detail.ok || !Array.isArray(detail.json?.roomTypes)) continue;
    for (const rt of detail.json.roomTypes) {
      const cal = await guest.get(
        `/availability/room-types/${encodeURIComponent(rt.id)}?from=${from}&to=${to}`,
      );
      if (!cal.ok || !Array.isArray(cal.json)) continue;
      const w = furthestWindow(cal.json, NIGHTS);
      if (w) {
        stay = detail.json;
        room = rt;
        window_ = w;
        break;
      }
    }
    if (window_) break;
  }
  if (!must(Boolean(window_), "stay detail + availability calendar yield a bookable window",
      window_ ? `${stay.name} / ${room.name} @ ${window_.checkIn}→${window_.checkOut}` : "none found")) {
    bail("no bookable availability in the lookahead window");
  }

  // 5. Quote (exact body the mobile app sends — occupancy split, no legacy `guests`)
  const quoteBody = {
    roomTypeId: room.id,
    checkIn: window_.checkIn,
    checkOut: window_.checkOut,
    adults: 2,
    children: 0,
    infants: 0,
  };
  const quote = await guest.post("/bookings/quote", quoteBody);
  must(
    quote.ok && quote.json?.totalKobo > 0 && quote.json?.nights === NIGHTS && quote.json?.available >= 1,
    "POST /bookings/quote shape + pricing",
    quote.ok ? `${quote.json.nights} nights, total ${quote.json.totalKobo} kobo` : `status ${quote.status}`,
  );

  // 6. Hold
  const hold = await guest.post("/bookings/holds", quoteBody);
  const h = hold.json;
  if (!must(
    hold.ok && typeof h?.holdId === "string" && h.expired === false && typeof h.expiresAt === "string" && h.totalKobo === quote.json.totalKobo,
    "POST /bookings/holds → HoldSummary (expiresAt surfaced, not expired)",
    hold.ok ? `hold ${h.holdId}, expires ${h.expiresAt}` : `status ${hold.status}`,
  )) bail("hold failed");

  // 7. Checkout (session + CSRF) → real Paystack test-mode initialize.
  // platform:"mobile" mirrors bookingApi.checkout and switches the Paystack
  // callback to the API's deep-link interstitial (Phase 1.5).
  const checkout = await guest.post("/checkout", {
    holdId: h.holdId,
    email: GUEST_EMAIL,
    platform: "mobile",
  });
  const co = checkout.json;
  if (!must(
    checkout.ok && co?.bookingId && co?.reference?.startsWith("stx_") && /^https:\/\//.test(co?.authorizationUrl ?? ""),
    "POST /checkout → {bookingId, reference, authorizationUrl}",
    checkout.ok ? `ref ${co.reference}` : `status ${checkout.status} ${JSON.stringify(checkout.json?.message ?? "")}`,
  )) bail("checkout failed");
  artifacts.push(`happy-path booking: ${co.bookingId} (ref ${co.reference}) — will be CONFIRMED`);

  // 8. Consumed-hold semantics: the hold row was spent by checkout
  const spentHold = await guest.get(`/bookings/holds/${h.holdId}`);
  const reCheckout = await guest.post("/checkout", { holdId: h.holdId, email: GUEST_EMAIL });
  must(
    spentHold.status === 404 && reCheckout.status >= 400 && reCheckout.status < 500,
    "consumed hold is rejected (GET 404, re-checkout 4xx)",
    `GET ${spentHold.status}, re-checkout ${reCheckout.status}`,
  );

  // 8b. Phase 1.5 — mobile payment-return interstitial contract
  const interstitial = await fetch(`${API}/payments/${co.reference}/mobile-return`);
  const interstitialType = interstitial.headers.get("content-type") ?? "";
  const interstitialHtml = await interstitial.text();
  must(
    interstitial.ok &&
      interstitialType.includes("text/html") &&
      interstitialHtml.includes(`staynex://payment/${co.reference}`),
    "mobile-return interstitial serves the deep link (HTML)",
    `status ${interstitial.status}, type ${interstitialType}`,
  );
  const badRef = await fetch(`${API}/payments/stx_%3Cscript%3E/mobile-return`);
  must(
    badRef.status === 404,
    "mobile-return rejects a malformed reference (404, no reflection)",
    `status ${badRef.status}`,
  );

  // 9. Signed charge.success webhook with the exact snapshotted amount
  const okHook = await sendWebhook("charge.success", {
    reference: co.reference,
    amount: quote.json.totalKobo,
    currency: "NGN",
    status: "success",
  });
  must(okHook.status === 200 && okHook.json?.received === true, "HMAC-signed charge.success accepted", `status ${okHook.status}`);

  // 10. Poll like the app's payment screen (webhook already landed → terminal)
  const paid = await pollPayment(guest, co.reference);
  must(
    paid?.paymentStatus === "SUCCESS" && paid?.bookingStatus === "CONFIRMED" && paid?.bookingId === co.bookingId,
    "GET /payments/:ref → SUCCESS + CONFIRMED",
    `payment ${paid?.paymentStatus}, booking ${paid?.bookingStatus}`,
  );

  // 11. BookingView agrees; verification card + voucher PDF exist
  const view = await guest.get(`/bookings/${co.bookingId}`);
  must(
    view.ok && view.json?.status === "CONFIRMED" && view.json?.amountKobo === quote.json.totalKobo,
    "GET /bookings/:id → CONFIRMED with snapshotted amount",
    view.ok ? `${view.json.propertyName} / ${view.json.roomName}` : `status ${view.status}`,
  );
  must(
    view.json?.adults === 2 && view.json?.children === 0 && view.json?.infants === 0,
    "occupancy split persisted through hold → booking",
    `adults ${view.json?.adults}, children ${view.json?.children}, infants ${view.json?.infants}`,
  );
  const verify = await guest.get(`/verify/${co.reference}`);
  must(verify.ok, "GET /verify/:reference (reception card)", `status ${verify.status}`);
  must(
    verify.ok && !JSON.stringify(verify.json).includes(String(quote.json.totalKobo)),
    "verification card never exposes the amount",
  );
  const pdfRes = await fetch(`${API}/vouchers/${co.reference}/pdf`);
  const pdfHead = Buffer.from(await pdfRes.arrayBuffer()).subarray(0, 5).toString("utf8");
  must(pdfRes.ok && pdfHead === "%PDF-", "GET /vouchers/:reference/pdf renders a real PDF", `magic "${pdfHead}"`);

  // 12. Failed-payment path: new hold → checkout → charge.failed
  const cal2 = await guest.get(
    `/availability/room-types/${encodeURIComponent(room.id)}?from=${from}&to=${to}`,
  );
  const w2 = cal2.ok && Array.isArray(cal2.json) ? furthestWindow(cal2.json, NIGHTS) : null;
  if (!must(Boolean(w2), "second bookable window for the failure path", w2 ? `${w2.checkIn}→${w2.checkOut}` : "none")) {
    bail("no capacity left for the failure-path booking");
  }
  const body2 = { roomTypeId: room.id, checkIn: w2.checkIn, checkOut: w2.checkOut, adults: 2, children: 0, infants: 0 };
  const hold2 = await guest.post("/bookings/holds", body2);
  const co2 = hold2.ok
    ? await guest.post("/checkout", { holdId: hold2.json.holdId, email: GUEST_EMAIL, platform: "mobile" })
    : { ok: false, status: hold2.status };
  if (!must(co2.ok, "failure-path hold + checkout", co2.ok ? `ref ${co2.json.reference}` : `status ${co2.status}`)) {
    bail("failure-path checkout failed");
  }
  artifacts.push(`failed-path booking: ${co2.json.bookingId} (ref ${co2.json.reference}) — CANCELLED, capacity released`);

  const failHook = await sendWebhook("charge.failed", { reference: co2.json.reference });
  must(failHook.status === 200, "HMAC-signed charge.failed accepted", `status ${failHook.status}`);
  const failedState = await pollPayment(guest, co2.json.reference);
  must(
    failedState?.paymentStatus === "FAILED" && failedState?.bookingStatus === "CANCELLED",
    "failed payment → FAILED + CANCELLED (never CONFIRMED client-side)",
    `payment ${failedState?.paymentStatus}, booking ${failedState?.bookingStatus}`,
  );
  const noVoucher = await fetch(`${API}/vouchers/${co2.json.reference}/pdf`);
  must(noVoucher.status === 404, "no voucher for an unpaid booking (404)", `status ${noVoucher.status}`);

  report();
  process.exit(failed ? 1 : 0);
}

function report() {
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${"─".repeat(60)}`);
  console.log(`PHASE 1 GATE: ${failed ? "FAIL" : "PASS"} — ${passed}/${results.length} checks passed`);
  if (artifacts.length) {
    console.log("\nRows created this run (money trail is immutable by design):");
    for (const a of artifacts) console.log(`  • ${a}`);
    console.log("  The CONFIRMED booking holds real capacity for its nights;");
    console.log("  release it with the admin refund flow when no longer needed.");
  }
}

main().catch((err) => {
  fail("unhandled error", err instanceof Error ? err.message : String(err));
  report();
  process.exit(1);
});
