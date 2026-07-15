// Shared harness library for the Staynex mobile API-conformance gates.
//
// MobileClient mirrors the EXACT wire protocol of
// `staynex-mobile/src/core/client.ts` (any divergence from it is a bug):
//   - No `Origin` header (native clients send none; backend skips origin check).
//   - Session: `staynex_session` captured from Set-Cookie, replayed as `Cookie:`.
//   - CSRF: token minted once from GET /auth/csrf, sent as BOTH the
//     `staynex_csrf` cookie and the `x-csrf-token` header on every mutation.

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const API = (process.env.STAYNEX_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");
export const SESSION_COOKIE = "staynex_session";
const CSRF_COOKIE = "staynex_csrf";
const CSRF_HEADER = "x-csrf-token";

// --- webhook signing key (read locally, never printed) ----------------------

export function paystackSecret() {
  if (process.env.PAYSTACK_SECRET_KEY) return process.env.PAYSTACK_SECRET_KEY;
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "../../../staynex-backend/.env");
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("PAYSTACK_SECRET_KEY="));
  if (!line) throw new Error("PAYSTACK_SECRET_KEY not found (env or staynex-backend/.env)");
  return line.slice("PAYSTACK_SECRET_KEY=".length).trim().replace(/^"|"$/g, "");
}

// --- protocol-exact mobile client mirror ------------------------------------

export class MobileClient {
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
      /* non-JSON body */
    }
    return { status: res.status, ok: res.ok, json, text };
  }

  get(path) {
    return this.request("GET", path);
  }
  post(path, body) {
    return this.request("POST", path, body);
  }
  put(path, body) {
    return this.request("PUT", path, body);
  }
  patch(path, body) {
    return this.request("PATCH", path, body);
  }
  delete(path) {
    return this.request("DELETE", path);
  }
}

// --- gate bookkeeping ---------------------------------------------------------

export function createGate(name) {
  const results = [];
  const artifacts = [];
  const state = { failed: false };

  const pass = (check, detail = "") => {
    results.push({ check, ok: true, detail });
    console.log(`  PASS  ${check}${detail ? ` — ${detail}` : ""}`);
  };
  const fail = (check, detail = "") => {
    results.push({ check, ok: false, detail });
    state.failed = true;
    console.error(`  FAIL  ${check}${detail ? ` — ${detail}` : ""}`);
  };
  const must = (cond, check, detail = "") => {
    if (cond) pass(check, detail);
    else fail(check, detail);
    return Boolean(cond);
  };
  const report = () => {
    const passed = results.filter((r) => r.ok).length;
    console.log(`\n${"─".repeat(60)}`);
    console.log(`${name}: ${state.failed ? "FAIL" : "PASS"} — ${passed}/${results.length} checks passed`);
    if (artifacts.length) {
      console.log("\nRows created this run (money trail is immutable by design):");
      for (const a of artifacts) console.log(`  • ${a}`);
    }
  };
  const bail = (msg) => {
    fail("aborted", msg);
    report();
    process.exit(1);
  };

  return { pass, fail, must, report, bail, artifacts, state };
}

// --- booking-loop helpers -----------------------------------------------------

export function isoPlusDays(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function sendWebhook(event, data, { retries = 0 } = {}) {
  const raw = Buffer.from(JSON.stringify({ event, data }), "utf8");
  const signature = createHmac("sha512", paystackSecret()).update(raw).digest("hex");
  // A 5xx from the webhook is the backend telling the provider "retry me"
  // (serializable-transaction conflicts surface this way by design). When
  // retries are requested, mirror Paystack's redelivery behaviour.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}/payments/paystack/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-paystack-signature": signature },
      body: raw,
    });
    if (res.status < 500 || attempt >= retries) {
      return { status: res.status, json: await res.json().catch(() => null) };
    }
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
}

export async function pollPayment(client, reference, tries = 12, intervalMs = 2500) {
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
export function furthestWindow(days, nights) {
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

/**
 * Fixture: drive a fresh guest all the way to a CONFIRMED booking and return
 * the artifacts, or throw. Used by phases that need a real trip to act on
 * (trips list, push, etc.) without re-asserting every booking-loop step.
 * Mirrors the mobile client: occupancy split, platform:"mobile" checkout,
 * HMAC-signed charge.success webhook, then poll to SUCCESS/CONFIRMED.
 */
export async function createConfirmedBooking(client, { email, nights = 2 }) {
  const found = await findBookableWindow(client, nights);
  if (!found) throw new Error("no bookable availability for a confirmed-booking fixture");
  const body = {
    roomTypeId: found.room.id,
    checkIn: found.window.checkIn,
    checkOut: found.window.checkOut,
    adults: 2,
    children: 0,
    infants: 0,
  };
  const quote = await client.post("/bookings/quote", body);
  if (!quote.ok) throw new Error(`quote failed: ${quote.status}`);
  const hold = await client.post("/bookings/holds", body);
  if (!hold.ok) throw new Error(`hold failed: ${hold.status}`);
  const checkout = await client.post("/checkout", {
    holdId: hold.json.holdId,
    email,
    platform: "mobile",
  });
  if (!checkout.ok) throw new Error(`checkout failed: ${checkout.status}`);
  const hook = await sendWebhook(
    "charge.success",
    {
      reference: checkout.json.reference,
      amount: quote.json.totalKobo,
      currency: "NGN",
      status: "success",
    },
    { retries: 3 }, // fixture mirrors provider redelivery on transient 5xx
  );
  if (hook.status !== 200) throw new Error(`webhook rejected: ${hook.status}`);
  const paid = await pollPayment(client, checkout.json.reference);
  if (paid?.paymentStatus !== "SUCCESS" || paid?.bookingStatus !== "CONFIRMED") {
    throw new Error(`booking not confirmed: ${paid?.paymentStatus}/${paid?.bookingStatus}`);
  }
  return {
    bookingId: checkout.json.bookingId,
    reference: checkout.json.reference,
    totalKobo: quote.json.totalKobo,
    stay: found.stay,
    room: found.room,
    window: found.window,
  };
}

/** Discover a bookable stay/room/window via public endpoints. */
export async function findBookableWindow(client, nights, lookaheadDays = 180) {
  const cities = await client.get("/catalog/cities");
  if (!cities.ok || !Array.isArray(cities.json)) return null;
  const from = isoPlusDays(1);
  const to = isoPlusDays(lookaheadDays);
  for (const c of cities.json) {
    const res = await client.get(`/search?city=${encodeURIComponent(c.name)}`);
    if (!res.ok || !Array.isArray(res.json)) continue;
    for (const s of res.json) {
      const detail = await client.get(`/stays/${encodeURIComponent(s.slug)}`);
      if (!detail.ok || !Array.isArray(detail.json?.roomTypes)) continue;
      for (const rt of detail.json.roomTypes) {
        const cal = await client.get(
          `/availability/room-types/${encodeURIComponent(rt.id)}?from=${from}&to=${to}`,
        );
        if (!cal.ok || !Array.isArray(cal.json)) continue;
        const w = furthestWindow(cal.json, nights);
        if (w) return { stay: detail.json, room: rt, window: w };
      }
    }
  }
  return null;
}
