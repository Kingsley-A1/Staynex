# Staynex plan.md

## Mission
Build an international hospitality booking platform originating in Calabar.

Staynex is not a Calabar-only platform. Calabar is the launch wedge. The architecture must support city-by-city, country-by-country expansion.

## Current Phase
**Mobile v0.1 — take the proven web booking loop native.**

The web POC is complete and has grown into a production platform (see `MAIN-ARCHITECTURE.md`): full guest booking loop with Paystack, host workspace, admin console, Staynex AI, notifications/push, and voucher/QR verification, deployed on Vercel + Railway.

The current focus is `staynex-mobile/` (Expo + React Native, staged on the `staynex-mobile-staging` branch): finish Phase 0 (foundation + connectivity) and Phase 1 (guest booking loop end-to-end in Paystack test mode). See **Mobile App Workstream** below for the stage review and the exact path.

## Product Principles
- Real booking engine before decorative features.
- Local wedge, international architecture.
- Secure by default, low-friction by design.
- Card-based, mobile-first, clean and seamless UI.
- Real-time availability and future reservation support.
- AI as assistance, not financial authority.
- Admin visibility from Day 1.
- Daily vertical slices.

## Core Stack
- Web: Next.js + TypeScript
- Mobile: Expo (React Native) + TypeScript — Expo Router, TanStack Query, Zustand
- API: NestJS + TypeScript
- Database: CockroachDB
- Storage: Cloudflare R2
- Web deployment: Vercel
- Mobile distribution: EAS builds (test track first)
- API deployment: Railway
- AI: Google Gemini + Vercel AI SDK
- Maps: Google Maps
- Auth: Google OAuth + email auth
- Notifications: Firebase Cloud Messaging
- Email: Resend
- Payments: Paystack first
- Support automation: Respond.io later

## Monorepo Structure
```txt
staynex/
  staynex-frontend      Next.js web app
    src/

  staynex-backend       NestJS API (sole authority for booking/payment truth)
    src/
    prisma/
    db/
    types/              Canonical API contracts (@staynex/backend/types)
    config/

  staynex-mobile        Expo app (staged on staynex-mobile-staging)
    app/                Expo Router screens
    src/

  packages/
    shared/             @staynex/shared — money formatter, status labels, brand tokens

  docs/
```

## POC Acceptance Criteria — COMPLETE (web)
- [x] Guest can search by city and date.
- [x] Guest can view property cards.
- [x] Guest can swipe room/property images.
- [x] Guest can check availability.
- [x] Guest can create a booking hold.
- [x] Guest can pay using Paystack test mode.
- [x] Payment webhook confirms booking.
- [x] Guest receives confirmation email.
- [x] Owner sees booking in dashboard and gets a push notification.
- [x] Admin sees booking, payment, owner, and property.
- [x] Booking flow works cleanly on mobile (responsive web).

## Workstreams

### 1. Design System — COMPLETE (web)
- [x] Colors, typography, spacing tokens (`staynex-frontend/src/styles/theme.css`; mirrored for native in `@staynex/shared` tokens).
- [x] Card component, carousel behavior.
- [x] Loading, empty, error, and success states.

### 2. Database — COMPLETE
All planned entities exist in `staynex-backend/prisma/schema.prisma` (User through AIActionLog), plus Session, MfaChallenge, Area, PaymentEvent, Testimonial, DeviceToken, and others added as the platform matured.

### 3. Backend Modules — COMPLETE
All twelve planned modules exist and are live (Auth, Users, Properties, Rooms, Availability, Bookings, Payments, Notifications, Media, Admin, Ai, Audit — see `MAIN-ARCHITECTURE.md` §9 for the full endpoint map).

### 4. Public Web — COMPLETE
Home, search, property/room detail, checkout, payment status, confirmation, and marketing/legal pages are all live.

### 5. Owner (Host) Dashboard — COMPLETE
Onboarding, properties, rooms, media upload, availability, bookings, earnings, payout method, and settings are live under `/host/*`.

### 6. Admin Dashboard — COMPLETE
Overview KPIs, property approval, money ops (payments, exceptions, refunds, payouts), users, audit logs, and AI logs are live under `/admin/*`.

---

## Mobile App Workstream — CURRENT FOCUS

### Stage review (2026-07-14, `staynex-mobile-staging`)

**Where mobile stands vs the website:** the website is a full production platform; the mobile app is a well-built Phase 0/1 scaffold (~3,100 lines) covering only the guest booking loop — and it has **not yet run end-to-end**. Roughly: the guest loop is ~80% coded and 0% verified; everything else on the web surface (trips, vouchers, push, AI, host tools, admin) does not exist on mobile yet.

What is already good in `staynex-mobile/`:
- Correct architecture: zero API-contract copies (`import type` from `@staynex/backend/types`), zero client-side money math (all via `@staynex/shared`), zero client-side booking state, three-state (loading/empty/error) screens throughout.
- Screens staged: search, stay detail (gallery, rooms, availability), quote → hold (with expiry countdown and expired-hold stop), auth gate (login/register modals with `next` return), checkout (Paystack hosted flow), payment status polling (3s interval, 10-min timeout, honest terminal states), confirmation, account.
- Session model matches the backend: cookie captured from `Set-Cookie`, persisted in `expo-secure-store`, replayed as a `Cookie:` header, rehydrated on cold start via `GET /auth/me`.
- `packages/shared` exists (money/labels/tokens) and `staynex-backend/package.json` exports `./types`.

### P0 blockers (nothing ships until these are fixed)

1. **Workspace registration missing.** `pnpm-workspace.yaml` lists `packages/*` but not `staynex-mobile`, so its `workspace:*` dependencies (`@staynex/shared`, `@staynex/backend`) cannot install and `tsc`/`expo-doctor` cannot run.
2. **CSRF will 403 every mobile write.** The backend requires the `staynex_csrf` cookie + `X-CSRF-Token` header on **all** mutating requests (only the Paystack webhook is exempt — `staynex-backend/src/common/security.ts`). The mobile client never fetches `GET /auth/csrf` or sends the header, so login, register, quote, hold, and checkout will all fail with 403. Fix belongs in `staynex-mobile/src/core/client.ts` (bootstrap the token, capture the `staynex_csrf` cookie, replay both); no backend change needed.
3. **Paystack return UX.** The backend always sets `callback_url` to the web `{APP_URL}/payment/status`, so the in-app browser never redirects to the app scheme and `openAuthSessionAsync` only resolves when the guest closes it manually. Polling still resolves truth, so this is Phase 1 hardening: either a deep-link-aware callback (backend accepts a mobile return hint) or an interstitial web page that deep-links back.

### Parity gaps (known, scheduled — not blockers)
- Occupancy selector: web sends adults/children/infants; mobile sends legacy `guests` (backend derives `adults = guests`, so it validates).
- No trips/booking history, no voucher (PDF/QR) access, no push notifications, no Staynex AI, no Google sign-in, no host tools.

### Focus path (in order — do not skip gates)

> Execution detail, SMART goals, target dates, and per-phase exit gates live in
> **`staynex-mobile/IMPLEMENTATION-CHECKLIST.md`** — tick work off there. The
> outline below is the summary.

**Phase 0 exit — make it run (immediate):**
- [x] Add `staynex-mobile` to `pnpm-workspace.yaml`; `pnpm install` resolves `workspace:*` deps.
- [x] Add CSRF bootstrap to the mobile fetch client (blocker 2).
- [x] `pnpm --filter @staynex/mobile check` (tsc) passes; `expo-doctor` passes 18/18.
- [ ] Cold start on an emulator; live `GET /search?city=Calabar` renders real data from the local API.

**Phase 1 exit — prove the loop (next):**
- [ ] Full booking loop in Paystack test mode: search → stay → quote → hold → sign in → checkout → payment → CONFIRMED.
- [ ] Expired-hold path and failed-payment path exercised and honest.
- [ ] The confirmed booking appears on the host web dashboard (`/host/bookings`).
- [ ] EAS preview build (Android) succeeds and installs.

**Phase 1.5 — hardening & parity:**
- [ ] Occupancy split (adults/children/infants) on mobile search/quote/hold.
- [ ] Mobile payment return (deep link or interstitial) so the browser closes itself.
- [ ] Confirmation screen links the voucher (PDF + QR verify URL — endpoints already exist).

**Phase 2 — guest account depth:** trips (booking history), profile management, Google sign-in.

**Phase 3 — push:** FCM device registration reusing `POST /notifications/devices`; booking-confirmed and check-in-reminder notifications on device.

**Phase 4 — Staynex AI on mobile:** reuse `/ai/assistant/stream` (SSE) with the same safety rules as web.

**Phase 5 — Owner Lite:** host bookings view and availability quick-actions on mobile.

Reference: the full Phase 0/1 specification lives in `staynex-mobile/PHASE-0-1-AGENT-PROMPT.md`.

---

## Weeks 1–4 (historical — web POC, completed)
The original Week 1–4 web POC plan was executed in full: monorepo, design tokens, owner onboarding, property/room/media setup, admin approval, availability, search, holds, checkout, Paystack, webhook verification, confirmation, Resend email, owner/admin dashboards, and the AI assistant prototype all shipped and have since been hardened well beyond POC scope.

## Key Engineering Rules
- Booking creation must be transactional.
- No confirmed booking without payment verification.
- No stale availability after checkout begins.
- Every admin override must write to AuditLog.
- AI must not promise availability, refunds, or financial actions without platform verification. AI should be Tool first.
- Mobile is a client of the same API: no contract copies, no client-side money math, no client-side booking state. The web rules apply natively.
- The web loop is proven; mobile work must not fork business logic into the app.
