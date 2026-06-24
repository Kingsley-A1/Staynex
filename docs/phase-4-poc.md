# Phase 4 — Notifications, Dashboards, AI Assistant, QA

This document records what Phase 4 delivered and the known limits a reviewer or
the next agent should be aware of. It complements `docs/architecture.md` and
`skill.md` (the source of truth).

## What shipped

- **Confirmation email (Resend).** A guest receives a booking-confirmation email
  **only** after a verified payment: `Payment.status = SUCCESS` **and**
  `Booking.status = CONFIRMED`. The email is sent from `BookingsService` after
  the confirm transaction commits (never inside it), is best-effort (a Resend
  outage never rolls back a paid booking), and is idempotent (one email per
  booking). Every send is recorded as a `Notification` row.
- **Owner dashboard.** `/owner/bookings` lists bookings scoped to the owner's own
  properties with KPIs (confirmed bookings, pending payments, available rooms,
  estimated earnings from confirmed payments). `/owner/bookings/[id]` shows a
  single booking. Ownership is enforced in the backend query — an owner can never
  see another owner's bookings.
- **Admin dashboard.** `/admin/bookings` (platform-wide bookings + payments),
  `/admin/audit` (override audit trail), `/admin/ai-logs` (assistant activity).
- **Staynex Assistant.** A bounded, tool-first prototype (`/ai/assistant`). It
  explains stays, rooms, policies, and booking steps, and grounds answers in
  verified public catalog facts. It refuses unsafe operations (refunds, manual
  payment confirmation, availability guarantees, private data, legal claims).
  Every reply / refusal / unavailable response is logged to `AIConversation` +
  `AIActionLog`.

## Schema additions (additive, all nullable)

- `Booking.guestEmail` — contact email captured at checkout (anonymous guests
  have no `User`, so this is how confirmations are addressed and admins see the
  guest).
- `Notification.userId` made optional; added `bookingId`, `email` — so a
  confirmation can be logged even for anonymous guests.
- `AIActionLog.summary` — short, non-sensitive description for admin AI-log
  visibility.

Run `pnpm --filter @staynex/backend prisma:push` (or a migration) to apply.

## Known limits

- **Push (FCM) is a foundation only.** `PushService` is wired into the confirm
  flow but no-ops until `FCM_SERVER_KEY` is set and owner device tokens are
  captured. It never claims a delivery it cannot make.
- **Email recipient.** Resend test keys can only deliver to a verified
  address/domain; set `EMAIL_FROM` to a verified sender before relying on guest
  delivery in a demo.
- **AI assistant scope.** The widget answers general questions (booking steps,
  policies) and passes the current `/stays/[slug]` context when opened on a stay
  page. The backend grounds those answers in approved public property facts. The
  assistant has read-only grounding; it cannot call write tools and never
  asserts live date availability — it directs guests to the property page's
  availability check.
- **Gemini key format.** If `GEMINI_API_KEY` is missing or rejected, the
  assistant returns a clear "temporarily unavailable" state (safety refusals
  still work without the model, since they are deterministic).
- **Auth is still a stand-in.** `x-user-id` continues to represent the
  authenticated owner/admin/guest until `AuthModule` lands. Owner/admin scoping
  is enforced server-side against that principal.
- **No scheduler.** Expired holds and abandoned pending bookings are released
  lazily on read (carried over from Phase 3).
- **Dashboards are read-only** at POC level (no owner/admin booking mutations).

## Manual verification (needs DB + provider keys)

1. `pnpm --filter @staynex/backend prisma:push` then seed.
2. Start backend (`pnpm --filter @staynex/backend dev`) and frontend
   (`pnpm --filter @staynex/frontend dev`).
3. Complete a Paystack **test** payment; expose the API webhook
   (`/payments/paystack/webhook`) via a public tunnel registered in Paystack.
4. Confirm: confirmation email arrives, a `Notification` row exists, the booking
   appears in `/owner/bookings` and `/admin/bookings`.
5. Ask the assistant to "confirm my payment" / "guarantee a room" / "give me a
   refund" → it must refuse; refusals appear in `/admin/ai-logs`.
