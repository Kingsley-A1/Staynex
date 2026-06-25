# Staynex Mobile — Build Plan (React Native + Expo)

> Single source of truth for the Staynex native mobile app. Governed by `skill.md`.
> The backend (`staynex-backend`) remains the **only** authority for data, money,
> availability, and booking state. The mobile app is a thin, trustworthy client
> that **reuses what the backend already solves — it does not re-implement or
> re-encode it.**

- **Status:** Planning
- **Owner:** Mobile track
- **Last updated:** 2026-06-25
- **Stack:** React Native via **Expo** (TypeScript), same language as web + API
- **Backend reused:** `staynex-backend` (NestJS + Prisma + CockroachDB), unchanged where possible
- **Companion docs:** `skill.md` (§2 north star, §3 booking loop, §4 architecture, §6 design, §7 contracts, §9 rules, §12 quality gate), `docs/architecture.md`

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
   — it does not hand-copy them into a Dart/TS mirror. This plan also retires the
   web app's existing hand-copy as a bonus de-duplication.

This is a deliberate **professional slice**, not an exhaustive backlog: one
foundation phase, then the booking loop as a complete vertical slice, then
account/reviews, then growth surfaces. Each phase is **S.M.A.R.T.** — Specific
deliverable, Measurable exit gate, Achievable scope, Relevant to the north star,
Time-boxed.

---

## 2. Backend audit — what mobile reuses

The API has **no global prefix**; routes are served from the host root. Auth is a
**session-only httpOnly cookie** (`staynex_session`, ~6-month TTL); there is no
bearer token. Native HTTP clients are not subject to browser CORS, so the app
authenticates by persisting and replaying that cookie (see §3.1). All money is
integer **kobo**, currency **NGN**.

### 2.1 Endpoints the app consumes (verified against controllers)

| Capability | Method & path | Auth | Contract (`staynex-backend/types/api.ts`) |
|---|---|---|---|
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
| Register / Login / Google | `POST /auth/register` · `/auth/login` · `/auth/google` | none | `AuthUser` (+ Set-Cookie) |
| Current user | `GET /auth/me` | cookie | `AuthUser \| null` |
| Update / delete profile | `PATCH /auth/profile` · `DELETE /auth/profile` | cookie | `AuthUser` / `{ ok }` |
| Logout | `POST /auth/logout` | cookie | `{ ok }` |
| Public testimonials | `GET /reviews?propertySlug=&limit=` | none | `PublicTestimonial[]` |
| Review context / submit | `GET /reviews/booking/:id/context` · `POST /reviews/booking/:id` | cookie | `BookingReviewContext` / review |
| Staynex Agent ask | `POST /ai/assistant` | optional | `AssistantReply` |
| Agent conversations CRUD | `GET/POST /ai/conversations`, `GET …/:id/messages`, `PATCH/POST(pin)/DELETE …/:id` | optional | `AgentConversation` / `AgentMessage[]` |
| Owner properties | `GET/POST /owner/properties`, `GET/PATCH /owner/properties/:id`, `POST …/:id/submit` | owner | property contracts |
| Owner bookings | `GET /owner/bookings…` | owner | `OwnerBookingsView` |
| Set capacity | `PUT /availability/capacity` | owner | availability |
| Signed media upload | `POST /media/...` then `PUT` to target | owner | `MediaUploadTarget` |

\* `GET /bookings/:id` is currently unauthenticated by id (cuid). Mobile treats
the booking id as a capability token and never enumerates other users' bookings
client-side. **Open question O-3** tracks tightening this server-side.

### 2.2 The booking loop (skill.md §3) mapped to the app

```
Search ─▶ Stay detail ─▶ Select room ─▶ Quote ─▶ Hold ─▶ Sign in ─▶ Checkout(Paystack) ─▶ Poll status ─▶ Confirmed ─▶ Trip + Review
 /search   /stays/:slug    (detail)   /bookings  /bookings  /auth     /checkout            /payments      /bookings    /reviews
                                       /quote     /holds               (authorizationUrl)   /:reference     /:id
```

This loop is the product. It is built end-to-end in **Phase 1** before any
secondary surface is polished (skill.md §3, §12).

### 2.3 Non-negotiables the client must honor (skill.md §9)

- No confirmed booking without verified payment — the app **shows** state from
  `/payments/:reference` and `/bookings/:id`; it never sets it.
- Holds expire — surface `HoldSummary.expiresAt`/`expired`, re-quote on expiry.
- Never store raw card data — payment happens in Paystack's hosted flow.
- AI must not promise availability/refunds/confirmations — reuse server guardrails;
  the app renders `AssistantReply.refused`/`unavailable` honestly.
- Money is kobo — format to NGN at the edge only; never do pricing math on-device.

---

## 3. Architecture & stack decisions

Chosen for maximum reuse of the existing TypeScript/React/NestJS investment and
zero contract duplication.

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
| Push | **Firebase Cloud Messaging** (via Expo) | Matches backend `NotificationChannel.PUSH` foundation |
| Builds / iOS | **EAS Build** (cloud) | Ships iOS from a Windows dev host — no local Mac required |

### 3.2 Single source of truth — how we avoid duplication

The canonical API contracts already exist and are **pure, erasable TypeScript**
(`staynex-backend/types/api.ts` + `index.ts` — types/interfaces only, no runtime,
no Prisma). Today the web app hand-copies them into
`staynex-frontend/src/lib/types.ts`. We do **not** add a third copy for mobile.

**Mechanism:**

1. **Expose the contracts as a type-only package entry.** Add an `exports`
   (and `typesVersions`) map to `@staynex/backend` for `./types`, so consumers
   resolve `@staynex/backend/types`. No build output is required — these are
   declarations only.
2. **Mobile imports them with `import type` only.** Because `import type` is
   erased at compile time, Metro (the RN bundler) never resolves or bundles any
   backend code — only `tsc` resolves the symbols via the workspace. The one-way
   boundary holds: `mobile → contracts ← backend`, never `mobile → backend
   internals/services/Prisma` (skill.md §7, `docs/architecture.md`).
3. **Retire the web hand-copy (bonus de-dup).** Point
   `staynex-frontend/src/lib/types.ts` at the same `@staynex/backend/types`
   import. Additive, mechanical, low-risk — done as a flagged side task, not a
   blocker for mobile.
4. **Shared runtime helpers** that web and mobile both need (status/role label
   maps, the kobo→NGN money formatter, brand design tokens) move into a minimal
   zero-dependency package **`@staynex/shared`**, consumed by both clients. This
   is the *only* new shared code, and it exists precisely to prevent the labels
   and formatter from being written twice.

Net effect: **types written once (backend), helpers written once (`@staynex/shared`),
business logic written once (backend services).** The app is glue + UI.

### 3.3 Repo & workspace placement

Unlike a Dart project, an Expo/TypeScript app is a natural pnpm workspace member,
which is what makes the type sharing above free:

- Add `staynex-mobile` (and `packages/shared`) to `pnpm-workspace.yaml`.
- Package name **`@staynex/mobile`**; it `devDependencies` `@staynex/backend`
  (types only) and depends on `@staynex/shared`.
- It builds and ships independently (EAS), mirroring the web/api split in
  `docs/architecture.md`. Root `package.json` stays orchestration-only.
- **Known consideration:** Metro + pnpm's symlinked store needs Metro's
  monorepo/symlink config (watch folders + `node_modules` resolution). Validated
  in Phase 0.

**Auth approach (decided):** persistent cookie jar — no backend edits, backend
stays the untouched source of truth. A bearer-token fallback in
`AuthService.resolve()` is a clean future hardening (additive, reversible) but is
**out of scope** unless cookie persistence proves fragile in the field
(**Open question O-1**).

### 3.4 Proposed project layout

```
staynex-mobile/                 # @staynex/mobile (Expo Router app)
  app/                          # file-based routes (booking loop, account, agent)
  src/
    core/                       # fetch client, cookie/session store, env, error mapping
    data/                       # API service fns + TanStack Query hooks (typed via @staynex/backend/types)
    features/                   # search, stay, booking, account, reviews, agent, owner
    ui/                         # PropertyCard, PriceTag, StatusPill, state views
  app.config.ts                # Expo config + env wiring
  eas.json                     # EAS build/submit profiles
  staynex-mobile-plan.md

packages/shared/                # @staynex/shared (zero-dep runtime helpers)
  money.ts                      # kobo → NGN formatter (used by web + mobile)
  labels.ts                     # status/role label maps
  tokens.ts                     # brand design tokens (skill.md §6)
```

---

## 4. Phased plan (S.M.A.R.T.)

Durations are working-week estimates for one focused mobile engineer; they are
the **T** (time-box), not licence for scope creep. Each phase ends at a measurable
gate and may not start the next while its gate is red.

### Phase 0 — Foundation, contracts wiring & connectivity spike · ~1 week
- **Specific:** Scaffold the Expo app, establish the **shared-type + shared-helper**
  boundary (no duplication), wire cookie-session networking, and prove a live call
  to the deployed API.
- **Deliverables:** Expo Router skeleton (§3.4); `@staynex/backend/types` exposed
  and imported `import type` in mobile (zero re-encoding); `@staynex/shared` with
  money formatter + label maps + tokens, consumed by mobile (and pointed to from
  web as the de-dup follow-up); fetch client with persistent cookie session +
  error mapping; env via EAS; Metro+pnpm monorepo config validated; one screen
  calling `GET /search?city=Calabar`; CI running `tsc`, `eslint`, `expo-doctor`.
- **Measurable exit gate:** app builds via **EAS** for Android **and** iOS;
  cold-launches; renders ≥1 live `PropertySummary` typed straight from
  `@staynex/backend/types` (no local copy); `tsc`/lint clean; CI green.
- **Relevant:** locks in backend-as-truth + no-duplication before any UX.
- **Risks:** Metro/pnpm symlink resolution — validate first day.

### Phase 1 — Guest booking loop MVP (the north star) · ~2–3 weeks
- **Specific:** Ship the complete vertical slice from search to confirmed booking,
  against live endpoints, with real Paystack test-mode payment.
- **Deliverables (each maps to §2.1):**
  - Search: city picker (5 launch cities), optional area (`/areas`), dates, guests → `/search`.
  - Results: `PropertyCard` list (image, name, city, from-price, status).
  - Stay detail: `/stays/:slug`, media, room types, per-room availability (`/availability/room-types/:id`).
  - Quote → Hold: `/bookings/quote` then `/bookings/holds`; show `expiresAt` countdown.
  - Auth gate before pay: register/login (cookie persisted) — required only at checkout.
  - Checkout: `/checkout` → open `authorizationUrl` in `expo-web-browser`.
  - Payment status: poll `GET /payments/:reference` until terminal; handle FAILED/EXPIRED.
  - Confirmation: `/bookings/:id` → `BookingView`; clear success state.
- **Measurable exit gate:** a real test booking transitions
  `HOLD → PENDING_PAYMENT → CONFIRMED` via Paystack test mode and appears on the
  owner's web dashboard; expired-hold and failed-payment paths render correctly;
  no confirmed state is ever set client-side; an integration test covers the golden path.
- **Relevant:** this *is* the product (skill.md §3). Nothing else ships until it works.
- **Risks:** Paystack return/deep-link handling on iOS/Android — validate early;
  always fall back to status polling.

### Phase 2 — Account, trips & reviews · ~1–2 weeks
- **Specific:** Persistent identity, profile CRUD, trip history, and post-stay reviews.
- **Deliverables:** auto-login via stored session (`/auth/me`); Google sign-in
  (`/auth/google`, no token storage); profile edit/delete
  (`PATCH`/`DELETE /auth/profile`) mirroring the web `ProfileView` behaviour; "My
  trips" from booking history; leave a review (`/reviews/booking/:id/context` then `POST`).
- **Measurable exit gate:** returning user is auto-signed-in; profile update and
  account delete succeed (delete clears session + routes home); a review submits
  as `PENDING_REVIEW`; signed-out state handled gracefully everywhere.
- **Relevant:** trust + retention around the booking loop.

### Phase 3 — Push notifications (FCM) · ~1 week
- **Specific:** Deliver booking-confirmed (guest) push via Firebase, reusing the
  backend's `NotificationChannel.PUSH` foundation.
- **Deliverables:** Firebase + Expo push setup; device-token registration;
  foreground/background handling; deep-link from notification to the booking.
  **Backend touch (additive, flagged):** a `POST /notifications/device` endpoint +
  device-token persistence may be required. If it needs a Prisma model, the schema
  change will be **reported and not pushed to the live DB without explicit
  approval** (standing rule).
- **Measurable exit gate:** a confirmed booking in test mode delivers a push to a
  real device and deep-links to the booking detail.
- **Relevant:** mobile is the natural home for re-engagement; owners/admins keep web.

### Phase 4 — Staynex Agent in-app · ~1 week
- **Specific:** Embed the Staynex Agent reusing `/ai` endpoints with identical safety posture.
- **Deliverables:** chat panel; suggested prompts; conversation history for
  signed-in users (anonymous gets a session conversation); honest rendering of
  `refused`/`unavailable`/`groundedFacts`.
- **Measurable exit gate:** agent answers grounded questions, **refuses** unsafe
  asks (availability/refund/confirmation), and history persists across sessions
  for signed-in users (skill.md §11).
- **Relevant:** guided booking confidence, on-device.

### Phase 5 — Owner Lite (mobile) · ~2 weeks · *post-MVP, optional*
- **Specific:** Give owners on-the-go visibility and light control; admin stays web-only.
- **Deliverables:** owner bookings + KPIs (`/owner/bookings`); quick capacity edit
  (`PUT /availability/capacity`); property photo upload via signed targets
  (`/media` → `PUT`).
- **Measurable exit gate:** an owner sees live bookings, sets capacity reflected in
  availability, and uploads a photo that appears on the listing.
- **Relevant:** supply-side engagement; deferred until the guest loop is proven.

### Phase 6 — Hardening, store readiness & launch · ~1–2 weeks
- **Specific:** Production-quality polish and store submission.
- **Deliverables:** error/empty/offline states everywhere; accessibility pass
  (WCAG 2.2 AA, dynamic type, contrast, screen-reader labels); NGN formatting via
  `@staynex/shared` + i18n scaffold (en first); app icon/splash; crash/analytics
  (opt-in); legal links reusing `/legal`, `/terms`, `/policies`; release signing
  via EAS; beta via TestFlight + Play internal track.
- **Measurable exit gate:** passes an internal store-readiness checklist;
  crash-free sessions ≥ 99% in beta; booking-loop integration test green on CI.
- **Relevant:** credible, premium, globally launchable (skill.md §6).

---

## 5. Cross-cutting standards (apply every phase)

- **Backend is truth.** No business rule, price math, availability decision, or
  booking/payment state lives on-device. The app reads state; the API owns it.
- **No duplication.** Contracts imported from `staynex-backend/types`
  (`import type`, one-way); shared runtime helpers (money, labels, tokens) live in
  `@staynex/shared`; business logic stays in backend services. If a need looks
  like new logic, check whether the backend already solves it first.
- **Security.** Session cookie in `expo-secure-store`; no secrets in source (EAS
  env / app config); HTTPS only; consider cert pinning at Phase 6; never log
  tokens or PII.
- **Design.** Brand tokens (shared) from skill.md §6; cards for
  properties/rooms/bookings; motion clarifies state only; mobile-first; WCAG 2.2 AA.
- **Testing.** Unit (services with mocked fetch, shared helpers); component
  (key screens, all states) with React Native Testing Library; one integration
  test for the booking-loop golden path.
- **Definition of Done (per phase):** exit gate met · `tsc`/lint clean · tests
  green on CI · no client-trusted financial/availability state · no new contract
  copy introduced · handoff note (skill.md §13 format).

---

## 6. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Metro + pnpm symlink resolution | App won't bundle in monorepo | Configure Metro watch folders/resolver in Phase 0, day one |
| Cookie-session fragility on native clients | Auth breaks | Persistent cookie jar + `/auth/me` revalidation; bearer fallback (O-1) ready |
| Paystack return/deep-link on mobile | Stuck checkout | Validate return handling Phase 1; always fall back to polling `/payments/:reference` |
| `GET /bookings/:id` unauthenticated | Privacy | Treat id as capability; tighten server-side (O-3); never enumerate client-side |
| Contract drift if anyone re-copies types | Reintroduces duplication | Lint/PR rule: mobile + web import `@staynex/backend/types`; no local contract redefinition |
| Scope creep beyond the loop | Slipped MVP | SMART gates; secondary surfaces blocked until Phase 1 gate is green |

---

## 7. Open questions / decisions to confirm

- **O-1 — Auth transport:** stay on cookie jar (default, zero backend change) vs
  add an additive bearer-token fallback for cleaner native auth? *Recommend cookie
  jar; revisit only if field-fragile.*
- **O-2 — Push backend surface:** confirm/define the device-token registration
  endpoint and whether a Prisma model is needed (additive; not pushed without approval).
- **O-3 — Booking read authorization:** should `GET /bookings/:id` require the
  owning session? Recommended before public launch.
- **O-4 — Shared package scope:** confirm `@staynex/shared` (money/labels/tokens)
  and retiring the web `lib/types.ts` hand-copy in the same pass. *Recommended —
  it removes existing duplication, not just future.*
- **O-5 — Min OS targets:** propose iOS 14+ / Android 8 (API 26+).

---

## 8. Immediate next step

Approve **Phase 0**. On approval: scaffold the Expo app under `staynex-mobile/`,
stand up `@staynex/shared`, expose `@staynex/backend/types` and consume it
`import type` (proving zero contract duplication), wire the cookie-session fetch
client to the deployed API, and prove the connectivity spike
(`GET /search?city=Calabar`) on an EAS build — the measurable gate for Phase 0.
