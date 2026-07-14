# Staynex — Main Architecture (Internal Engineering Reference)

> Audience: Staynex engineers. This is the single, coherent map of the system —
> what the pieces are, how they relate, every HTTP endpoint, and how to exercise
> each locally. For product/design standards see `skill.md` (source of truth);
> for deeper background see `Staynex_plan.md`, `docs/architecture.md`, and the
> per-slice docs under `docs/`.
>
> Keep this file current: when you add an endpoint, module, env var, or a
> non-obvious relationship, update the relevant section here in the same PR.

---

## 1. What Staynex is

A hospitality booking platform: guests discover verified stays, hold inventory,
pay via Paystack, and receive a downloadable **Booking Confirmation & Receipt**
(PDF + emailed) with a **QR that resolves to live server truth** at check-in.
Hosts list properties (admin-reviewed), manage rooms/availability, and are paid
out net of a platform fee. Admins review listings, manage money exceptions, and
settle payouts.

**Two deployables, one repo:**

| App         | Path                | Stack                                 | Host    |
| ----------- | ------------------- | ------------------------------------- | ------- |
| Backend API | `staynex-backend/`  | NestJS 11 + Prisma 6 (CockroachDB)    | Railway |
| Frontend    | `staynex-frontend/` | Next.js 15 (App Router) + Tailwind v4 | Vercel  |

External services: **Paystack** (payments), **Cloudflare R2** (media, S3 API),
**Resend** (email), **Firebase Cloud Messaging / HTTP v1** (web push),
**Google Identity** (Google sign-in), **Gemini** (AI assistant).

---

## 2. Topology

```
                 ┌──────────────────────────────────────────────┐
   Browser ──────▶  Next.js (Vercel)  ── SSR fetch ─┐            │
   (guest/host/    - App Router pages               │            │
    admin/         - server-catalog.ts (public)     │            │
    reception)     - lib/api.ts (client, cookies)   ▼            │
                 └──────────────────────────  NestJS API (Railway)│
                                                │   │   │   │      │
                        ┌───────────────────────┘   │   │   └───── Gemini (AI)
                        ▼                            │   └───────── Resend (email)
                 CockroachDB (Prisma)                │
                        ▲                            └───────────── FCM v1 (push)
   Paystack ── webhook ─┘                Cloudflare R2 (media, presigned PUT)
```

- The frontend talks to the API two ways: **server components** call public
  endpoints directly (`src/lib/server-catalog.ts`, `server-reports.ts`), and
  **client components** call through `src/lib/api.ts` (sends cookies + CSRF).
- The API is the **only** writer of availability counters and booking/payment
  state. The frontend never fabricates booking/payment truth.
- No global route prefix: controllers map at the root (e.g. `POST /checkout`).

---

## 3. Tech stack & key versions

- Node + TypeScript 5.9. Backend `module: NodeNext` (CommonJS emit, no
  `"type":"module"`), `jsx: react-jsx` enabled **only** for the react-pdf
  voucher `.tsx` template.
- NestJS 11 (`@nestjs/platform-express`, `rawBody: true` for webhook HMAC).
- Prisma 6 / `@prisma/client` against CockroachDB (Postgres wire, serverless).
- Zod 4 for all request validation (`parseBody(schema, body)`).
- Next.js 15 App Router, React 19, Tailwind CSS v4 (`@tailwindcss/postcss`).
- Vouchers: `@react-pdf/renderer` 4 + `qrcode` (no headless browser).
- No SDKs for Paystack/Resend/FCM — thin `fetch` integrations; FCM OAuth JWT is
  self-signed with `node:crypto`.

---

## 4. Repository layout

```
staynex-backend/
  config/env.ts            Zod-validated env loader (loadEnv)
  db/                      Prisma client singleton + connectWithRetry
  prisma/
    schema.prisma          Data model (source of truth for the DB)
    migrations/            Hand-written CockroachDB SQL migrations
  src/
    main.ts                Bootstrap: security middleware, CORS, body parsers
    app.module.ts          Root module (imports every feature module)
    common/                Cross-cutting: rate limiter, security, pagination,
                           env/date helpers, prisma exception filter, http
    modules/
      auth/                Sessions, capabilities, MFA, password reset, Google
      users/ owner/        Profiles, host onboarding, payout method, locations
      properties/ rooms/   Supply: listings, room types, room units
      availability/        Capacity calendar (per room type per day)
      bookings/            Holds, checkout, payment transitions, webhook, maint.
      payments/            Paystack client, commission split, payment events
      catalog/ areas/      Public discovery: search, home, city/area, stays
      reviews/             Guest testimonials + admin moderation
      notifications/       Email + push (FCM) + in-app inbox, outbox retry
      vouchers/            Canonical PDF, QR, public verification card
      media/               R2 presigned uploads + media ordering
      admin/               Approvals, payments ops, payouts, users, audit, AI logs
      ai/                  Gemini assistant + conversation history
      health/              Liveness/readiness
types/                     Shared API response contracts (@staynex/backend/types)

staynex-frontend/
  src/app/                 App Router route groups: (public) (host) (admin)
    verify/[reference]/    Public reception verification page (standalone)
    firebase-messaging-sw.js/route.ts   FCM service worker (generated)
  src/features/            Feature UIs (auth, booking, properties, ai, ...)
  src/ui/                  Design-system primitives (Button, Field, Badge, ...)
  src/components/          Shared app chrome (dashboard, notifications, nav)
  src/lib/                 api.ts (client), server-catalog/reports (SSR),
                           api-base.ts, types.ts (mirrors backend contracts),
                           firebase-*.ts, format.ts
  src/styles/              theme.css (design tokens), motion.css
```

---

## 5. Environment variables

Frontend browser vars live **only** in `staynex-frontend/.env.local` (all
`NEXT_PUBLIC_*`, inlined at build; must be non-secret). Backend secrets live in
`staynex-backend/.env`. Both are gitignored; mirror on Vercel / Railway.

**Backend (`staynex-backend/.env`)** — validated in `config/env.ts`:

| Var                                                                                                     | Purpose                                                                                                                      |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                                          | CockroachDB (`&connect_timeout=30` to survive serverless resume)                                                             |
| `API_PORT`, `CORS_ORIGIN`                                                                               | Listen port; allowed browser origin                                                                                          |
| `NEXT_PUBLIC_APP_URL`                                                                                   | Backend-consumed: Paystack callback, reset/verify links, push deep links, CORS. (The only `NEXT_PUBLIC_*` kept server-side.) |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`                                                            | Payments + webhook HMAC                                                                                                      |
| `PLATFORM_FEE`                                                                                          | Commission percent (e.g. `10`); snapshot to bps at checkout                                                                  |
| `OWNER_PAYOUT_ENCRYPTION_KEY`                                                                           | Encrypts stored payout bank details                                                                                          |
| `CLOUDFLARE_R2_*`                                                                                       | Account/keys/bucket for media (S3 API)                                                                                       |
| `CLOUDFLARE_R2_PUBLIC_BASE_URL`                                                                         | Public media base (mirror as `NEXT_PUBLIC_MEDIA_BASE_URL`)                                                                   |
| `RESEND_API_KEY`, `EMAIL_FROM`                                                                          | Transactional email                                                                                                          |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_SERVICE_ACCOUNT_KEY` / `FIREBASE_PRIVATE_KEY` | FCM HTTP v1 service-account auth                                                                                             |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                              | Google sign-in verification                                                                                                  |
| `GEMINI_API_KEY`                                                                                        | AI assistant                                                                                                                 |
| `ADMIN_REVIEWER_ACCESS_CODE`, `ADMIN_MANAGER_ACCESS_CODE`                                               | Admin registration codes (role by code)                                                                                      |

**Frontend (`staynex-frontend/.env.local`)** — all `NEXT_PUBLIC_*`:
`API_URL`, `APP_URL`, `GOOGLE_CLIENT_ID`, `MEDIA_BASE_URL`,
`FIREBASE_{API_KEY,AUTH_DOMAIN,PROJECT_ID,MESSAGING_SENDER_ID,APP_ID,MEASUREMENT_ID,VAPID_KEY}`.

---

## 6. Data model (Prisma → CockroachDB)

Entities and the relationships that matter. `schema.prisma` is authoritative.

**Identity & access**

- `User` — `email?`, `name?`, `phone?`, `passwordHash?` (scrypt `salt:hash`),
  `role` (compat mirror) + `UserCapability[]` (forward-compatible source of
  truth; `GUEST` is implicit). Relations to everything a person owns/does.
- `Session` — hashed session token, `expiresAt`. `MfaChallenge` — admin-manager
  6-digit codes. `PasswordResetToken` — scrypt-hashed 6-digit reset code +
  `attempts` cap (looked up by `userId`).
- `GuestProfile` / `OwnerProfile` — role-specific profile data.
- `OwnerLocation` — an owner's operating location (`addressLine?`), optionally
  linked from a `Property`.
- `OwnerPayoutMethod` — encrypted bank details (`accountNumberLast4` shown).

**Supply**

- `Property` — `ownerId`, `cityId`, `areaId?`, `status` (DRAFT→APPROVED…),
  `reviewStatus`, `contentVersion`, `scheduledPublishAt`. Has `RoomType[]`,
  `PropertyMedia[]`, `PropertyReviewRun[]`.
- `RoomType` — `basePriceKobo`, `maxGuests`; has `RoomUnit[]`, `RoomMedia[]`,
  `AvailabilityCalendar[]`.
- `RoomUnit` — a bookable unit (`code?`). A booking's `roomUnitId` is real
  operational allocation, not a placeholder (payment-review **P3**).
- `AvailabilityCalendar` — per `(roomTypeId, date)`: `totalUnits`,
  `bookedUnits`, `heldUnits`. **The capacity authority.**

**Demand & money**

- `BookingHold` — 15-min TTL, allocates a free `RoomUnit`, snapshots price.
- `Booking` — `status` (HOLD/PENDING_PAYMENT/CONFIRMED/CANCELLED/EXPIRED),
  dates, occupancy (`adults/children/infants`), `guestEmail?`, `roomUnitId`.
  One `Payment?`, one `Payout?`, one `Testimonial?`.
- `Payment` — integer **kobo**: `grossAmountKobo`, `platformFeeKobo`,
  `ownerPayoutKobo`, `commissionRateBps` (all snapshotted at checkout),
  `reference` (`stx_<uuid>`, unique), `status`, `paidAt`, `lastVerifiedAt`.
- `Payout` — one PENDING per successful payment; `eligibleAt` = check-in + 24h;
  settled to PAID/FAILED by admin.
- `PaymentEvent` — **immutable money audit trail**: one row per webhook, per
  state-changing verify, per admin money action, always with an `outcome`.

**Engagement**

- `Testimonial` — tied to a booking; PENDING_REVIEW → APPROVED (admin).
- `Notification` — one row per channel (IN_APP/EMAIL/PUSH) with `type`,
  `status`, `dedupeKey` (unique, idempotency), `payload` (outbox), `attempts`.
- `DeviceToken` — FCM registration per user/device.
- `AIConversation` / `AIMessage` — assistant history. Agent messages can store
  `UP`/`DOWN` feedback, a feedback timestamp, a superseded timestamp for safe
  last-turn replacement, and verified public property-card snapshots.
- `AuditLog` — admin actions on properties/money (skill.md §9).

---

## 7. Money model

- All money is **integer kobo** (₦1 = 100 kobo). Never floats.
- Commission is **basis points** (bps): `PLATFORM_FEE` percent → bps
  (`resolveCommissionBps`, `modules/payments/commission.ts`).
- At checkout, `splitPayment(gross, bps)` snapshots
  `grossAmountKobo / platformFeeKobo / ownerPayoutKobo / commissionRateBps`
  onto the `Payment`, so **changing the platform rate never rewrites history**.
- Owner payout = gross − platform fee, becomes eligible 24h after check-in.
- Refund reverses the booking, releases capacity, and claws back an unsettled
  payout (or flags a PAID one for out-of-band recovery).

---

## 8. Domain relationships & module graph

Booking loop authority is `BookingsService`; it is the only place that mutates
availability counters or booking/payment status. Every money transition returns
an explicit outcome that the caller writes to `PaymentEvent`.

Module dependency notes (no cycles at runtime):

- `AuthModule ⇄ NotificationsModule` are mutually dependent
  (`AuthService` needs `EmailService`; `NotificationsController` needs
  `SessionGuard`) and are wired with **`forwardRef()`** on both sides.
- `NotificationsModule → VouchersModule` (attach the canonical PDF to the
  confirmation email). `VouchersModule` imports nothing (Prisma only), so no
  cycle.
- `BookingsModule / PaymentsModule / AdminModule → NotificationsModule`
  (one-directional).
- `SecurityModule` is `@Global` and provides the rate limiter + guard.

---

## 9. Complete HTTP API reference

Base URL (local): **`http://localhost:4000`**. No global prefix.
**Auth column:** `public` = none · `session` = `SessionGuard` (signed in) ·
`OWNER` / `ADMIN` = `SessionGuard + CapabilitiesGuard` (capability required).
Most write endpoints are rate-limited (`@RateLimit`) and CSRF-protected (see §10).

### 9.1 Auth — `/auth` (`AuthController`)

| Method | Path                           | Auth    | Purpose                                      |
| ------ | ------------------------------ | ------- | -------------------------------------------- |
| GET    | `/auth/csrf`                   | public  | Issue CSRF cookie + token                    |
| POST   | `/auth/register`               | public  | Guest/owner registration → session cookie    |
| POST   | `/auth/host/register`          | public  | Owner-intent registration                    |
| POST   | `/auth/admin/register`         | public  | Admin registration via 6-digit access code   |
| POST   | `/auth/login`                  | public  | Password login (may return `{mfaRequired}`)  |
| POST   | `/auth/mfa/complete`           | public  | Complete admin-manager MFA                   |
| POST   | `/auth/google`                 | public  | Google ID-token sign-in (guest/owner intent) |
| POST   | `/auth/password/forgot`        | public  | Email a 6-digit reset code (generic OK)      |
| POST   | `/auth/password/reset`         | public  | Reset with `{email, code, password}`         |
| PATCH  | `/auth/profile`                | session | Update name/email/phone                      |
| DELETE | `/auth/profile`                | session | Delete account                               |
| POST   | `/auth/logout`                 | public  | Clear session + CSRF cookies                 |
| GET    | `/auth/sessions`               | session | List active sessions                         |
| POST   | `/auth/sessions/revoke-others` | session | Revoke all other sessions                    |
| GET    | `/auth/me`                     | public  | Current user or `null`                       |

### 9.2 Settings — `/settings` (`SettingsController`, session)

`GET /settings/profile`, `PATCH /settings/profile`.

### 9.3 Discovery — root (`CatalogController`, public)

`GET /search`, `GET /catalog/cities`, `GET /catalog/home`, `GET /stays/:slug`.
Areas: `GET /areas` (public); admin `GET|POST /admin/areas`, `PATCH /admin/areas/:id` (ADMIN).

### 9.4 Availability — `/availability`

`GET /availability/room-types/:roomTypeId` (public);
`PUT /availability/capacity` (OWNER — set totalUnits per date).

`AvailabilityCalendar` remains the capacity authority. The host capacity write
applies one `totalUnits` value to every night in an inclusive date range (up to
366 days). The service rejects values above the room type's active physical
units and values below existing bookings plus unexpired holds, so the client
never calculates or overwrites remaining inventory. Setting `totalUnits` to
zero closes the selected nights to new bookings.

### 9.5 Booking loop — root (`BookingsController`)

| Method | Path                  | Auth    | Purpose                                        |
| ------ | --------------------- | ------- | ---------------------------------------------- |
| POST   | `/bookings/quote`     | public  | Price + availability for dates/guests          |
| POST   | `/bookings/holds`     | public  | Place a 15-min hold (allocates a unit)         |
| GET    | `/bookings/holds/:id` | public  | Hold summary / expiry                          |
| POST   | `/checkout`           | session | Hold → PENDING_PAYMENT booking + Paystack init |
| GET    | `/bookings/:id`       | public  | Booking view (confirmation page source)        |

Host views (`OwnerBookingsController`, OWNER): `GET /host/bookings`,
`GET /host/bookings/:id`.

### 9.6 Payments — `/payments` (`PaymentsWebhookController`)

| Method | Path                         | Auth          | Purpose                                              |
| ------ | ---------------------------- | ------------- | ---------------------------------------------------- |
| POST   | `/payments/paystack/webhook` | public (HMAC) | Paystack events; SHA512 verified against raw body    |
| GET    | `/payments/:reference`       | public        | Reconciled payment/booking status (debounced verify) |

### 9.7 Vouchers & verification — root (`VoucherController`, public)

| Method | Path                          | Purpose                                                              |
| ------ | ----------------------------- | -------------------------------------------------------------------- |
| GET    | `/verify/:reference`          | Live verification card (JSON; **no amount/PII beyond masked email**) |
| GET    | `/vouchers/:reference/pdf`    | Canonical PDF receipt (only when paid+confirmed; 404 otherwise)      |
| GET    | `/vouchers/:reference/qr.svg` | SVG QR pointing to `{APP_URL}/verify/<reference>`                    |

### 9.8 Host workspace — `/host` (OWNER)

- Properties (`/host/properties`): `GET`, `POST`, `GET/:id`, `PATCH/:id`, `POST/:id/submit`.
- Rooms (`/host`): `GET /host/properties/:propertyId/room-types`, `POST /host/room-types`,
  `PATCH /host/room-types/:id`, `GET /host/room-types/:roomTypeId/units`, `POST /host/room-units`.
- Onboarding/settings (`/host`): `POST /host/become`, `GET /host/onboarding`,
  `POST /host/onboarding/complete`, `GET /host/settings`, `PATCH /host/settings/profile`,
  `GET|POST /host/settings/locations`, `PATCH|DELETE /host/settings/locations/:id`,
  `GET /host/settings/payout-method`, `PUT /host/settings/payout-method`.
- Media (`/host/media`): `POST /host/media/upload-url` (presigned R2 PUT),
  `POST /host/media/property/:propertyId`, `POST /host/media/room/:roomTypeId`,
  `PUT .../order`, `PATCH|DELETE property-media/:mediaId`, `PATCH|DELETE room-media/:mediaId`.

### 9.9 Reviews — `/reviews`

`GET /reviews` (public, approved only); `GET /reviews/booking/:bookingId/context` (session);
`POST /reviews/booking/:bookingId` (session). Admin: `GET /admin/testimonials`,
`POST /admin/testimonials/:id/decision` (ADMIN).

### 9.10 Notifications — `/notifications` (session)

`GET /notifications` (inbox, keyset paginated + unreadCount), `POST /notifications/read`,
`POST /notifications/devices` (register FCM token), `DELETE /notifications/devices/:token`.

### 9.11 Admin — `/admin` (ADMIN)

- Approvals: `GET /admin/approvals`, `GET /admin/approvals/:id`, `POST /admin/approvals/:id/decision`.
- Money ops: `GET /admin/bookings`, `GET /admin/payments`, `GET /admin/payments/exceptions`,
  `POST /admin/payments/:reference/reverify`, `POST /admin/payments/:reference/refund`,
  `GET /admin/reconciliation/availability`.
- Payouts: `GET /admin/payouts`, `POST /admin/payouts/:id/paid`, `POST /admin/payouts/:id/failed`.
- Audit/AI: `GET /admin/audit-logs`, `GET /admin/ai-logs`.
- Users: `GET /admin/users`, `GET /admin/users/:id`, `POST /admin/users/:id/payout-method/reveal`.

### 9.12 AI assistant — `/ai` (`AiController`)

`POST /ai/assistant`, `POST /ai/assistant/stream` (SSE), plus conversation
history CRUD: `GET|POST /ai/conversations`, `GET /ai/conversations/:id/messages`,
`PATCH /ai/conversations/:id`, `POST /ai/conversations/:id/pin`,
`DELETE /ai/conversations/:id`, and idempotent message feedback via
`PUT /ai/conversations/:conversationId/messages/:messageId/feedback`.
Assistant requests may carry a `retry` or `edit` operation for the latest
completed turn. Ownership is resolved from the session cookie when present
(history is user-scoped); the assistant answers guests too.

Assistant replies and final SSE metadata include persisted user/agent message
ids plus verified `PropertySummary[]` cards. Current names, images, and starting
nightly prices are retrieved from approved catalog rows for each turn. Property
cards are display guidance only: exact date availability and booking/payment
truth remain in their authoritative backend flows.

Thumbs-down on the latest response adds a correction instruction to the next
answer so the model re-checks verified facts and changes approach. It does not
override the deterministic safety gate, grounding rules, or payment/booking
authority. Retry/edit keep the prior response visible until a replacement is
persisted, then mark it superseded in the same transaction as the new message
and AI action log.

### 9.13 Health — `/health`

`GET /health` (liveness), `GET /health/ready` (readiness/DB).

---

## 10. Security model

- **Sessions:** opaque 32-byte token, **stored hashed**; `staynex_session`
  cookie (httpOnly, sameSite=lax, secure in prod). Guest TTL ~6 months; admin
  TTL 12h. Legacy plaintext tokens are transparently rehashed on use.
- **Capabilities:** `GUEST` (implicit), `OWNER`, `ADMIN_REVIEWER`,
  `ADMIN_MANAGER`. `@RequireAnyCapability(...)` + `CapabilitiesGuard`.
- **Admin MFA:** `ADMIN_MANAGER` logins require an emailed 6-digit code
  (`MfaChallenge`, 10-min TTL, 5 attempts).
- **Password reset:** emailed **6-digit code** (scrypt-hashed, looked up by
  user, 15-min TTL, 5-attempt cap). No link, no account enumeration.
- **CSRF:** `csrfProtection` (main.ts) enforces origin + `X-CSRF-Token`
  (matching the `sx_csrf` cookie from `GET /auth/csrf`) on mutating requests.
- **Rate limiting:** in-memory `RateLimiterService` via `@RateLimit({bucket,
limit, windowMs, keyBy})` (`SecurityModule` is `@Global`).
- **Webhook integrity:** Paystack `POST /payments/paystack/webhook` verifies an
  HMAC-SHA512 signature over the **raw** body (`rawBody: true` in bootstrap).
- **Transport/headers:** `securityHeaders`, request size limits, JSON
  content-type enforcement, CORS allowlist (env + defaults). Frontend sets a
  strict CSP in `next.config.ts` (script/connect/img/frame-src allowlists;
  `img-src` includes the API origin for the QR image).
- **Secrets:** never store raw card data; payout bank details encrypted at rest;
  media served from R2 public base only.

---

## 11. Booking & payment state machines

**Booking:** `HOLD → PENDING_PAYMENT → CONFIRMED` (happy path);
`→ CANCELLED` (failure/refund), `→ EXPIRED` (abandoned), with **late-success
revival** (a paid-after-expiry booking re-confirms only if every night is still
free; otherwise the payment is flagged `REQUIRES_REFUND`).

**Payment:** `PENDING/INITIATED → SUCCESS` (idempotent, upserts payout);
`→ FAILED` (abandoned/failed/reversed); `→ REFUNDED`; `→ REQUIRES_REFUND`
(currency mismatch, underpayment, or unrevivable late success — funds captured
but must be refunded by an admin). All transitions run in **serializable**
transactions and record a `PaymentEvent`.

Reconciliation: `GET /payments/:reference` verifies with Paystack, **debounced
per payment** so status-page polling can't hammer the verify API; admin
`reverify` forces it.

---

## 12. Notifications & push

One entry point — `NotificationsService.notifyUser` — fans out to **in-app**
(inbox row, the dedupe anchor via unique `dedupeKey`), **push** (every
registered `DeviceToken`, FCM HTTP v1), and optionally **email** (Resend). Each
channel is an **outbox row** (`QUEUED → SENT/FAILED` with the deliverable
`payload`), retried by `NotificationDispatcherService` (every ~2 min, up to
`MAX_DELIVERY_ATTEMPTS`). Notifications never throw into the business
transaction that triggered them.

- FCM auth: self-signed RS256 service-account JWT → OAuth token (cached), no
  Firebase SDK. Dead tokens (404/UNREGISTERED) are pruned.
- Triggers: booking confirmed, refunded, payout paid/failed, payment exception
  (all admins), property review decisions, and daily check-in reminders (T-1).
- Web push: `firebase-messaging-sw.js` (generated route) handles background
  messages + notification clicks; `NotificationCenter` renders the inbox bell.

---

## 13. Vouchers & on-site verification

The trust anchor for check-in is **live server truth**, not a screenshot.

- `VoucherService.load(reference)` reduces persisted booking/payment/property
  rows to one canonical `VoucherData`.
- `renderVoucherPdf` (react-pdf) produces the **one canonical PDF** used
  **byte-identical** for both the download endpoint and the confirmation-email
  attachment (regenerated at send time from the reference, so retries reflect
  current truth). A receipt is only issued when **CONFIRMED + payment SUCCESS**.
- The PDF and the on-page voucher both carry a QR → `{APP_URL}/verify/<ref>`.
- `GET /verify/:reference` returns a minimal card (guest name, property, room
  type + provisional unit, dates, guests, Paid/Confirmed) — **never the amount**
  or card data; email is masked. Reception opens it by scanning the guest's QR,
  or from the host booking page ("Open verification").
- Reference `stx_<uuid>` is a 128-bit unguessable capability token (airline-PNR
  model), so voucher/verify routes key on it and need no session.

---

## 14. Background / interval services

| Service                         | Cadence  | Job                                                                                                           |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `BookingMaintenanceService`     | interval | Release expired holds & abandoned PENDING bookings; hourly check-in reminders                                 |
| `NotificationDispatcherService` | ~2 min   | Retry FAILED / crash-stuck outbox EMAIL/PUSH rows                                                             |
| Property auto-review scheduler  | interval | Publish properties whose `scheduledPublishAt` elapsed and content is still current                            |
| DB warm-up                      | boot     | `connectWithRetry` bounds CockroachDB cold-start; `PrismaExceptionFilter` maps transient DB failures to `503` |

---

## 15. Frontend architecture

- **Route groups:** `(public)` (marketing, search, stays, checkout, booking
  confirmed, auth pages), `(host)` (host workspace), `(admin)` (admin console),
  plus standalone `verify/[reference]` (reception, `noindex`).
- **Data fetching:** server components use `src/lib/server-catalog.ts` /
  `server-reports.ts` (public API, with fixture fallbacks for _display only_ —
  never for booking/payment truth). Client components use `src/lib/api.ts`
  (`credentials: include`, CSRF header on mutations). `API_BASE` from
  `src/lib/api-base.ts`.
- **Contracts:** `src/lib/types.ts` mirrors `staynex-backend/types` — keep them
  in lockstep when a response shape changes.
- **Staynex AI:** streamed messages expose server-backed helpful/unhelpful
  feedback, latest-response regeneration, latest-user-message editing, and
  structured verified property cards rendered through `src/ui/property-card.tsx`.
  Signed-in users receive sanitized first-name personalization. The floating
  launcher stays text-only (`Ask Staynex AI`) to keep the universal affordance
  compact.
- **Design system:** tokens in `src/styles/theme.css`; primitives in `src/ui`.
  Use tokens (`text-ink`, `bg-success-surface`, …), not raw colors.
- **Media:** `next/image` optimizes R2 images when `NEXT_PUBLIC_MEDIA_BASE_URL`
  is set (allowlisted in `next.config.ts`); otherwise images render unoptimized.
- **Host availability:** `features/properties/availability-editor.tsx` presents
  30-day and 90-day quick-open actions plus a custom-range option. Quick setup
  offers all active units for the chosen room type; advanced availability lets
  experienced hosts change the saleable rooms per night or close a range with
  zero. Every action still uses `PUT /availability/capacity`, and the backend
  protects booked/held inventory. Property review requires at least 30 unique
  future nights with positive bookable capacity across the property's room
  types; the quick 30-day action satisfies that gate when inventory is valid.

---

## 16. Local development & testing

**Run**

```bash
# Backend (http://localhost:4000)
pnpm -C staynex-backend install
pnpm -C staynex-backend prisma:generate
pnpm -C staynex-backend dev            # nest start --watch

# Frontend (http://localhost:3000)
pnpm -C staynex-frontend install
pnpm -C staynex-frontend dev
```

**Static checks / build**

```bash
pnpm -C staynex-backend run check      # tsc --noEmit
pnpm -C staynex-backend run build      # prisma generate + nest build
pnpm -C staynex-frontend run check     # next typegen + tsc --noEmit
pnpm -C staynex-frontend run build     # next build
```

> Windows note: `prisma generate` fails with `EPERM` while the dev server holds
> the query-engine DLL — stop `pnpm dev` before regenerating, or run
> `nest build` directly to skip the `prebuild` generate.

**Per-domain smoke tests** (public endpoints via curl; guarded endpoints need a
session cookie + CSRF token):

```bash
# Health
curl http://localhost:4000/health/ready

# Discovery
curl "http://localhost:4000/catalog/home"
curl "http://localhost:4000/search?city=lagos"
curl "http://localhost:4000/stays/<slug>"

# CSRF + a session (cookie jar), then a guarded call
curl -c jar.txt http://localhost:4000/auth/csrf     # note csrfToken in body
curl -b jar.txt -c jar.txt -H "Content-Type: application/json" \
     -H "X-CSRF-Token: <token>" \
     -d '{"email":"you@real-domain.com","password":"supersecret","phone":"08030000000"}' \
     http://localhost:4000/auth/register
curl -b jar.txt http://localhost:4000/auth/me

# Booking loop
curl -X POST http://localhost:4000/bookings/quote -H "Content-Type: application/json" \
     -d '{"roomTypeId":"<id>","checkIn":"2026-08-01","checkOut":"2026-08-03","adults":2,"children":0,"infants":0,"guests":2}'
# → holds → checkout (session) → open the returned authorizationUrl (Paystack test card)

# Password reset (dev logs the code when RESEND is unconfigured)
curl -X POST http://localhost:4000/auth/password/forgot -H "Content-Type: application/json" \
     -d '{"email":"you@real-domain.com"}'
# read the 6-digit code from the API logs, then:
curl -X POST http://localhost:4000/auth/password/reset -H "Content-Type: application/json" \
     -d '{"email":"you@real-domain.com","code":"123456","password":"newsupersecret"}'

# Voucher + verification (needs a CONFIRMED+paid booking reference)
curl "http://localhost:4000/verify/<reference>"
curl -OJ "http://localhost:4000/vouchers/<reference>/pdf"
curl "http://localhost:4000/vouchers/<reference>/qr.svg"
```

- **Webhook:** POST a Paystack `charge.success` payload to
  `/payments/paystack/webhook` with a valid `x-paystack-signature`
  (HMAC-SHA512 of the raw body with `PAYSTACK_SECRET_KEY`), or drive it via the
  Paystack test dashboard.
- **Voucher PDF (offline):** `node` a script that requires
  `dist/src/modules/vouchers/voucher-document.js` (`renderVoucherPdf`) with mock
  `VoucherData` — verifies react-pdf renders a valid `%PDF-`.
- **Push:** register a `DeviceToken` from the frontend (grant notifications),
  trigger a booking confirmation, and confirm the FCM delivery.

---

## 17. Migrations & deployment

- **DB migrations:** hand-written CockroachDB SQL under
  `prisma/migrations/<timestamp>_<name>/migration.sql` (STRING/INT4/TIMESTAMP(3)
  types, additive & safe on live data). Apply with `prisma migrate deploy`.
  Keep `schema.prisma` and the SQL in sync, and run `prisma generate`.
- **Backend (Railway):** `pnpm build` (runs `prisma generate` + `nest build`),
  `pnpm start` (`node dist/src/main.js`). Set every backend env var + a
  `DATABASE_URL` with `connect_timeout=30`.
- **Frontend (Vercel):** `next build`; set all `NEXT_PUBLIC_*` env vars.
  Redirects `/owner/*` → `/host/*` are permanent.

---

## 18. Non-negotiable business rules (skill.md §9)

1. The booking loop is transactional and the backend is the sole authority over
   availability and booking/payment state.
2. No booking is CONFIRMED without a **verified** successful payment.
3. Every admin money/property override writes an `AuditLog` / `PaymentEvent`.
4. Nothing that touches funds resolves invisibly — every transition is audited.
5. Never store raw card data; encrypt payout details; never expose commission
   or payout splits to guests.
6. Never fabricate reviews, availability, or payment truth on the frontend.

---

## 19. Glossary

- **kobo** — minor currency unit (₦1 = 100 kobo); all money is integer kobo.
- **bps** — basis points (1000 bps = 10%); commission unit.
- **reference** — `stx_<uuid>`, the payment/booking capability token.
- **hold** — short-lived (15-min) inventory reservation before payment.
- **outbox** — a stored notification payload retried until delivered.
- **capability** — a granted privilege (`OWNER`/`ADMIN_*`); `GUEST` is implicit.
- **voucher** — the canonical Booking Confirmation & Receipt PDF.
