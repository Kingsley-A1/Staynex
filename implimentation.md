# Staynex Implementation Plan

This plan converts the 4-week roadmap in `Staynex_plan.md` into four actionable phases. Each phase should be run as vertical slices with clear agent prompts, acceptance criteria, and verification.

## Agent Operating Model

Use agents as scoped executors, not vague assistants. Every agent task should be written as a specification using this structure from `Prompting Mastery.docx`:

```txt
Role -> Goal -> Context -> Task -> Constraints -> Output Format -> Examples -> Evaluation Criteria -> Iteration
```

For most engineering tasks, use at least:

- Role: the specialist required, such as Prisma engineer, NestJS engineer, Next.js frontend engineer, product designer, QA reviewer.
- Goal: the outcome above the code change.
- Context: relevant files, phase, architecture boundary, and current constraints.
- Task: exact files, modules, or routes to create/update.
- Constraints: no prototype edits, Prisma over Drizzle, no unsafe payment/AI claims, preserve monorepo boundaries.
- Output Format: code changes plus concise handoff.
- Evaluation Criteria: typecheck/build, route works, schema is valid, UI responsive, tests or documented gaps.
- Iteration: self-review against criteria before final handoff.

Agent use should follow these rules:

- One agent owns one bounded outcome.
- Backend state authority stays with backend agents.
- Frontend agents consume contracts and mock/API data, but do not create business authority.
- QA/review agents run after implementation agents, not before the work is coherent.
- Documentation agents update docs only after architecture decisions are made.

## Phase 1 - Foundation And System Shape

Goal: establish the professional project structure, tooling, database foundation, environment validation, and first shared product primitives.

What we are working on:

- Finalize `staynex-frontend` and `staynex-backend` boundaries.
- Configure pnpm workspace, TypeScript, formatting, and baseline scripts.
- Setup Next.js app shell in `staynex-frontend`.
- Setup NestJS API shell in `staynex-backend`.
- Setup Prisma in `staynex-backend/prisma`.
- Model core entities in Prisma: users, roles, location hierarchy, properties, rooms, availability, booking holds, bookings, payments, notifications, audit logs, and AI logs.
- Create shared contracts in `staynex-backend/types`.
- Define design tokens and basic UI primitives in `staynex-frontend/src/ui`.
- Seed launch cities and sample properties.

Acceptance criteria:

- Root workspace can install with pnpm.
- Frontend and backend packages are discoverable by workspace filters.
- Prisma schema validates and generates a client.
- TypeScript checks run for changed packages.
- Environment variables are documented in `.env.example`.
- No Drizzle dependency exists in the main project.
- `skill.md`, `docs/architecture.md`, and this plan agree on project structure.

Primary agents:

- Architecture agent: verifies folder boundaries and dependency direction.
- Prisma agent: creates schema and seed foundation.
- Backend scaffold agent: wires NestJS modules.
- Frontend scaffold agent: wires Next.js route groups and tokens.
- QA agent: validates install, typecheck, and structure.

## Phase 2 - Owner, Property, Room, Media, And Approval Slice

Goal: let owners create bookable supply and let admins approve it.

What we are working on:

- Owner onboarding flow.
- Property creation and edit flow.
- Room type and room unit setup.
- Image upload foundation using Cloudflare R2 abstraction.
- Property and room media models/services.
- Owner dashboard KPI shells: bookings, available rooms, pending actions, estimated earnings, property status.
- Admin property approval queue and property review page.
- Property card component and room gallery carousel.
- Availability calendar v1 for owners/admins.

Acceptance criteria:

- Owner can create a property draft.
- Owner can add room types and room units.
- Owner can attach/upload property and room images through a clear abstraction.
- Admin can review submitted property information and approve/reject/request changes.
- Property cards render with image carousel, price, location, status, and dominant action.
- Availability calendar stores and displays available capacity by date.
- Admin override writes an audit log.
- Mobile layouts work for owner and admin core pages.

Primary agents:

- Owner experience agent: builds onboarding and owner dashboard pages.
- Media/storage agent: builds R2 abstraction and upload flow.
- Backend properties agent: implements property, room, media, and approval modules.
- Admin operations agent: builds approval review workflow.
- Design QA agent: reviews card quality, responsive behavior, and accessibility.

## Phase 3 - Guest Booking And Payment Loop

Goal: prove the core commercial loop from search to payment-confirmed booking.

What we are working on:

- Public home/search entry.
- Search results by city and date.
- Property detail page with room options.
- Availability check endpoint and UI.
- Booking hold creation with expiry.
- Checkout page with guest details and price summary.
- Paystack test payment initiation.
- Paystack webhook verification.
- Payment status page.
- Booking confirmation page.

Acceptance criteria:

- Guest can search by city and date.
- Guest can view property cards and property details.
- Guest can select a room and check availability.
- System creates a booking hold before checkout.
- Hold expiry prevents stale checkout.
- Guest can initiate Paystack test payment.
- Verified Paystack webhook confirms booking.
- Unverified or failed payment does not confirm booking.
- Confirmation page shows booking, property, room, dates, payment status, and support actions.
- Booking creation and confirmation are transactional where required.

Primary agents:

- Search/frontend agent: builds search, results, and detail pages.
- Availability/backend agent: implements availability queries and hold logic.
- Checkout agent: builds checkout and payment status UX.
- Payments agent: implements Paystack initiation and webhook verification.
- Transaction QA agent: stress-reviews booking/payment state transitions.

## Phase 4 - Notifications, Dashboards, AI Assistant, QA, And Demo Readiness

Goal: make the POC operationally credible for hotel partners, owners, admins, and internal review.

What we are working on:

- Resend confirmation email.
- Owner booking notification foundation with Firebase Cloud Messaging.
- Owner booking dashboard with KPI cards and booking list.
- Admin booking dashboard with bookings, payments, owners, guests, audit logs, and user management pages.
- Staynex Assistant prototype with bounded tool-first behavior.
- AI conversation and AI action log visibility.
- Mobile polish across public, owner, and admin flows.
- POC QA pass and partner demo preparation.

Acceptance criteria:

- Guest receives confirmation email after verified booking.
- Owner can see booking in dashboard and notification foundation is wired.
- Admin can see booking, payment, owner, property, and audit history.
- AI assistant does not promise refunds, availability, payment confirmation, or financial action without platform verification.
- AI logs are visible to admin.
- Booking flow is clean on mobile.
- POC demo can show the full loop end to end with realistic sample data.
- Known limitations are documented clearly.

Primary agents:

- Notifications agent: implements email and push notification foundations.
- Dashboard agent: builds owner/admin operational views.
- AI agent: builds assistant prototype and safety boundaries.
- Mobile polish agent: audits responsive layouts and accessibility.
- Demo QA agent: runs final POC script and records blockers.

## Standard Agent Prompt Template

Use this template when delegating real implementation work:

```txt
Role:
You are a [SPECIALIST] working on Staynex.

Goal:
Deliver [OUTCOME] for Phase [N] so that [BUSINESS RESULT].

Context:
- Read skill.md first.
- Architecture: frontend lives in staynex-frontend, backend lives in staynex-backend.
- Relevant files: [FILES].
- Current constraint: [CONSTRAINTS].

Task:
1. [EXACT TASK]
2. [EXACT TASK]
3. [EXACT TASK]

Constraints:
- Do not modify staynex-prototype unless explicitly asked.
- Use Prisma, not Drizzle.
- Preserve frontend/backend dependency boundaries.
- Do not mark payment, booking, availability, or AI authority as complete without verification.

Output Format:
- Summary
- Files changed
- Checks run
- Known limits
- Next step

Evaluation Criteria:
- [CHECK 1]
- [CHECK 2]
- [CHECK 3]

Iteration:
Before final output, review your work against the evaluation criteria. Fix failures you can fix directly. Document anything blocked.
```

## Execution Discipline

Build phase by phase. Within each phase, ship vertical slices that create working behavior across frontend, backend, database, and QA when the feature requires it.

Do not start Flutter, dynamic pricing, real payout settlement, channel manager integration, dispute resolution, or tax complexity until the web POC proves the booking loop.
