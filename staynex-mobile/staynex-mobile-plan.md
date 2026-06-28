# Staynex Mobile — Build Plan (React Native + Expo)

> Single source of truth for the Staynex native mobile app. Governed by `skill.md`.
> The backend (`staynex-backend`) remains the **only** authority for data, money,
> availability, and booking state. The mobile app is a thin, trustworthy client
> that **reuses what the backend already solves — it does not re-implement or
> re-encode it.**

- **Status:** Phase 0–1 ready to scaffold (Phase A payment settlement shipped on web ✓)
- **Owner:** Mobile track
- **Last updated:** 2026-06-25
- **Stack:** React Native via **Expo** (TypeScript), same language as web + API
- **Backend reused:** `staynex-backend` (NestJS 11, Prisma 6.19.3, CockroachDB), unchanged where possible
- **Companion docs:** `skill.md` (§2 north star, §3 booking loop, §4 architecture, §6 design, §7 contracts, §9 rules, §12 quality gate), `docs/architecture.md`, `docs/payment-settlement.md`

---

## 1. Why this document

Staynex already ships a web app (`staynex-frontend`) and a complete API
(`staynex-backend`). Mobile introduces **no second source of truth and no third
copy of anything**. It is built in React Native specifically so it can share the
team's existing TypeScript, the backend's API contracts, and the same one-way
architecture boundary the web app already follows.

Two duplication rules govern every decision in this plan:

1. **No re-implemented logic.** Pricing, availability, booking-state transitions,
   payment verification, and input validation are already solved in
   `staynex-backend`. The app calls endpoints and renders results. It never
   re-derives any of them on-device.
2. **No re-encoded contracts.** The canonical API types live in
   `staynex-backend/types` (skill.md §7). The mobile app **imports those types**
   — it does not hand-copy them into a TS mirror.

This is a deliberate **professional slice**: one foundation phase, then the
booking loop as a complete vertical slice, then account/reviews, then growth
surfaces. Each phase is **S.M.A.R.T.** — Specific deliverable, Measurable exit
gate, Achievable scope, Relevant to the north star, Time-boxed.

---

## 2. Backend audit — what mobile reuses

The API has **no global prefix**; routes are served from the host root. Auth is a
**session-only httpOnly cookie** (`staynex_session`, ~6-month TTL); there is no
bearer token or API key for clients. Native HTTP clients are not subject to
browser CORS, so the app authenticates by persisting and replaying that cookie
(see §3.1).

All money is integer **kobo**, currency **NGN**. The commission split (Phase A,
now live on web) means `grossAmountKobo = platformFeeKobo + ownerPayoutKobo`; the
mobile guest sees only the gross they pay — the split is an owner/admin concern.

**Cookie notes for native clients:**
- Cookie name: `staynex_session`
- Dev: `sameSite: "lax"`, `secure: false` — readable from any native HTTP client
- Production: `sameSite: "none"`, `secure: true` — requires the request to be
  HTTPS; `COOKIE_DOMAIN` env var scopes the domain

### 2.1 Endpoints the app consumes (verified against controllers)

| Capability | Method & path | Auth | Contract (`staynex-backend/types/api.ts`) |
|---|---|---|---|
| City list for picker | `GET /catalog/cities` | none | `CityOption[]` |
| Search stays | `GET /search?city=&area=&checkIn=&checkOut=&guests=` | none | `PropertySummary[]` |
| Stay detail | `GET /stays/:slug` | none | `PropertyDetail` |
| Areas for a city | `GET /areas?city=` | none | `AreaOption[]` |
| Room availability | `GET /availability/room-types/:roomTypeId?from=&to=` | none | `AvailabilityDay[]` |
| Price + availability quote | `POST /bookings/quote` | none | `AvailabilityQuote` |
| Create hold | `POST /bookings/holds` | optional | `HoldSummary` |
| Read hold | `GET /bookings/holds/:id` | none | `HoldSummary` |
| Checkout (start payment) | `POST /checkout` | **required** | `CheckoutResult` (`authorizationUrl`) |
| Booking detail | `GET /bookings/:id` | none* | `BookingView` |
| Payment status (re-syncs Paystack) | `GET /payments/:reference` | none | `PaymentStatusView` |
| Register (guest) | `POST /auth/register` | none | `AuthUser` (+ `Set-Cookie`) |
| Register (owner) | `POST /auth/owner/register` | none | `AuthUser` (+ `Set-Cookie`) |
| Login | `POST /auth/login` | none | `AuthUser` (+ `Set-Cookie`) |
| Google sign-in | `POST /auth/google` | none | `AuthUser` (+ `Set-Cookie`); body: `{ idToken, intent? }` |
| Forgot password | `POST /auth/password/forgot` | none | generic `{ ok }` (no account enumeration) |
| Reset password | `POST /auth/password/reset` | none | `{ ok }` |
| Current user | `GET /auth/me` | cookie | `AuthUser \| null` |
| Update / delete profile | `PATCH /auth/profile` · `DELETE /auth/profile` | cookie | `AuthUser` / `{ ok }` |
| Logout | `POST /auth/logout` | cookie | `{ ok }` (clears `Set-Cookie`) |
| Public testimonials | `GET /reviews?propertySlug=&limit=` | none | `PublicTestimonial[]` |
| Review context / submit | `GET /reviews/booking/:id/context` · `POST /reviews/booking/:id` | cookie | `BookingReviewContext` / review |
| Staynex AI ask | `POST /ai/assistant` | optional | `AssistantReply` |
| AI conversations CRUD | `GET/POST /ai/conversations`, `GET …/:id/messages`, `PATCH/POST(pin)/DELETE …/:id` | optional | `AgentConversation` / `AgentMessage[]` |
| Owner properties | `GET/POST /owner/properties`, `GET/PATCH /owner/properties/:id`, `POST …/:id/submit` | owner | property contracts |
| Owner bookings | `GET /owner/bookings…` | owner | `OwnerBookingsView` |
| Set capacity | `PUT /availability/capacity` | owner | availability |
| Signed media upload | `POST /owner/media/upload-url` then `PUT` to target | owner | `MediaUploadTarget` |

\* `GET /bookings/:id` is currently unauthenticated by id (cuid). Mobile treats
the booking id as a capability token and never enumerates other users' bookings
client-side. **Open question O-3** tracks tightening this server-side.

### 2.2 Key contract shapes (from `staynex-backend/types/api.ts`)

```typescript
// Auth — capabilities field added (always includes "GUEST")
AuthUser { id, email, name, phone, role, capabilities: AppCapability[] }

// Booking loop
AvailabilityQuote { roomTypeId, propertyName, roomName, checkIn, checkOut,
                    nights, available, nightlyPriceKobo, totalKobo, currency }
HoldSummary       { holdId, roomTypeId, propertyName, roomName, checkIn,
                    checkOut, nights, nightlyPriceKobo, totalKobo, currency,
                    expiresAt, expired }
CheckoutResult    { bookingId, reference, authorizationUrl }
PaymentStatusView { reference, paymentStatus, bookingId, bookingStatus }
BookingView       { id, status, checkIn, checkOut, nights, amountKobo,
                    currency, propertyName, propertySlug, cityName, roomName,
                    paymentStatus, paymentReference }

// Owner KPIs (Phase A accounting)
OwnerBookingKpis  { confirmedBookings, pendingPayments, availableRooms,
                    netEarningsKobo, pendingPayoutKobo, currency }
```

### 2.3 The booking loop (skill.md §3) mapped to the app

```
Search ─▶ Stay detail ─▶ Select room ─▶ Quote ─▶ Hold ─▶ Sign in ─▶ Checkout ─▶ Poll status ─▶ Confirmed ─▶ Trip + Review
 /search   /stays/:slug    (detail)   /bookings  /bookings  /auth     /checkout   /payments     /bookings    /reviews
                                       /quote     /holds               (authorizationUrl) /:reference  /:id
```

This loop is the product. It is built end-to-end in **Phase 1** before any
secondary surface is polished.

### 2.4 Non-negotiables the client must honor (skill.md §9)

- No confirmed booking without verified payment — the app **shows** state from
  `/payments/:reference` and `/bookings/:id`; it never sets it.
- Holds expire — surface `HoldSummary.expiresAt`/`expired`, re-quote on expiry.
- Never store raw card data — payment happens in Paystack's hosted flow.
- AI must not promise availability/refunds/confirmations — reuse server guardrails;
  the app renders `AssistantReply.refused`/`unavailable` honestly.
- Money is kobo — format to NGN at the edge only; never do pricing math on-device.
- `capabilities` drives access decisions, not `role` alone.

---

## 3. Architecture & stack decisions

| Concern | Decision | Rationale |
|---|---|---|
| Framework | **React Native via Expo (SDK current), TypeScript** | Same language as web + API; reuses team skill and contracts |
| Routing | **Expo Router** (file-based) | Mirrors Next.js App Router patterns the team already knows |
| Data fetching | **TanStack Query** | Caching, retries, request/refetch lifecycle for the booking loop |
| Local state | **Zustand** (light) | Minimal client state (session, draft booking) |
| Networking | **fetch wrapper** + interceptors | Cookie session, error mapping to shared error shapes |
| Session persistence | **@react-native-cookies/cookies** + **expo-secure-store** | Reuses backend cookie auth with **zero backend change** |
| Models / contracts | **Imported `import type` from `staynex-backend/types`** | Single source of truth — **no re-encoding** (see §3.2) |
| Config | Expo **app config + EAS env** (`STAYNEX_API_BASE_URL`, `GOOGLE_CLIENT_ID`) | No secrets in source; matches "no hardcoding" rule |
| Design system | Theme from skill.md §6 brand tokens (shared tokens, see §3.2) | Premium, calm, mobile-first; WCAG 2.2 AA |
| Payments | Open `authorizationUrl` in `expo-web-browser`, poll `/payments/:reference` | Paystack hosted flow; no card data on device |
| Push | **Firebase Cloud Messaging** (via Expo) | Phase 3 — matches backend `FCM_SERVER_KEY`/`FIREBASE_PROJECT_ID` foundation |
| Builds / iOS | **EAS Build** (cloud) | Ships iOS from a Windows dev host — no local Mac required |

### 3.2 Single source of truth — how we avoid duplication

The canonical API contracts already exist as **pure, erasable TypeScript**
(`staynex-backend/types/api.ts` — types/interfaces only, no runtime, no Prisma).
`staynex-backend/types/index.ts` re-exports from `api.ts`.

**Mechanism:**

1. **Expose the contracts as a type-only package entry.** Add an `exports` map to
   `staynex-backend/package.json` for `./types` pointing at `./types/index.ts`. No
   build output needed — declarations only. Metro never resolves these because they
   are `import type` only.
2. **Mobile imports them with `import type` only.** `import type` is erased at
   compile time; Metro never sees the import at bundle time. `tsc` validates the
   types. The one-way boundary holds: `mobile → contracts ← backend`.
3. **Shared runtime helpers** that web and mobile both need (kobo→NGN formatter,
   status label maps, brand tokens) live in `packages/shared` (`@staynex/shared`),
   consumed by both clients.

### 3.3 Repo & workspace placement

```yaml
# pnpm-workspace.yaml additions
packages:
  - "staynex-frontend"
  - "staynex-backend"
  - "staynex-mobile"    # new
  - "packages/*"        # new (for @staynex/shared)
```

**Known consideration:** Metro + pnpm's symlinked `node_modules` needs explicit
watch-folder and resolver config in `metro.config.js`. Validated in Phase 0
before any other work continues.

**Auth approach:** persistent cookie jar — no backend edits. The `staynex_session`
cookie is stored via `expo-secure-store` and replayed on every request via manual
`Cookie:` header. `@react-native-cookies/cookies` handles the jar automatically
if used with a `fetch`-compatible wrapper; otherwise a lightweight manual approach
in the fetch client works equivalently.

### 3.4 Project layout

```
staynex-mobile/                 # @staynex/mobile (Expo Router app)
  app/                          # file-based routes (Expo Router)
    (auth)/                     # login, register, forgot-password
    (tabs)/                     # search, stays, trips, account
    stays/[slug]/               # property detail
    booking/[holdId]/           # quote → checkout flow
    payment/[reference]/        # payment status + confirmation
  src/
    core/                       # fetch client, cookie/session store, env, error types
    data/                       # API service fns + TanStack Query hooks
    features/                   # search, stay, booking, account, reviews, agent, owner
    ui/                         # PropertyCard, PriceTag, StatusPill, empty/error/loading
  app.config.ts                 # Expo config + EAS env wiring
  eas.json                      # EAS build/submit profiles
  metro.config.js               # pnpm monorepo resolver + watch folders

packages/shared/                # @staynex/shared (zero-dep runtime helpers)
  src/
    money.ts                    # koboToNGN formatter
    labels.ts                   # BookingStatus, PaymentState, PayoutStatus labels
    tokens.ts                   # brand design tokens (skill.md §6)
  package.json
  tsconfig.json
```

---

## 4. Phased plan (S.M.A.R.T.)

### Phase 0 — Foundation, contracts wiring & connectivity spike · ~1 week

- **Specific:** Scaffold the Expo app, establish the shared-type + shared-helper
  boundary (zero duplication), wire cookie-session networking, and prove a live
  call to the deployed API.
- **Deliverables:**
  - `pnpm-workspace.yaml` updated; `packages/shared` bootstrapped with `money.ts`,
    `labels.ts`, `tokens.ts`
  - `staynex-backend/package.json` — `exports` map for `./types` (type-only,
    no build output)
  - Expo Router skeleton (§3.4); `@staynex/mobile` package wired into workspace
  - `src/core/client.ts` — fetch wrapper with manual `Cookie:` header + `Set-Cookie`
    capture via `expo-secure-store`; auth error (401) surfaces cleanly
  - `src/core/env.ts` — `STAYNEX_API_BASE_URL`, `GOOGLE_CLIENT_ID` from EAS config
  - `metro.config.js` — pnpm symlink resolution + watch folders for workspace packages
  - `app.config.ts` + `eas.json` — dev/preview/production profiles, no secrets in source
  - One live screen: `GET /search?city=Calabar` renders real `PropertySummary[]`
    typed straight from `@staynex/backend/types`
  - CI: `tsc --noEmit`, `eslint`, `expo-doctor` all pass
- **Measurable exit gate:** EAS build succeeds for Android AND iOS; app cold-starts;
  renders ≥1 live `PropertySummary` with types from `@staynex/backend/types` (no
  local copy); `tsc` clean; `expo-doctor` clean.
- **Relevant:** locks in backend-as-truth + zero-duplication before any UX work.
- **Risks:** Metro/pnpm symlink resolution — validate on day one before anything else.

### Phase 1 — Guest booking loop MVP (the north star) · ~2–3 weeks

- **Specific:** Complete vertical slice from search to confirmed booking, against
  live endpoints, with real Paystack test-mode payment.
- **Deliverables (each maps to §2.1):**
  - **Search:** city picker from `GET /catalog/cities`; optional area from
    `/areas?city=`; check-in / check-out date pickers; guest count; → `/search`
  - **Results:** `PropertyCard` list (cover image, name, city, from-price kobo→NGN,
    status badge); empty + error + loading states
  - **Stay detail:** `/stays/:slug`; media gallery; room types with `maxGuests`,
    `basePriceKobo`; per-room availability calendar (`/availability/room-types/:id`)
  - **Quote → Hold:** `POST /bookings/quote` → `POST /bookings/holds`; show
    `totalKobo` as NGN; surface `expiresAt` countdown; re-quote if expired
  - **Auth gate before pay:** if not signed in, redirect to register/login; register
    sets session cookie; `POST /auth/register` body: `{ email, password, name?,
    role: "GUEST" }`; hold survives the redirect (holdId stored in navigation state
    or secure store)
  - **Checkout:** `POST /checkout` with `{ holdId, email }` → open `authorizationUrl`
    via `expo-web-browser`; handle deep-link return OR fallback poll
  - **Payment status:** poll `GET /payments/:reference` on an interval; show
    INITIATED/PENDING/SUCCESS/FAILED states; never set CONFIRMED client-side; on
    SUCCESS navigate to confirmation
  - **Confirmation:** `GET /bookings/:id` → `BookingView`; show dates, property,
    amounts; clear the checkout draft state
  - Error, empty, loading states on every screen
- **Measurable exit gate:** a real test booking transitions
  `HOLD → PENDING_PAYMENT → CONFIRMED` via Paystack test mode and appears on the
  owner's web dashboard; expired-hold and failed-payment paths render correctly;
  no confirmed state is ever set client-side.
- **Relevant:** this *is* the product. Nothing else ships until it works.
- **Risks:** Paystack return/deep-link handling on iOS/Android — validate early;
  always fall back to status polling.

### Phase 2 — Account, trips & reviews · ~1–2 weeks

- **Specific:** Persistent identity, profile CRUD, trip history, and post-stay reviews.
- **Deliverables:** auto-login via stored session (`/auth/me`); Google sign-in
  (`POST /auth/google`, body: `{ idToken, intent? }`); password reset flow
  (`/auth/password/forgot` + `/auth/password/reset`); profile edit/delete; "My trips"
  from booking history; leave a review (`/reviews/booking/:id/context` then `POST`).
- **Measurable exit gate:** returning user is auto-signed-in; profile update and
  account delete succeed (delete clears session + routes home); a review submits
  as `PENDING_REVIEW`; signed-out state handled gracefully everywhere.
- **Relevant:** trust + retention around the booking loop.

### Phase 3 — Push notifications (FCM) · ~1 week

- **Specific:** Deliver booking-confirmed (guest) push via Firebase, reusing the
  backend's `FCM_SERVER_KEY`/`FIREBASE_PROJECT_ID` env foundation.
- **Deliverables:** Firebase + Expo push setup; device-token registration;
  foreground/background handling; deep-link from notification to the booking.
  **Backend touch (additive, flagged):** a `POST /notifications/device` endpoint +
  device-token persistence may be required. If it needs a Prisma model, the schema
  change will be **reported and not pushed to live DB without explicit approval**.
- **Measurable exit gate:** a confirmed booking in test mode delivers a push to a
  real device and deep-links to the booking detail.

### Phase 4 — Staynex AI in-app · ~1 week

- **Specific:** Embed Staynex AI reusing `/ai` endpoints with identical safety posture.
- **Deliverables:** chat panel; suggested prompts; conversation history for
  signed-in users; honest rendering of `refused`/`unavailable`/`groundedFacts`.
- **Measurable exit gate:** AI answers grounded questions, **refuses** unsafe asks,
  and history persists across sessions for signed-in users.

### Phase 5 — Owner Lite (mobile) · ~2 weeks · *post-MVP, optional*

- **Specific:** Give owners on-the-go visibility and light control; admin stays web-only.
- **Deliverables:** owner bookings + KPIs (`/owner/bookings`); quick capacity edit;
  property photo upload via signed targets. Owner registration via
  `POST /auth/owner/register` body: `{ email, password, name? }`.
- **Measurable exit gate:** owner sees live bookings, sets capacity, uploads a photo
  that appears on the listing.

### Phase 6 — Hardening, store readiness & launch · ~1–2 weeks

- **Specific:** Production-quality polish and store submission.
- **Deliverables:** error/empty/offline states everywhere; accessibility pass
  (WCAG 2.2 AA, dynamic type, contrast, screen-reader labels); NGN formatting via
  `@staynex/shared`; app icon/splash; crash analytics (opt-in); legal links; release
  signing via EAS; beta via TestFlight + Play internal track.
- **Measurable exit gate:** passes internal store-readiness checklist; crash-free
  sessions ≥ 99% in beta; booking-loop integration test green on CI.

---

## 5. Cross-cutting standards (apply every phase)

- **Backend is truth.** No business rule, price math, availability decision, or
  booking/payment state lives on-device. The app reads state; the API owns it.
- **No duplication.** Contracts from `@staynex/backend/types` (`import type`,
  one-way); runtime helpers from `@staynex/shared`; logic in backend services.
- **Security.** Session cookie in `expo-secure-store`; no secrets in source (EAS
  env); HTTPS only in production; never log tokens or PII.
- **Design.** Brand tokens from `@staynex/shared/tokens` (skill.md §6); cards for
  properties/rooms/bookings; motion clarifies state only; mobile-first; WCAG 2.2 AA.
- **Testing.** Unit tests for shared helpers and fetch client; component tests for
  key screens (all states); one integration test for the booking-loop golden path.
- **Definition of Done (per phase):** exit gate met · `tsc`/lint clean · tests
  green on CI · no client-trusted financial/availability state · no new contract
  copy introduced.

---

## 6. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Metro + pnpm symlink resolution | App won't bundle in monorepo | Configure Metro resolver in Phase 0, day one — blocked if unresolved |
| Cookie-session fragility on native clients | Auth breaks after app restart | `expo-secure-store` jar; `/auth/me` revalidation on cold start |
| Paystack return/deep-link on mobile | Stuck checkout | Validate return handling Phase 1; fall back to polling `/payments/:reference` |
| `GET /bookings/:id` unauthenticated | Privacy | Treat id as capability token; tighten server-side (O-3); never enumerate |
| Contract drift if someone re-copies types | Reintroduces duplication | PR rule: mobile + web import `@staynex/backend/types`; no local redefinition |
| Scope creep beyond the loop | Slipped MVP | SMART gates; secondary surfaces blocked until Phase 1 gate is green |
| Production cookie (`sameSite: "none"`) requires HTTPS | Auth breaks in non-HTTPS test env | Ensure dev API is also accessible over HTTP; fetch client config per env |

---

## 7. Open questions

- **O-1 — Auth transport:** cookie jar (default, zero backend change) is the
  approach. Bearer-token fallback deferred unless cookie persistence proves fragile.
- **O-2 — Push backend surface:** confirm `POST /notifications/device` endpoint and
  whether a Prisma model is needed (additive; not pushed without approval).
- **O-3 — Booking read authorization:** should `GET /bookings/:id` require the
  owning session? Recommended before public launch.
- **O-4 — Shared package scope:** confirm `@staynex/shared` (money/labels/tokens)
  as the runtime-helpers home. Web app keeps its `lib/types.ts` hand-copy for now;
  migrating it to `@staynex/backend/types` is a low-risk bonus task.
- **O-5 — Min OS targets:** propose iOS 16+ / Android 9 (API 28+).

---

## 8. Immediate next step

**Phase 0 is approved to scaffold.** See `staynex-mobile/PHASE-0-1-AGENT-PROMPT.md`
for the production-grade agent prompt covering Phase 0 + Phase 1 end-to-end.
