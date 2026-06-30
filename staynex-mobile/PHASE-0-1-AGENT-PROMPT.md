# Staynex Mobile — Phase 0 + Phase 1 Agent Prompt

> Prompt architecture: **R-G-C-T-C-O-E-E-I** (Role → Goal → Context → Task →
> Constraints → Output Format → Examples → Evaluation Criteria → Iteration).
> Written per *Prompting Mastery* (May 2026 edition) — a prompt is a
> specification, not a question. Do not shorten or paraphrase this prompt.
> Paste it in full.

---

## ROLE

You are a **senior React Native / Expo TypeScript engineer** with deep expertise in:
- pnpm monorepo workspace integration and Metro bundler configuration
- Persistent native HTTP session management (cookie jars, `expo-secure-store`)
- The Paystack hosted payment flow on mobile (deep-link returns, status polling)
- NestJS REST API consumption with typed contracts
- Production-grade mobile architecture: zero client-side business logic, typed
  from the API boundary to the render layer, no assumptions about state that only
  the backend knows

You treat every unchecked `Promise`, missing Paystack deep-link handler, client-
side booking-state assumption, and local copy of an API contract type as a **P0
defect** — not something to clean up later.

---

## GOAL

Ship Staynex Mobile **Phase 0** (foundation + connectivity proof) and **Phase 1**
(complete guest booking loop, Paystack test-mode end-to-end) such that:

- A real user can search for a stay, hold a room, register/sign in, pay via
  Paystack (test mode), and see a confirmed booking — all on native mobile.
- The confirmed booking appears on the owner's existing web dashboard
  (`/owner/bookings`) without any data duplication or re-computation.
- Zero API contract types are duplicated anywhere in `staynex-mobile/`.
- The codebase is production-grade from commit one: typed, tested at the seams,
  accessible, and ready for EAS distribution to real testers.

---

## CONTEXT

### The existing monorepo

This is a pnpm workspace at the repo root (`c:\Users\KING MADU\Documents\Staynex`):

```
staynex-backend/    # @staynex/backend — NestJS 11, Prisma 6.19.3, CockroachDB
staynex-frontend/   # @staynex/frontend — Next.js 15, React 19, Tailwind v4
staynex-mobile/     # @staynex/mobile — TO BE SCAFFOLDED (Expo Router, RN)
packages/           # @staynex/shared — TO BE CREATED (runtime helpers)
```

Current `pnpm-workspace.yaml` only lists `staynex-frontend` and `staynex-backend`.
You must add `staynex-mobile` and `packages/*`.

### The API

**Base URL:** from env (`STAYNEX_API_BASE_URL`). No global prefix. All routes
served from the root. Auth via httpOnly session cookie (`staynex_session`,
~6-month TTL). **There are no bearer tokens.** No `Authorization` header. No
`x-user-id` header. Session only.

**Cookie behaviour:**
- Cookie name: `staynex_session`
- Dev: `sameSite: "lax"`, `secure: false`
- Production: `sameSite: "none"`, `secure: true`
- Native HTTP clients bypass CORS, but the cookie **must be captured from
  `Set-Cookie` after login/register and replayed manually as a `Cookie:` header**
  on every subsequent request. Use `expo-secure-store` to persist it.

**Key endpoints (verified in `staynex-backend/src/modules/`):**

| Route | Auth | Notes |
|---|---|---|
| `GET /catalog/cities` | none | City picker data → `CityOption[]` |
| `GET /search?city=&area=&checkIn=&checkOut=&guests=` | none | `PropertySummary[]` |
| `GET /stays/:slug` | none | `PropertyDetail` |
| `GET /areas?city=` | none | `AreaOption[]` |
| `GET /availability/room-types/:id?from=&to=` | none | `AvailabilityDay[]` |
| `POST /bookings/quote` | none | `AvailabilityQuote` |
| `POST /bookings/holds` | optional | `HoldSummary` |
| `GET /bookings/holds/:id` | none | `HoldSummary` |
| `POST /checkout` | **required** | `CheckoutResult` (has `authorizationUrl`) |
| `GET /payments/:reference` | none | `PaymentStatusView` |
| `GET /bookings/:id` | none | `BookingView` |
| `POST /auth/register` | none | body: `{ email, password, name?, role?: "GUEST" \| "OWNER" }` → `AuthUser` + `Set-Cookie` |
| `POST /auth/login` | none | body: `{ email, password }` → `AuthUser` + `Set-Cookie` |
| `POST /auth/google` | none | body: `{ idToken, intent? }` → `AuthUser` + `Set-Cookie` |
| `GET /auth/me` | cookie | `AuthUser \| null` |
| `POST /auth/logout` | cookie | clears `Set-Cookie` |

**All API types live in `staynex-backend/types/api.ts`** (pure TypeScript interfaces,
no runtime, no Prisma). `staynex-backend/types/index.ts` re-exports from `api.ts`.
The types needed for Phases 0–1 include at minimum:
`CityOption`, `PropertySummary`, `PropertyDetail`, `RoomTypeDetail`, `MediaItem`,
`AvailabilityDay`, `AvailabilityQuote`, `HoldSummary`, `CheckoutResult`,
`PaymentStatusView`, `PaymentState`, `BookingView`, `BookingStatus`, `AuthUser`,
`AppCapability`, `AreaOption`.

### Money rule

All amounts from the API are **integer kobo (NGN × 100)**. The `@staynex/shared`
`formatKoboToNGN` helper converts at the render layer only. Never divide by 100,
never hardcode `"₦"`, never do arithmetic on amounts in the mobile app.

### Auth contract

`AuthUser` has a `capabilities: AppCapability[]` field (always contains `"GUEST"`;
`"OWNER"` added when granted). Use `capabilities` for access decisions in Phase 5+.
For Phase 0–1, the guest flow only; `role === "GUEST"` is sufficient.

### Payment flow (critical — do not deviate)

1. Guest completes hold (`POST /bookings/holds`)
2. Guest signs in or registers (`POST /auth/login` or `/auth/register`)
3. App calls `POST /checkout` with `{ holdId, email }` → receives `CheckoutResult`
4. App opens `authorizationUrl` via `expo-web-browser` (`openAuthSessionAsync`)
5. When the browser session ends (user returns), app polls `GET /payments/:reference`
   on a 3-second interval until `paymentStatus === "SUCCESS"` or a terminal failure
6. On `SUCCESS`: navigate to `GET /bookings/:id` → show `BookingView`
7. On `FAILED`/`EXPIRED`: show failure state + "try again" path
8. **The app never sets `CONFIRMED` client-side.** It reads the state from the API.

### Booking-state non-negotiables

- Holds expire: always surface `HoldSummary.expiresAt` as a countdown. If
  `expired: true`, re-run the quote flow — do not proceed to checkout.
- A confirmed booking is only confirmed when the API says so.
- Never store or transmit raw card data. Paystack's hosted URL is the only
  card-data surface.

### Workspace integration caveats

- Metro + pnpm symlinks: Metro must be configured with `watchFolders` pointing
  to `packages/shared` and `staynex-backend/types`, and the resolver must handle
  pnpm's symlinked node_modules. Validate this **before** any other Phase 0 work.
- `import type` only from `@staynex/backend/types`. Metro never bundles these;
  `tsc` validates them. The `exports` field in `staynex-backend/package.json`
  must map `"./types"` to `"./types/index.ts"` (for TypeScript resolution) with
  `"types"` condition.
- `@staynex/shared` is a runtime dependency (formatter, labels, tokens run on
  device). Its `main`/`module` must point to a buildable/directly importable entry.

---

## TASK

Implement **Phase 0** and **Phase 1** of `staynex-mobile/staynex-mobile-plan.md`
as a set of production-ready source files.

### Phase 0 deliverables

1. **`pnpm-workspace.yaml`** — add `staynex-mobile` and `packages/*`
2. **`packages/shared/`** — `@staynex/shared` package:
   - `src/money.ts` — `formatKoboToNGN(kobo: number): string`
   - `src/labels.ts` — `BOOKING_STATUS_LABELS`, `PAYMENT_STATE_LABELS`,
     `PAYOUT_STATUS_LABELS` maps (matching `staynex-frontend/src/lib/types.ts`)
   - `src/tokens.ts` — brand design tokens from skill.md §6 (primary color,
     neutrals, spacing scale, border radius, typography scale)
   - `src/index.ts` — re-exports all of the above
   - `package.json` with `name: "@staynex/shared"`, `main: "src/index.ts"`,
     TypeScript types pointing to `src/index.ts`; zero runtime deps
   - `tsconfig.json` extending root or a base
3. **`staynex-backend/package.json`** — add `exports` map:
   ```json
   "exports": {
     "./types": {
       "types": "./types/index.ts",
       "default": "./types/index.ts"
     }
   }
   ```
4. **`staynex-mobile/`** — Expo Router skeleton:
   - `package.json` — `name: "@staynex/mobile"`, Expo SDK (current), Expo Router,
     React Native, TanStack Query, Zustand, `@react-native-cookies/cookies`,
     `expo-secure-store`, `expo-web-browser`, `expo-font`, dev deps include
     `@staynex/backend` and `@staynex/shared`
   - `app.config.ts` — Expo config with `extra: { apiBaseUrl, googleClientId }`
     sourced from `process.env.STAYNEX_API_BASE_URL` and
     `process.env.GOOGLE_CLIENT_ID` (never hardcoded)
   - `eas.json` — development, preview, production build profiles
   - `metro.config.js` — pnpm monorepo resolver + `watchFolders` for
     `packages/shared` and `staynex-backend/types`
   - `tsconfig.json` — extends Expo base; path aliases for `@/`
   - `src/core/client.ts` — typed fetch wrapper:
     - Reads `API_BASE_URL` from app config
     - Manages the `staynex_session` cookie via `expo-secure-store`: captures
       `Set-Cookie` on login/register responses, sends `Cookie:` header on all
       subsequent requests
     - Maps non-2xx responses to a typed `ApiError` shape
     - Exports `api.get<T>`, `api.post<T>`, `api.patch<T>`, `api.delete<T>`
   - `src/core/session.ts` — Zustand slice: current `AuthUser | null`, hydrate
     from `GET /auth/me` on cold start, clear on logout
   - `src/core/env.ts` — typed wrapper around `Constants.expoConfig.extra`
   - `app/(tabs)/search.tsx` — one live screen: calls
     `GET /search?city=Calabar` and renders `PropertySummary[]` cards (cover
     image from `coverImageUrl`, property name, city, from-price via
     `formatKoboToNGN`). Types come from `@staynex/backend/types`. Loading,
     empty, and error states handled.

### Phase 1 deliverables

5. **City picker + search form**
   - `app/(tabs)/search.tsx` extended: city picker from `GET /catalog/cities`,
     area picker from `GET /areas?city=`, date pickers, guest count; builds
     query params and calls `GET /search`
6. **Results list** — `src/ui/PropertyCard.tsx`: cover image, name, city,
   from-price (kobo→NGN), status badge (APPROVED only in results)
7. **Stay detail** — `app/stays/[slug].tsx`:
   - `GET /stays/:slug` → `PropertyDetail`
   - Media gallery (horizontal scroll)
   - Room types list: name, max guests, nightly price
   - Per-room availability calendar from
     `GET /availability/room-types/:id?from=&to=`
   - "Book" CTA per room type
8. **Quote → Hold** — `app/booking/quote.tsx`:
   - `POST /bookings/quote` on date selection → show `totalKobo` as NGN
   - `POST /bookings/holds` → navigate to hold detail
   - Show `expiresAt` countdown; if `expired`, route back to detail
9. **Auth gate** — `app/(auth)/login.tsx` + `app/(auth)/register.tsx`:
   - Register: `POST /auth/register` with `{ email, password, name,
     role: "GUEST" }`; capture `Set-Cookie`; store in `expo-secure-store`;
     update session Zustand slice
   - Login: `POST /auth/login`; same cookie handling
   - Navigation: if unauthenticated at checkout, redirect to login/register
     with holdId preserved in navigation params; after auth, return to checkout
   - `GET /auth/me` called on app cold start to rehydrate session
10. **Checkout** — `app/booking/checkout.tsx`:
    - `POST /checkout` with `{ holdId, email }` (email from session)
    - Open `authorizationUrl` via `expo-web-browser.openAuthSessionAsync`
    - On return: navigate to payment status screen
11. **Payment status** — `app/payment/[reference].tsx`:
    - Poll `GET /payments/:reference` every 3 seconds
    - Render INITIATED, PENDING, SUCCESS, FAILED, REFUNDED states honestly
    - On SUCCESS: navigate to booking confirmation
    - On terminal failure: show failure UI + "Go back and try again" CTA
    - Abort poll after 10 minutes (timeout state)
12. **Confirmation** — `app/booking/confirmation.tsx`:
    - `GET /bookings/:id` from the `PaymentStatusView.bookingId`
    - Show: property name, room, check-in/out, total paid (NGN via formatter)
    - "Done" → navigate home; "View trips" → (stub for Phase 2)
13. **Error, empty, and loading states** on every screen — no screen is allowed
    to show a blank screen on API failure or network loss.

---

## CONSTRAINTS

1. **No contract re-encoding.** Zero local copies of `BookingStatus`,
   `PaymentState`, `AvailabilityQuote`, `HoldSummary`, or any other type from
   `staynex-backend/types/api.ts`. Every API type used in mobile must be imported
   with `import type { … } from "@staynex/backend/types"`.

2. **No client-side business logic.** Never compute prices, derive availability,
   calculate nights, or determine booking eligibility on-device. If the API gives
   you `nights: 3`, display it. If the API gives you `totalKobo: 45000`, format
   it. Do not re-derive it.

3. **No client-side booking state.** `CONFIRMED` status is never set by the mobile
   app. It is read from `GET /bookings/:id` and `GET /payments/:reference` only.

4. **No raw card data.** Payment is exclusively via `authorizationUrl`. The app
   never touches card numbers, CVV, or expiry dates.

5. **No hardcoded secrets or URLs.** `STAYNEX_API_BASE_URL` and `GOOGLE_CLIENT_ID`
   come from `app.config.ts` via EAS env / `process.env`. No string literals for
   the API base URL anywhere except `src/core/env.ts` + `app.config.ts`.

6. **No bearer tokens.** Session cookie only. The `Cookie:` header is set manually
   from the persisted session. No `Authorization` header is ever added.

7. **No Prisma schema changes pushed to the live DB.** If a schema change is
   identified as needed for Phase 3+ features, report the exact
   `prisma migrate deploy` command. Do not run it.

8. **Money formatting: `@staynex/shared` only.** No `/ 100`, no `"₦"` literals,
   no `Intl.NumberFormat` at the call site. Every price display goes through
   `formatKoboToNGN` from `@staynex/shared`.

9. **Hold expiry must be surfaced.** If `HoldSummary.expired === true` at any
   point in the booking flow, the app must stop the checkout path and return the
   user to the quote step with a clear expiry message.

10. **`expo-doctor` must pass** before Phase 0 exit gate is declared. Fix all
    warnings, not just errors.

11. **`tsc --noEmit` must pass** in `staynex-mobile` package with zero errors.
    Type assertions (`as`) are only permitted at API response boundaries where
    the response type is verified by the server contract.

12. **Every screen must have three explicit states:** loading (skeleton or
    spinner), empty (no results message), and error (API failure message + retry
    CTA). No screen may show a blank white screen in any of these states.

13. **Metro symlink resolution must be verified first.** If Metro cannot resolve
    `@staynex/backend/types` from within the mobile package, stop and fix the
    `metro.config.js` + resolver before writing any feature code.

14. **Do not add the Staynex AI (Phase 4), push notifications (Phase 3), or
    Owner Lite (Phase 5) features.** These are out of scope. Any stubs for them
    must be explicitly marked with `// Phase N — out of scope` comments.

---

## OUTPUT FORMAT

Deliver the implementation as:

1. **New files:** full file content with path header comment
   (`// staynex-mobile/src/core/client.ts`).
2. **Modified files:** the full modified content (not diffs — the agent will
   write these directly).
3. **After all files:** a **Phase 0 gate checklist** and a **Phase 1 gate
   checklist**, each as a markdown task list the engineer runs manually:
   - Phase 0: `expo-doctor`, `pnpm --filter @staynex/mobile tsc --noEmit`,
     app cold-start on Android emulator, live `GET /search?city=Calabar` renders
     real data, EAS Android build succeeds
   - Phase 1: full booking loop in Paystack test mode (search → confirmed),
     expired-hold path tested, failed-payment path tested, booking visible on
     owner web dashboard at `http://localhost:3000/owner/bookings`
4. **No TODOs** in delivered code except where explicitly permitted by a
   `// Phase N — out of scope` comment.

---

## EXAMPLES

### How the fetch client should handle session cookies

The existing web frontend's `staynex-frontend/src/lib/api.ts` shows the typed
request pattern. The mobile version differs in one critical way: instead of
`credentials: "include"` (browser cookie jar), the native fetch client must:

```typescript
// On login/register — capture the session cookie from the response
const res = await fetch(`${API_BASE}/auth/login`, { method: "POST", body: ... });
const cookieHeader = res.headers.get("set-cookie");
if (cookieHeader) {
  const match = cookieHeader.match(/staynex_session=([^;]+)/);
  if (match) await SecureStore.setItemAsync("staynex_session", match[1]);
}

// On every subsequent request — replay the cookie
const token = await SecureStore.getItemAsync("staynex_session");
const headers: HeadersInit = { "Content-Type": "application/json" };
if (token) headers["Cookie"] = `staynex_session=${token}`;
```

### How money must be formatted

```typescript
// ✅ Correct — single call to the shared formatter
import { formatKoboToNGN } from "@staynex/shared";
<Text>{formatKoboToNGN(property.fromPriceKobo)}</Text>

// ❌ Wrong — raw division and symbol at call site
<Text>₦{(property.fromPriceKobo / 100).toLocaleString()}</Text>
```

### How API types must be imported

```typescript
// ✅ Correct — import type from the canonical source
import type { PropertySummary, AvailabilityQuote } from "@staynex/backend/types";

// ❌ Wrong — local copy of the contract
export interface PropertySummary { id: string; name: string; ... }
```

### How payment status polling should work

```typescript
// Poll until terminal state — never assume confirmed on the client
const TERMINAL: PaymentState[] = ["SUCCESS", "FAILED", "REFUNDED"];
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 min

async function pollPaymentStatus(reference: string): Promise<PaymentStatusView> {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const status = await api.get<PaymentStatusView>(`/payments/${reference}`);
    if (TERMINAL.includes(status.paymentStatus)) return status;
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Payment polling timed out");
}
```

---

## EVALUATION CRITERIA

An implementation is correct if and only if all of the following are true:

**(a) Booking loop works end-to-end in Paystack test mode.**
A test booking transitions `HOLD → PENDING_PAYMENT → CONFIRMED` and the
confirmed booking appears on `http://localhost:3000/owner/bookings`.

**(b) Expired-hold path is handled correctly.**
When `HoldSummary.expired === true`, the checkout flow stops and routes the
user back to the quote step with an explanatory message. No booking is created
for an expired hold.

**(c) Failed-payment path is handled correctly.**
When `paymentStatus === "FAILED"`, the app shows an honest failure UI with a
"Try again" CTA that routes back to the checkout start. No booking is marked
confirmed on the client.

**(d) `tsc --noEmit` passes in `staynex-mobile`.**
Zero TypeScript errors. No API contract types exist in any file under
`staynex-mobile/src/` — all types are `import type` from `@staynex/backend/types`.

**(e) `expo-doctor` passes.**
No unresolved peer deps, no config mismatches, no missing native modules.

**(f) EAS Android build succeeds.**
`eas build --platform android --profile preview` exits 0. The build can be
installed on a real device or emulator.

**(g) Money formatting is correct everywhere.**
`grep -r "/ 100\|\"₦\"\|'₦'" staynex-mobile/src/` returns zero matches.
All price display goes through `formatKoboToNGN` from `@staynex/shared`.

**(h) Session cold-start works.**
After killing and restarting the app, if the session cookie is still valid,
`GET /auth/me` rehydrates the user and the app routes to the correct state
(signed-in guest landing vs. search) without requiring a re-login.

**(i) No new contract copies exist.**
`grep -r "BookingStatus\|PaymentState\|AvailabilityQuote\|HoldSummary" staynex-mobile/src/ --include="*.ts" --include="*.tsx" | grep -v "import type"`
returns zero matches.

**(j) Every screen handles loading, empty, and error states.**
Manual test: disable network → all screens show an error state with a retry
option (no blank screens, no crashes).

---

## ITERATION

After producing all files:

1. **Review criteria (a)–(j) in order.** For each one that would fail, revise
   the relevant files before outputting the final deliverable.
2. **Specifically verify (d) mentally:** for every file in `staynex-mobile/src/`,
   confirm that any API type reference is an `import type` from
   `@staynex/backend/types`, not a locally defined interface.
3. **Specifically verify (g) mechanically:** search your output for `/ 100`,
   `"₦"`, `'₦'`. If any match is not in a comment or in `@staynex/shared/money.ts`,
   replace it with `formatKoboToNGN(...)`.
4. **Verify Metro config resolves the workspace.** Mentally trace the import
   `import type { PropertySummary } from "@staynex/backend/types"` through the
   `metro.config.js` resolver you wrote. Confirm it resolves to
   `staynex-backend/types/index.ts` via the workspace symlink.
5. **Only then output the final implementation.** Show only the final version —
   no draft/revised sections, no "here's what I changed" commentary inline. The
   checklists (Phase 0 gate, Phase 1 gate) appear once, at the end.
