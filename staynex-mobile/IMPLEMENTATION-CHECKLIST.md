# Staynex Mobile — Implementation Checklist (Current State → Deployment)

> The working checklist for taking `staynex-mobile/` from a staged scaffold to a
> store-distributed app. Companion to `Staynex_plan.md` → Mobile App Workstream
> (the *why*) and `PHASE-0-1-AGENT-PROMPT.md` (the Phase 0/1 spec). This file is
> the *what and when*: tick items here as they land, in order — **no phase
> starts until the previous phase's exit gate is green.**
>
> Every phase ends by shipping something a real person can feel. If a phase's
> "Ships" line wouldn't impress a tester, the phase is scoped wrong.

**Baseline (2026-07-14):** guest booking loop screens staged (~3,100 lines,
Expo SDK 52); workspace registration and CSRF client support landed on
`staynex-mobile-staging`; nothing yet verified end-to-end.

**Cadence assumption:** one engineer + agent support, working days. Dates are
targets, not fiction — if a gate slips, move every later date, don't skip the gate.

---

## Progress tracker

| Phase | Ships                                        | Target        | Status |
| ----- | -------------------------------------------- | ------------- | ------ |
| 0     | The app runs against the real platform       | Wed 15 Jul    | 🟡 toolchain green; 2 device checks pending |
| 1     | A phone can book and pay for a real stay     | Fri 24 Jul    | 🟡 Track A ✅ 25/25 machine-verified; Track B pending hardware |
| 1.5   | Payment feels native; receipt in hand        | Wed 29 Jul    | 🟡 engineering ✅ 28/28; device auto-return gate pending hardware |
| 2     | The returning-guest app (trips + identity)   | Fri 7 Aug     | 🟡 engineering ✅ 19/19; new-device demo pending hardware |
| 3     | The app taps you on the shoulder (push)      | Wed 12 Aug    | ⬜ |
| 4     | Concierge in your pocket (Staynex AI)        | Fri 21 Aug    | ⬜ |
| 5     | Hosts run their business from a phone        | Fri 28 Aug    | ⬜ |
| 6     | Staynex installed from the store             | Fri 11 Sep    | ⬜ |

---

## Phase 0 — Foundation runs

**Ships:** the Expo app cold-starts on an emulator and renders real Staynex
catalog data from the local API. Connectivity is proven; the toolchain is green.

**SMART goal:** by **Wed 15 Jul 2026**, `pnpm --filter @staynex/mobile check`
and `expo-doctor` both exit 0, and a screen recording shows cold start →
`GET /search?city=Calabar` rendering live property cards on an Android emulator.

- [x] `staynex-mobile` registered in `pnpm-workspace.yaml`; `workspace:*` deps resolve.
- [x] CSRF double-submit support in `src/core/client.ts` (mint from `GET /auth/csrf`, send `staynex_csrf` cookie + `x-csrf-token` header on every mutating request, one retry on rejection).
- [x] `pnpm install` completes clean at the repo root (lockfile updated; `react-dom@18.3.1` pinned to silence peer warnings; pnpm `overrides` migrated to `pnpm-workspace.yaml` where pnpm 10 actually reads them).
- [x] `pnpm --filter @staynex/mobile check` (tsc `--noEmit`) passes with zero errors (needed a `"react"` → local `@types/react@18` paths pin in `tsconfig.json` — the web app's `@types/react@19` was leaking into library typings).
- [x] `expo-doctor` passes — 18/18 checks. Fixes required: removed `expo-web-browser` from `plugins` in `app.config.ts` (it has no `app.plugin.js` in SDK 52; listing it crashed every `expo config`/CLI run with a silent exit 1), bumped `react-native` → 0.76.9 and `react-native-screens` → ~4.4.0 to SDK 52 expected versions, made `metro.config.js` watchFolders additive to Expo defaults.
- [ ] ⏳ **PENDING — needs an Android emulator/device:** Metro resolves `@staynex/backend/types` and `@staynex/shared` through the pnpm symlinks (app boots in Expo Go / dev client without red screen).
- [x] `STAYNEX_API_BASE_URL` documented: emulator loopback is `http://10.0.2.2:4000` (Android) / `http://localhost:4000` (iOS sim) — see `app.config.ts` header.
- [ ] ⏳ **PENDING — needs an Android emulator/device:** live search smoke test: cold start → pick Calabar → results render real rows from the local API (record it).

**Exit gate:** all boxes above ticked + the recording exists. *Measured by:* command exit codes and the recording.

> The two pending items are hardware-bound, not engineering-bound: start the
> backend (`pnpm dev:backend`), then
> `STAYNEX_API_BASE_URL=http://10.0.2.2:4000 pnpm -C staynex-mobile start`
> on a machine with an emulator. Everything they depend on is already verified.

---

## Phase 1 — Prove the booking loop

**Ships:** a real person books and pays for a stay on a phone, in Paystack test
mode, and the booking shows up on the host's web dashboard. This is the product's
core promise, native.

**SMART goal:** by **Fri 24 Jul 2026**, one uninterrupted test run completes
search → stay → quote → hold → sign-in → checkout → Paystack test card →
`CONFIRMED`, the booking is visible at `/host/bookings` on the web, and an EAS
Android preview build installs on a physical device.

Phase 1 runs on two tracks. **Track A** is machine-verified now by the API
conformance harness (`staynex-mobile/test/phase1-booking-loop.mjs`) — it replays
the mobile client's exact wire protocol (CSRF double-submit, manual cookie
replay, quote → hold → checkout, HMAC-signed Paystack webhook, terminal-state
polling) against a running backend and reports a gate verdict per step.
**Track B** needs a phone/emulator and closes the phase.

**Track A — machine-verified (API conformance harness): ✅ PASS 25/25 (2026-07-14)**
- [x] Contract defect fixed: register requires `phone` on the backend; the mobile register screen and `authApi.register` now collect and send it (found by static contract audit — every mobile registration would have 400'd).
- [x] Harness: CSRF mint + double-submit accepted; register → `Set-Cookie` captured → cookie replay authenticates `GET /auth/me`; login round-trip.
- [x] Harness: discovery (`/catalog/cities` → `/search` → `/stays/:slug` → availability) returns coherent shapes matching `@staynex/backend/types`.
- [x] Harness: quote → hold → checkout (session + CSRF) returns `{bookingId, reference, authorizationUrl}` against real Paystack test-mode initialize.
- [x] Harness: signed `charge.success` webhook (exact amount + NGN) → poll `GET /payments/:reference` → `SUCCESS` + booking `CONFIRMED`; `GET /bookings/:id`, `GET /verify/:reference` (amount never exposed), and the voucher PDF (`%PDF-`) all agree.
- [x] Harness: failed-payment path — signed `charge.failed` → payment `FAILED`, booking `CANCELLED`, capacity released, voucher correctly 404s, no client-side CONFIRMED anywhere.
- [x] Harness: consumed-hold semantics — checkout on a spent hold is rejected (GET 404 / re-checkout 404); `HoldSummary.expiresAt`/`expired` surfaced for the countdown UI.
- [x] Money audit: `grep -rE "/ 100\b|₦" staynex-mobile/src staynex-mobile/app` → zero hits; every amount rendered via `formatKoboToNGN`.
- [x] Contract audit: zero locally defined API types (`import type` from `@staynex/backend/types` only).

**Track A discoveries (recorded for the next engineer):**
- **Login revokes all other sessions** (`startSession(..., { revokeExisting: true })`): signing in on the phone signs the guest out on the web and vice versa. Deliberate posture, but a mobile UX consideration for Phase 2 (session messaging).
- **Local-dev DNS gotcha:** registration's email-deliverability check does a live MX lookup; on networks that block direct DNS from Node (ECONNREFUSED), every local registration fails. Start the backend with `NODE_OPTIONS="--require ./staynex-backend/scripts/dev-dns-shim.cjs" pnpm dev:backend`. Production (Railway) is unaffected.
- Harness lives at `staynex-mobile/test/phase1-booking-loop.mjs` — re-run it after any change to the client protocol or the booking loop. It books the furthest-out available nights to keep near-term inventory untouched and prints every row it creates.

**Track B — on-device (⏳ pending hardware):**
- [ ] SecureStore cookie persistence observed on device; session cold-start: kill the app, relaunch — `GET /auth/me` rehydrates with no re-login.
- [ ] Full happy path on-device through the real Paystack hosted page (test card), end to end (record it).
- [ ] Confirmed booking appears on the host web dashboard (`/host/bookings`) with correct dates, room, and amount (screenshot).
- [ ] Expired-hold UX: let a hold lapse on-screen → countdown hits zero, checkout stops, guest routed back to re-quote.
- [ ] Offline sweep: airplane-mode every screen — error state with retry; zero blank screens, zero crashes.
- [ ] `eas build --platform android --profile preview` exits 0; artifact installs and runs on a real device.

**Exit gate:** Track A harness prints `PHASE 1 GATE: PASS` against a running backend **and** Track B recording + host-dashboard screenshot + green build exist. *Measured by:* harness output + artifacts attached to the PR that closes the phase.

---

## Phase 1.5 — Hardening & parity

**Ships:** payment that feels native (the browser comes back on its own) and a
receipt in the guest's hand — the same trusted voucher + QR the web issues.

**SMART goal:** by **Wed 29 Jul 2026**, the in-app browser closes itself after
Paystack payment via deep link on 100% of test runs, and the confirmation screen
opens the voucher PDF and verify QR for a paid booking.

**Engineering track — ✅ machine-verified (harness 28/28, 2026-07-15):**
- [x] Mobile payment return: `POST /checkout` accepts `platform: "web" | "mobile"` (enum, never a URL — no redirect injection). `"mobile"` points Paystack's `callback_url` at the new API-served interstitial `GET /payments/:reference/mobile-return`, which deep-links `staynex://payment/<ref>`; web default untouched. Real Paystack test-mode initialize accepted the interstitial callback.
- [x] Interstitial hardening: reference validated (`^stx_[A-Za-z0-9]{8,64}$`) before any HTML is built — malformed input 404s with no reflection; `Cache-Control: no-store`; carries zero payment truth.
- [x] App scheme `staynex` registered in `app.config.ts` (was present); `bookingApi.checkout` now sends `platform: "mobile"`.
- [x] Occupancy parity: `OccupancySelector` (adults 1–20 / children 0–20 / infants 0–10, backend caps mirrored) on search, stay detail, quote, and hold; legacy `guests` dropped from request bodies (search still receives `guests = adults + children`, same as the web client); split verified persisted through hold → booking by the harness.
- [x] Confirmation links the voucher: "View receipt & check-in QR (PDF)" opens `GET /vouchers/:reference/pdf` (the canonical PDF with the embedded QR) for CONFIRMED bookings; harness verified the PDF renders and 404s for unpaid bookings.
- [x] Polling remains the source of truth — the deep link only closes the browser; the status screen still polls `GET /payments/:reference`.
- [x] Regression: full harness re-run after all changes — **PHASE 1 GATE PASS 28/28** (3 new Phase 1.5 checks included).

**Device track (⏳ pending hardware):**
- [ ] Three consecutive test payments auto-return to the app (`openAuthSessionAsync` resolves via the interstitial deep link, no manual dismissal) on Android + iOS. Note: the fixed `staynex://` scheme requires a dev-client or preview build — Expo Go uses the `exp://` scheme and won't auto-return.
- [ ] Voucher PDF opens from the confirmation screen on-device.

**Exit gate:** engineering track green (✅) + three consecutive auto-returns on a device + voucher opens from confirmation. *Measured by:* harness output + device test-run log in the PR.

---

## Phase 2 — The returning-guest app

**Ships:** the app becomes an account, not a funnel — guests see their trips,
manage their profile, and sign in with Google in two taps.

**SMART goal:** by **Fri 7 Aug 2026**, a returning guest can open Trips and see
every past/upcoming booking with live status, edit their profile, and a new user
can complete Google sign-in → booking without ever creating a password.

**Engineering track — ✅ machine-verified (Phase 2 harness 19/19, Phase 1 regression 28/28, 2026-07-15):**
- [x] Trips tab: guest booking history via the new session-scoped `GET /bookings` (backend `BookingsService.listGuestBookings`, `userId`-scoped, excludes HOLD, newest check-in first; reuses the shared `BookingView` mapper). Mobile `Trips` tab groups Upcoming/Past (presentation only — status/payment truth untouched), pull-to-refresh, loading/empty/error/signed-out states.
- [x] Trip detail (`trips/[id]`): full booking view + occupancy + "View receipt & check-in QR (PDF)" for CONFIRMED bookings + "Book this stay again".
- [x] Profile management: `account/profile` edits name/email/phone via existing `PATCH /auth/profile`; "Sign out other devices" via `POST /auth/sessions/revoke-others`.
- [x] Google sign-in: `expo-auth-session` ID-token flow (JS-only, Expo Go compatible) → existing `POST /auth/google`, on both login and register; hold-preserving `next` return preserved; degrades gracefully when `GOOGLE_CLIENT_ID` is unset.
- [x] Account deletion: `DELETE /auth/profile` behind a destructive confirm dialog (new `danger` Button variant).
- [x] All new screens ship loading/empty/error states; money audit clean; contract audit clean (zero local API types).
- [x] Harness: trips list scoping, cross-guest isolation (guest B never sees guest A's trip), `GET /bookings` requires a session (401 anonymous), profile update reflected in `/auth/me`, revoke-others never signs out the caller, and clean account deletion (no-booking + booking-owner) — see below.

**Track A discoveries (recorded for the next engineer):**
- **Account deletion is store-safe:** a guest who owns a CONFIRMED booking can still delete their account (`Booking.userId` is an optional relation → Prisma `SetNull`), and the immutable booking + voucher survive, detached (`userId → null`, keyed by `guestEmail`). No permanent-account trap. Harness verifies the booking still reads CONFIRMED and the voucher still issues after deletion.
- **Single active session (confirmed again):** every auth flow uses `revokeExisting: true`, so "Sign out other devices" typically revokes 0 rows. The kept invariant — and what the harness asserts — is that it *never signs out the current device*. Multi-device concurrent sessions would need a backend change to relax `revokeExisting` (out of scope).
- Harness refactored onto a shared `test/lib/harness.mjs` so the mobile-client protocol mirror lives in exactly one place; Phase 1 re-runs green (28/28) on the shared lib.

**Device track (⏳ pending hardware):**
- [ ] New-device demo: Google sign-in (needs `GOOGLE_CLIENT_ID` + a dev/preview build — Expo Go redirect differs), book a stay, see it in Trips, open its voucher; edit profile; delete account.

**Exit gate:** engineering track green (✅) + the on-device new-device demo recorded. *Measured by:* harness output + recording in the PR.

---

## Phase 3 — Push notifications

**Ships:** the phone taps the guest on the shoulder — booking confirmed and
check-in reminders arrive on the lock screen even when the app is closed.

**SMART goal:** by **Wed 12 Aug 2026**, a test booking triggers a
booking-confirmed push to a locked physical device within 60 seconds of webhook
receipt, and tapping it opens the booking.

- [ ] FCM device registration: capture the native token on grant, register via existing `POST /notifications/devices`, deregister on sign-out (`DELETE /notifications/devices/:token`).
- [ ] Notification permission prompt at the right moment (after first booking, not at first launch).
- [ ] Booking-confirmed and check-in-reminder (T-1) pushes received on a locked device; tap deep-links to the booking/trip detail.
- [ ] In-app inbox: reuse `GET /notifications` + `POST /notifications/read` for a simple notification list with unread badge.
- [ ] Dead-token pruning verified (uninstall → send → backend prunes on FCM 404/UNREGISTERED).

**Exit gate:** lock-screen push screenshot + deep-link open + inbox reflecting read state. *Measured by:* device screenshots in the PR.

---

## Phase 4 — Staynex AI on mobile

**Ships:** the concierge in your pocket — the same grounded, safety-gated
Staynex AI from the web, streaming natively, with verified property cards that
tap through to real stays.

**SMART goal:** by **Fri 21 Aug 2026**, a guest can hold a streamed AI
conversation on-device (SSE from `POST /ai/assistant/stream`), see verified
property cards rendered natively, and tap a card into the real stay detail —
with all web safety rules intact.

- [ ] SSE streaming client for `POST /ai/assistant/stream` (React Native needs an SSE polyfill or fetch-stream reader — validate first, same way Metro was validated in Phase 0).
- [ ] Conversation history: list/create/rename/pin/delete via existing `/ai/conversations` endpoints.
- [ ] Verified property cards rendered natively; tap → `stays/[slug]`.
- [ ] Feedback (👍/👎), retry, and edit-last-message — reuse the exact server contracts; no client-side divergence.
- [ ] Safety parity: the mobile client adds no prompt surface the web doesn't have; AI never asserts availability/payment truth (skill.md §11).
- [ ] Signed-out guests can chat; signed-in guests get scoped history.

**Exit gate:** side-by-side demo — same question on web and mobile produces equivalently grounded answers with working cards. *Measured by:* recorded comparison.

---

## Phase 5 — Owner Lite

**Ships:** hosts run their business from a phone — see bookings the moment they
land, check guests in via QR scan, and open/close availability on the go.

**SMART goal:** by **Fri 28 Aug 2026**, a host can sign in on mobile, view
today's bookings (`GET /host/bookings`), scan a guest's QR to the live verify
card, and adjust a room's availability for a date range — all against existing
endpoints.

- [ ] Capability-aware navigation: `OWNER` capability unlocks a Host tab (capabilities from `AuthUser`, never client-derived).
- [ ] Host bookings list + detail (existing `GET /host/bookings`, `GET /host/bookings/:id`).
- [ ] QR scan → open the verify card (`{APP_URL}/verify/<ref>` in-app) for reception-style check-in.
- [ ] Availability quick actions: open/close a date range via existing `PUT /availability/capacity` (mirror the web's 30/90-day quick actions; backend still guards booked/held inventory).
- [ ] Push for hosts: new-booking notification routes to host booking detail.

**Exit gate:** end-to-end host demo — booking arrives (push), host opens it, scans the guest QR at "check-in", closes a date. *Measured by:* recorded run.

---

## Phase 6 — Production deployment

**Ships:** Staynex on the store shelf — installable by real guests and hosts,
pointed at production, updatable over the air.

**SMART goal:** by **Fri 11 Sep 2026**, the Android app is live on the Play
Store production track (internal → closed → production) and the iOS app is in
TestFlight external testing or App Store review, both against the production
API with crash-free rate ≥ 99% across the test tracks.

- [ ] Production env profile: `STAYNEX_API_BASE_URL` → production Railway URL; verify CORS/cookie behaviour (native clients send no Origin — confirm prod middleware path).
- [ ] Release identity: app icons, splash, name, bundle ids (`com.staynex.app`), versioning + `eas.json` production profile.
- [ ] Crash + error reporting (Sentry for React Native or equivalent) wired before any external tester installs.
- [ ] EAS Update (OTA) configured for JS-only hotfixes; store builds only for native changes.
- [ ] Paystack live-mode smoke test: one real low-value booking end-to-end in production, refunded via admin afterwards (the existing refund flow is the test of that, too).
- [ ] Store compliance sweep: privacy policy URL, data-safety forms, account-deletion path, permission rationales (notifications, camera-for-QR).
- [ ] Play Store: internal testing → closed track (≥5 real testers, ≥1 week) → production rollout at 20% → 100%.
- [ ] App Store: TestFlight internal → external → submit for review.
- [ ] Launch monitoring: crash-free ≥ 99%, API error rate on mobile-originated requests within web baseline for 7 days post-launch.

**Exit gate:** store listing links live + monitoring dashboard green for 7 days. *Measured by:* store URLs and the dashboard.

---

## Standing rules (every phase)

- The backend stays the sole authority on availability, booking, and payment state; mobile renders truth, never derives it.
- Zero API-contract copies; zero client-side money math; every new screen ships loading/empty/error states.
- `pnpm --filter @staynex/mobile check` green before every commit; `expo-doctor` green before every build.
- Any new backend endpoint follows the module conventions in `MAIN-ARCHITECTURE.md` and is documented there in the same PR.
- A slipped gate moves the schedule; it never skips the gate.
