# Backend Modules

One directory per domain. A module owns its HTTP surface, its business logic,
and its request/response shapes — and nothing outside its domain.

## File layout

A module is expected to look like `rooms/`, the smallest complete example:

```txt
rooms/
  rooms.module.ts      NestJS module: declares providers and imports
  rooms.controller.ts  HTTP surface. Thin.
  rooms.service.ts     Business logic. Where the real work goes.
  dto.ts               Request/response shapes and validation
```

Larger domains split the service rather than growing one file. `bookings/`
is the reference:

```txt
bookings/
  bookings.controller.ts          guest-facing endpoints
  owner-bookings.controller.ts    host-facing endpoints
  webhook.controller.ts           provider callbacks
  bookings.service.ts             the booking lifecycle
  booking-maintenance.service.ts  expiry and reconciliation
  booking-reports.service.ts      reporting reads
  report-mappers.ts               row -> view mapping
  util.ts, dto.ts
```

Split by responsibility — by the reason the code changes — not by line count.
A second controller because a different audience calls it is a good split. A
`bookings2.service.ts` is not.

## Rules

**Controllers are thin.** They validate input, call one service method, and
return. No business logic, no Prisma calls, no branching on domain state. If a
controller is making decisions, that logic belongs in the service.

**Services own the domain.** They may use Prisma directly. They must not
import another module's _controller_. Cross-domain work goes through the other
module's service, injected by Nest.

**Types belong in `types/`, not here.** Anything the frontend or mobile app
consumes goes in `staynex-backend/types/api.ts`, which is the single definition
of the API contract for every client. Keep `dto.ts` for
request validation shapes that are internal to the module.

**No new module without a home in the architecture.** `skill.md` §8 lists the
modules the API is organized around. If your work does not fit one, that is
worth a conversation before it becomes a directory.

## The rules that fail review

These come from `skill.md` §9 and are not style preferences. Booking and
payment code is where this repository is least forgiving:

- Booking creation must be transactional. Use an interactive transaction; do
  not write a partial booking and fix it up afterwards.
- No confirmed booking exists without verified payment.
- Payment webhooks must be verified before any state change. An unverified
  callback is untrusted input.
- Booking holds must expire, and availability must not go stale once checkout
  has begun.
- Every admin override writes to `AuditLog`. No exceptions, no "just this one".
- Never store raw card data.

## Adding a module

1. Create the directory with the four files above.
2. Register it in `src/app.module.ts`.
3. Put any client-facing types in `staynex-backend/types/api.ts`.
4. Add a test in `staynex-backend/test/` named `*.test.cjs` or `*.test.mjs`.
   It runs automatically — see [`../../../COMMANDS.md`](../../../COMMANDS.md).
5. Run `pnpm db:generate && pnpm check && pnpm test`.

## Shared helpers

Cross-cutting code lives in `../common/`: dates, env parsing, pagination,
rate limiting, the Prisma exception filter, and security wiring. Look there
before writing a helper — and put genuinely shared helpers there rather than
in a module that happens to need one first.
