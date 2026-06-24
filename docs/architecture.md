# Staynex Architecture

Staynex is split into two top-level project areas for separation of concern:

```txt
staynex/
  staynex-frontend/
    src/

  staynex-backend/
    src/
    prisma/
    db/
    types/
    config/

  docs/
  skill.md
  Staynex_plan.md
```

The root repository remains a pnpm workspace for orchestration, shared checks, and local development.

## Frontend Boundary

`staynex-frontend` owns user-facing product experience.

- `staynex-frontend/src/app` - Next.js route surfaces for public, owner, and admin experiences.
- `staynex-frontend/src/ui` - Frontend-owned UI primitives and shared presentation helpers.

Frontend responsibilities:

- Route structure and page composition.
- Responsive, accessible interface implementation.
- Design tokens, reusable UI components, and interaction states.
- Public search, property browsing, checkout, owner, and admin screens.
- API consumption through typed contracts.

Frontend must not:

- Import Prisma, database clients, backend services, or server-only persistence logic.
- Own payment verification, booking confirmation authority, or admin override authority.
- Duplicate backend business rules except as client-side validation hints.

## Backend Boundary

`staynex-backend` owns platform authority, data integrity, integrations, and contracts.

- `staynex-backend/src` - NestJS API boundary and modules.
- `staynex-backend/prisma` - Prisma schema and migrations.
- `staynex-backend/db` - Database client helpers.
- `staynex-backend/types` - Shared domain and API contracts.
- `staynex-backend/config` - Environment and configuration helpers.

Backend responsibilities:

- Auth, users, properties, rooms, availability, bookings, payments, notifications, media, admin, AI, and audit modules.
- Prisma data model and migrations.
- Transactional booking holds and booking confirmation.
- Payment webhook verification.
- Audit logs for admin overrides.
- Provider integrations: Paystack, Resend, Firebase Cloud Messaging, Cloudflare R2, Google Maps, and Gemini.

Backend must not:

- Depend on frontend components or UI packages.
- Trust client-side payment, booking, availability, or admin state.
- Let AI perform financial or availability claims without verified platform state.

## Shared Contracts

Contracts live in `staynex-backend/types` because the backend owns domain authority.

The frontend may import generated or copied contracts at the boundary, but the dependency direction must stay one-way:

```txt
frontend -> shared contracts <- backend
frontend -> API over HTTP
frontend -x backend internals
```

If a type represents API input/output, keep it in `staynex-backend/types`. If it represents database persistence only, keep it in Prisma and backend internals.

## Core Flow

The first POC must prove:

```txt
Property -> Room -> Availability -> Booking Hold -> Payment -> Confirmation -> Owner/Admin Notification
```

System authority:

- Frontend starts the user workflow.
- API validates requests and owns state changes.
- Prisma persists canonical state.
- Paystack webhook confirms payment.
- Booking confirmation happens only after verified payment.
- Owner/admin visibility is driven by backend state.

## Database

Use Prisma with CockroachDB-compatible PostgreSQL.

Primary schema path:

```txt
staynex-backend/prisma/schema.prisma
```

Core entities:

- User, GuestProfile, OwnerProfile
- Country, Region, City
- Property, PropertyMedia
- RoomType, RoomUnit, RoomMedia
- AvailabilityCalendar
- BookingHold, Booking
- Payment, Payout
- Notification
- AuditLog
- AIConversation, AIActionLog

Do not add Drizzle to the main project.

## Deployment Targets

- Frontend: Vercel
- Backend API: Railway
- Database: CockroachDB
- Storage: Cloudflare R2
- Email: Resend
- Notifications: Firebase Cloud Messaging
- Payments: Paystack
- AI: Google Gemini with Vercel AI SDK where appropriate

## Monorepo Deployment

Frontend and backend can stay in the same GitHub repository and deploy independently.

Recommended setup:

- Vercel project root: `staynex-frontend`
- Railway service root: `staynex-backend`
- Root workspace remains the source of lockfile and shared orchestration

Recommended build ownership:

- Vercel builds only the frontend project from `staynex-frontend/package.json`
- Railway builds only the backend project from `staynex-backend/package.json`
- Root `package.json` is for local orchestration, not for direct app deployment

## Legacy Prototype

`staynex-prototype/` is reference material only. Do not modify it unless the user explicitly asks.

## Agent Rule

All agents must start from `skill.md`, then use this document for architecture-specific decisions. For execution planning, use `implimentation.md`.
