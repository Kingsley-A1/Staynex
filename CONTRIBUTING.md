# Contributing to Staynex

How to set up, change, verify, and hand off work in this repository. For
*what* to build and to what standard, see [`skill.md`](skill.md). For the full
command list see [`COMMANDS.md`](COMMANDS.md).

## 1. Setup

```bash
pnpm install
pnpm db:generate     # REQUIRED. Backend types are generated from Prisma.
pnpm check           # should pass cleanly before you change anything
```

Use `pnpm`. Not `npm`, not `yarn`. The lockfile is `pnpm-lock.yaml`.

If `pnpm check` fails before you have made any change, the usual cause is a
stale Prisma client. Run `pnpm db:generate` and check again.

### Environment

Copy `.env.example` to `.env` in the package you are running and fill it in.
Never commit `.env` files or provider secrets. Database commands will not work
until `DATABASE_URL` is set correctly.

## 2. Branching and commits

Branch off `main`:

```bash
git switch -c <type>/<short-description>
```

Use Conventional Commits, matching the existing history:

```txt
feat(bookings): expire holds after 15 minutes
fix(vouchers): stop the broken QR image on the confirmation page
chore(repo): prune dead files
docs(architecture): document the payout ledger
test(payments): cover webhook signature rejection
```

Scope is the affected area: `bookings`, `payments`, `host`, `admin`, `mobile`,
`frontend`, `backend`, `shared`, `repo`, `docs`.

Write the body to explain **why**, not what. The diff already shows what.

## 3. Where code goes

| Kind of code | Home |
| --- | --- |
| Route, page, web UI | `staynex-frontend/src/` |
| API module, business logic | `staynex-backend/src/modules/<domain>/` |
| Database schema | `staynex-backend/prisma/schema.prisma` |
| Backend-owned domain/API types | `staynex-backend/types/` |
| Mobile screen | `staynex-mobile/app/` |
| Mobile UI primitive | `staynex-mobile/src/ui/` |
| Used by more than one app | `packages/shared/src/` |

Hard boundary: **frontend and mobile must never import backend services,
Prisma, or database clients.** They may import types and shared contracts only.
See [`docs/architecture.md`](docs/architecture.md).

If the same constant, label, or format helper is needed in two apps, it belongs
in `packages/shared` — not copy-pasted. Divergent copies are how the mobile
payment screen silently lost a payment state.

## 4. The verification gate

Run this before you say work is complete. Every item must actually be run and
observed, not assumed.

```bash
pnpm db:generate     # if the Prisma schema changed
pnpm check           # typecheck all packages — must pass
pnpm test            # run the test suites — must pass
pnpm build           # if you touched build config or are handing off
```

Additionally, by area:

| You touched | Also verify |
| --- | --- |
| Frontend | `pnpm --filter @staynex/frontend build` (the Vercel-equivalent check) |
| Backend | `pnpm --filter @staynex/backend build` (the Railway-equivalent check) |
| Prisma schema | A migration is committed, not just `db:push` |
| Booking / payment | The relevant test suite passes; audit logging preserved |
| UI | Responsive and keyboard accessible; no dead CTAs in the booking loop |

`skill.md` §12 is the full quality gate. Read it before handing off.

## 5. Reporting your work

Be accurate about what you verified. If a check failed or you skipped it, say
so plainly — a false "all tests pass" is worse than a known gap.

End with the handoff format from `skill.md` §13:

```md
## Summary
## Files Changed
## Checks Run
## Known Limits
## Next Step
```

## 6. Rules that are not negotiable

From [`skill.md`](skill.md) §9. Breaking any of these is a blocking review
failure, regardless of how convenient the shortcut is.

- Booking creation must be transactional.
- No confirmed booking exists without verified payment.
- Availability must not go stale after checkout begins.
- Booking holds must expire.
- Payment webhooks must be verified before state changes.
- Every admin override must write to `AuditLog`.
- AI must not promise availability, refunds, confirmations, legal outcomes, or
  financial actions without platform verification.
- Never store raw card data.
- Use signed uploads for private media flows.
