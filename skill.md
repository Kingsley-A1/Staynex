---
name: staynex-project-standard
description: Staynex operating standard for agents working on the hospitality booking platform. Use for product decisions, architecture, frontend, backend, database, AI, security, QA, documentation, or implementation work in the Staynex repository.
---
RULE: _No hardcoding_
# Staynex Project Standard

Staynex is a hospitality booking platform starting from Calabar and built for international expansion. Treat this file as the single source of truth for agent behavior in this repository.

Use `Staynex_plan.md`, `Staynex_Blueprint.pdf`, and `docs/architecture.md` as supporting references when the task needs deeper planning context. Use the legacy `staynex-prototype/` only as reference unless the user explicitly asks to modify it.

## 1. Agent Routing

Read only the sections relevant to the task after this overview.

- Product, planning, copy, or prioritization: read Sections 2, 3, 4, 11, and 12.
- Frontend or design work: read Sections 2, 5, 6, 10, 11, and 12.
- Backend or API work: read Sections 2, 4, 7, 8, 9, 11, and 12.
- Database or Prisma work: read Sections 4, 7, 8, 9, and 12.
- AI assistant work: read Sections 2, 9, 11, and 12.
- QA, review, or handoff work: read Sections 3, 10, 11, and 12.

Before editing code, inspect the existing structure and preserve current conventions. Do not invent a new architecture when the monorepo already defines a boundary.

Knowledge tiers:

- Must know by heart: product promise, booking loop, monorepo boundaries, Prisma over Drizzle, payment-before-confirmation, audit logs for admin overrides, and AI safety limits.
- Must recognize: route groups, domain entities, backend modules, design tokens, external services, and dashboard surfaces.
- Lookup-only: full blueprint details, long-term rollout plans, exact copy variations, legal/policy language, provider credentials, and implementation details outside the touched area.

## 2. Product North Star

Staynex helps guests book trusted stays clearly and gives property owners a reliable digital channel for visibility, availability, bookings, communication, and growth.

Core promise: `Book trusted stays.`

Positioning line: `Book trusted stays, Confidently.`

Origin context: launched in Calabar; designed to scale across Nigeria and beyond. Calabar is the launch wedge, not the architectural limit.

Do not design Staynex as a local directory. Calabar is the launch wedge, not the architectural limit.

## 3. Execution Priority

The booking loop is the center of the product:

```txt
Search -> View stay -> Check availability -> Select room -> Hold booking -> Pay -> Confirm -> Notify owner/admin
```

Prioritize complete vertical slices over scattered features. The first production-minded slice is:

```txt
Home/Search -> Search Results -> Property Detail -> Room Selection -> Checkout -> Payment Status -> Confirmation
```

Do not polish secondary features while the booking loop is broken or unverified.

## 4. Current Architecture

Main codebase structure:

```txt
staynex-frontend      Next.js + TypeScript frontend project
  src/                routes, components, features, styles, and UI

staynex-backend       NestJS + Prisma backend project
  src/                API modules
  prisma/             schema and migrations
  db/                 database client helpers
  types/              backend-owned domain and API contracts
  config/             environment and configuration helpers

docs/                 Architecture and project documentation
```

Primary stack:

- Web: Next.js, React, TypeScript
- API: NestJS, TypeScript
- Database: CockroachDB-compatible PostgreSQL through Prisma
- Storage: Cloudflare R2
- Web deployment: Vercel
- API deployment: Railway
- Payments: Paystack first
- Email: Resend
- Notifications: Firebase Cloud Messaging
- Maps: Google Maps
- AI: Google Gemini and Vercel AI SDK

Prisma is the database source of truth. Do not add Drizzle to the main codebase.

## 5. Web Product Surface

Public routes should support:

- `/`
- `/search`
- `/stays/[slug]`
- `/checkout`
- `/payment/status`
- `/booking/confirmed`
- `/about`
- `/legal`
- `/terms`
- `/policies`
- `/list-your-property`

Host routes (`/host/*` — the property-owner workspace; user-facing copy says "host") should support onboarding, properties, rooms, availability, bookings, earnings, settings, and support.

Admin routes should support overview, property approval, owners, guests, bookings, payments, users, audit logs, AI logs, and platform settings.

Lower-priority pages may start as route shells. The core booking loop must not remain a shell.

## 6. UI And Design Standard

Staynex should feel premium, calm, trustworthy, mobile-first, operationally serious, and globally credible.

Brand tokens:

- Primary: `#27187D`
- Background: `#F7F7FF`
- Ink: `#101014`
- Muted: `#6E6A83`
- Border: `#E7E5F2`
- Success: `#15803D`
- Warning: `#B7791F`
- Error: `#B42318`

Build with Apple-level clarity, Google Material structure, WCAG 2.2 accessibility, and strong mobile ergonomics.

Use cards for repeated properties, rooms, bookings, dashboard stats, and approvals. Keep cards clean: strong image, clear title, location, price, availability, status, and one dominant action.

Motion must clarify state. Use short transitions for drawers, carousels, steppers, skeletons, and assistant panels. Avoid distracting loops or decorative motion.

## 7. Domain Model

Core entities:

- User
- Role
- GuestProfile
- OwnerProfile
- Country
- Region
- City
- Property
- PropertyMedia
- RoomType
- RoomUnit
- RoomMedia
- AvailabilityCalendar
- BookingHold
- Booking
- Payment
- Payout
- Notification
- AuditLog
- AIConversation
- AIActionLog

Keep domain types in `staynex-backend/types`. Keep persistence schema in `staynex-backend/prisma/schema.prisma`. Frontend code may consume shared contracts, but it must not import backend services, database clients, or persistence logic.

## 8. Backend Modules

The API should be organized around these NestJS modules:

- AuthModule
- UsersModule
- PropertiesModule
- RoomsModule
- AvailabilityModule
- BookingsModule
- PaymentsModule
- NotificationsModule
- MediaModule
- AdminModule
- AiModule
- AuditModule

Keep controllers thin. Put business logic in services. Keep transaction-heavy booking/payment logic explicit and testable.

## 9. Non-Negotiable Business Rules

- Booking creation must be transactional.
- No confirmed booking exists without verified payment.
- Availability must not go stale after checkout begins.
- Booking holds must expire.
- Payment webhooks must be verified before state changes.
- Every admin override must write to `AuditLog`.
- AI must not promise availability, refunds, confirmations, legal outcomes, or financial actions without platform verification.
- Never store raw card data.
- Use signed uploads for private media flows.

## 10. Data And Mocking

Use real schema design even when data is mocked.

For mock/demo data, keep it centralized. Do not scatter property, room, booking, or city fixtures across components.

Launch cities to recognize in demos:

- Calabar
- Uyo
- Port Harcourt
- Lagos
- Abuja

Representative demo properties:

- Marina Crest Hotel
- Duke Town Suites
- Harbor Nest Apartments
- Tinapa Grand Resort

## 11. AI Agent Rules

Name: `Staynex Agent`

Staynex Agent is a professional AI agent that helps people find available stays on Staynex and guides them confidently through the booking journey: search, view a stay, check availability, hold, sign in, pay with Paystack, and confirmation. It may compare stays, explain room differences, read policies, navigate booking steps, and help owners improve listings.

The agent must not:

- Invent availability
- Confirm payment manually
- Promise refunds
- Change financial records
- Override booking rules
- Reveal private data
- Make legal claims
- Pretend to be human

The agent is tool-first: verify platform state before making operational claims. When availability is requested, guide the user to city/date search or the property's availability check rather than inventing it.

## 12. Quality Gate

Before marking work complete, verify the relevant items:

- Core route or module works at the expected level for the task.
- TypeScript passes or failures are clearly documented.
- UI is responsive and accessible when frontend work is touched.
- CTAs in the booking loop are not dead.
- Data lives in the right package or feature boundary.
- Security-sensitive flows do not trust client input.
- Payment, booking, and admin actions preserve auditability.
- New structure follows the monorepo boundaries.
- Legacy prototype files remain untouched unless explicitly requested.

Do not mark work complete if the product feels like a listing directory, the booking loop is broken, AI makes unsafe promises, or the implementation adds a shortcut that will obviously fail in production.

## 13. Agent Handoff

End implementation work with a concise handoff:

```md
## Summary

## Files Changed

## Checks Run

## Known Limits

## Next Step
```

Keep handoffs factual. Mention commands run, failures, and any assumptions that matter.
