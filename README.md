# Staynex

Staynex is a hospitality booking platform for trusted stays, launching in
Calabar and built to expand city by city and country by country.

**New here — human or AI agent? Read [`docs/START-HERE.md`](docs/START-HERE.md) first.**
It tells you which document to open for the task you have, so you don't have to
guess.

## Repository layout

```txt
staynex/
  staynex-frontend/   Next.js web app: public booking, host, and admin surfaces
  staynex-backend/    NestJS + Prisma API: bookings, payments, availability, AI
  staynex-mobile/     Expo / React Native guest app
  packages/shared/    Cross-app contracts: labels, tokens, formatting
  docs/               Architecture, guides, and archived history
```

All four packages are pnpm workspace members and are covered by `pnpm check`.

## Quickstart

```bash
pnpm install          # install all workspace dependencies
pnpm db:generate      # generate the Prisma client (required before typechecking)
pnpm check            # typecheck every package
```

`pnpm db:generate` is not optional on a fresh clone. The backend's types are
generated from `prisma/schema.prisma`, so skipping it produces dozens of
confusing type errors that have nothing to do with your change.

Then start what you need:

```bash
pnpm dev:frontend     # Next.js web app
pnpm dev:backend      # NestJS API (watch mode)
pnpm dev:mobile       # Expo dev server
```

## Core documents

| Document | What it is |
| --- | --- |
| [`docs/START-HERE.md`](docs/START-HERE.md) | Entry point. Routes you to the right doc for your task. |
| [`skill.md`](skill.md) | **Source of truth** for product, design, and architecture standards. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to set up, build, test, verify, and hand off work. |
| [`MAIN-ARCHITECTURE.md`](MAIN-ARCHITECTURE.md) | Engineering map: modules, endpoints, env vars, local recipes. |
| [`COMMANDS.md`](COMMANDS.md) | Every command in the repo and when to run it. |

## Non-negotiables

These are enforced, not aspirational. Full list in [`skill.md`](skill.md) §9.

- No confirmed booking without verified payment.
- Booking creation is transactional; holds expire.
- Payment webhooks are verified before any state change.
- Every admin override writes to `AuditLog`.
- Never store raw card data.
- Prisma is the database source of truth. Do not add Drizzle.
