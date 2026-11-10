# Start Here

You are working in the Staynex monorepo. This page exists so you never have to
guess which document to read. Find your task below, read only what it lists,
then start.

If you read nothing else, read these three rules:

1. **`skill.md` is the source of truth.** When any other document disagrees
   with it, `skill.md` wins. Fix the other document.
2. **Run `pnpm db:generate` before `pnpm check` on a fresh clone.** Backend
   types are generated from the Prisma schema. Skipping this produces dozens of
   type errors unrelated to your change.
3. **Never mark work complete without running the gate.** See
   [`../CONTRIBUTING.md`](../CONTRIBUTING.md).

## Route by task

| Your task                                 | Read these, in order                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setting up the repo for the first time    | [`../README.md`](../README.md) → [`../CONTRIBUTING.md`](../CONTRIBUTING.md)                                                                             |
| Anything touching product behaviour or UI | [`../skill.md`](../skill.md) (follow its §1 Agent Routing)                                                                                              |
| Finding an endpoint, module, or env var   | [`../MAIN-ARCHITECTURE.md`](../MAIN-ARCHITECTURE.md)                                                                                                    |
| Which package does this code belong in?   | [`architecture.md`](architecture.md) — boundary rules                                                                                                   |
| Running a command, test, or build         | [`../COMMANDS.md`](../COMMANDS.md)                                                                                                                      |
| Booking, payment, or refund logic         | [`../skill.md`](../skill.md) §9 → [`../MAIN-ARCHITECTURE.md`](../MAIN-ARCHITECTURE.md) → [`future/payment-settlement.md`](future/payment-settlement.md) |
| Manual/terminal QA of the AI assistant    | [`../AI-TERMINAL-TESTING.MD`](../AI-TERMINAL-TESTING.MD)                                                                                                |
| Long-range product plan                   | [`../Staynex_plan.md`](../Staynex_plan.md), `Staynex_Blueprint.pdf`                                                                                     |

## Directory contracts

Each of these says what belongs in that directory and what does not. Read the
one for the directory you are about to edit — it is shorter than the mistake.

| Directory                          | Contract                                                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `staynex-backend/src/modules/`     | [modules/README.md](../staynex-backend/src/modules/README.md) — module layout, thin controllers, the rules that fail review |
| `staynex-frontend/src/ui/`         | [ui/README.md](../staynex-frontend/src/ui/README.md) — generic primitives only                                              |
| `staynex-frontend/src/components/` | [components/README.md](../staynex-frontend/src/components/README.md) — app chrome                                           |
| `staynex-frontend/src/features/`   | [features/README.md](../staynex-frontend/src/features/README.md) — domain slices                                            |
| `staynex-frontend/src/lib/`        | [lib/README.md](../staynex-frontend/src/lib/README.md) — API client and contract re-exports                                 |
| `packages/shared/`                 | [shared/README.md](../packages/shared/README.md) — framework-agnostic shared contracts                                      |
| `staynex-mobile/`                  | [mobile/README.md](../staynex-mobile/README.md) — Expo app, env, and two known traps                                        |

## The map

```txt
README.md              What Staynex is, layout, quickstart
docs/START-HERE.md     You are here. Routing table.
skill.md               SOURCE OF TRUTH: product, design, architecture standards
CONTRIBUTING.md        Setup, workflow, verification gate, handoff format
COMMANDS.md            Every command and when to run it
MAIN-ARCHITECTURE.md   Engineering map: modules, endpoints, env vars
AI-TERMINAL-TESTING.MD Manual QA script for the AI assistant
Staynex_plan.md        Long-range product plan
docs/
  HANDOFF.md           In-flight branches, merge order, unfinished work
  architecture.md      Package boundary rules (what may import what)
  future/              Designed but not yet built
  archive/             HISTORICAL ONLY. Never follow. See below.
```

## What not to read

`docs/archive/` holds superseded plans and one-off QA notes, kept only so past
decisions stay traceable. Every file there opens with an `ARCHIVED` banner.
**Never treat anything in `docs/archive/` as current.** If it contradicts
`skill.md`, `skill.md` is right.

`docs/future/` describes work that is designed but **not built**. Do not assume
code exists because a document there describes it. Verify in the codebase first.

## Ground rules for AI agents

- **Verify before you claim.** Run the command and read the output. Do not
  report a build, test, or typecheck as passing unless you saw it pass.
- **Match the surrounding code.** Follow existing conventions rather than
  introducing new patterns. `skill.md` §1: "Do not invent a new architecture
  when the monorepo already defines a boundary."
- **Respect package boundaries.** Frontend and mobile must not import backend
  services, Prisma, or database clients. Shared contracts only. See
  [`architecture.md`](architecture.md).
- **No hardcoding.** `skill.md` opens with this rule. Configuration, copy, and
  fixtures belong in their designated homes, not inline in components.
- **Finish with the handoff format** in `skill.md` §13.
