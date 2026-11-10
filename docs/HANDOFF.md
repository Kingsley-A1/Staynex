# Handoff — 2026-11-10

Snapshot of in-flight work at the point development moved off the original
machine. Everything listed here is pushed to `origin`. Delete this file once
the three branches below are merged or abandoned.

## Summary

Three branches carry unmerged work. None has been merged to `main`.

| Branch                               | Base                       | Commits | What it is                                                                                                                                                          |
| ------------------------------------ | -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chore/repo-organization`            | `main` @ `113e104`         | 10      | Repo cleanup: dead files pruned, docs spine (`docs/START-HERE.md`), mechanical architecture rules, single API contract, per-domain API client, mobile in workspace. |
| `codex/payment-production-readiness` | `feature/Opay-integration` | 11      | Opay provider port plus production-readiness tasks 1–7 of `docs/superpowers/plans/2026-08-21-production-readiness-implementation.md` (on that branch).              |
| `staynex-mobile-staging`             | old `main` (pre-`113e104`) | 13      | Mobile Phases 1–5: booking loop, native payment return, returning-guest app, push/inbox, AI, Owner Lite.                                                            |

## Recommended merge order

1. **`chore/repo-organization` first.** It is structural and everything else
   should land on top of its layout.
2. **`codex/payment-production-readiness`.** Rebase onto the merged result.
   Known conflicts (confirmed with `git merge-tree`):
   - `staynex-frontend/src/lib/api.ts` — deleted by the cleanup (split into
     per-domain modules under `staynex-frontend/src/lib/api/`), modified by the
     payments branch (~10 lines). Port those edits into the matching
     per-domain module, then drop the file.
   - `staynex-frontend/src/lib/types.ts` — content conflict (~39 lines). The
     cleanup made `packages/shared` the single definition of the API
     contract; payment type changes belong there, not in the frontend.
3. **`staynex-mobile-staging`.** Rebase Phases 1–5 onto the result. The
   cleanup branch already re-did "join the pnpm workspace" (`e248ab8`) with
   fixes, so drop `5206ae5` and the early staging commits during the rebase
   rather than replaying them. `f289d2a` duplicates `364b779` on `main` by
   title; check whether it is already applied before keeping it.

## Checks Run

On 2026-11-10, against the branch tips listed above:

- `chore/repo-organization`: `pnpm db:generate && pnpm check` — passes, all
  four packages.
- `codex/payment-production-readiness`: `pnpm check` — passes.
- `staynex-mobile-staging`: not re-run.

`pnpm test` was not run on any branch.

## Known Limits

Production-readiness plan, not yet done (on the payments branch):

- **Task 7, step 5** — external sandbox acceptance against the real provider
  sandbox. The harness exists and its local tests are committed; it has not
  been run against a live sandbox.
- **Task 8** — Git workflow policy, branch-policy audit, and quality CI.
- **Task 9** — fresh-clone verification and evidence report.

Environment files (`staynex-backend/.env`, `staynex-frontend/.env.local`,
`staynex-mobile/.env`) are gitignored and are **not** in the repository. A new
machine needs them from the team's secret store; names and purpose are in
`MAIN-ARCHITECTURE.md`.

## Next Step

Open a PR for `chore/repo-organization` into `main`, run `pnpm test`, and
merge. Then rebase the payments branch as described above.
