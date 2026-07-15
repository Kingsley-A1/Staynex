# Staynex Commands

Operational command reference for the Staynex monorepo.

Run commands from the repository root unless a section says otherwise.

## Core Workflow

| Command | Use |
| --- | --- |
| `pnpm install` | Install all workspace dependencies from `pnpm-lock.yaml`. Run after cloning or when dependencies change. |
| `pnpm dev` | Start the frontend dev server through the root shortcut. Equivalent to `pnpm dev:frontend`. |
| `pnpm dev:frontend` | Start the Next.js frontend in development mode. |
| `pnpm dev:backend` | Start the NestJS backend in watch mode. |
| `pnpm check` | Run TypeScript checks across all workspace packages. Use before handoff. |
| `pnpm build` | Build all workspace packages that define a `build` script. Use before deployment or major handoff. |
| `pnpm format` | Format the repo with Prettier. |

## Frontend

Package: `@staynex/frontend`  
Path: `staynex-frontend`

| Command | Use |
| --- | --- |
| `pnpm --filter @staynex/frontend dev` | Start the Next.js app locally. |
| `pnpm --filter @staynex/frontend check` | Typecheck only the frontend. |
| `pnpm --filter @staynex/frontend build` | Create a production frontend build. This is the Vercel-equivalent build check. |
| `pnpm --filter @staynex/frontend start` | Start the built Next.js app locally after `build`. |

## Backend

Package: `@staynex/backend`  
Path: `staynex-backend`

| Command | Use |
| --- | --- |
| `pnpm --filter @staynex/backend dev` | Start the NestJS API locally in watch mode. |
| `pnpm --filter @staynex/backend check` | Typecheck only the backend. |
| `pnpm --filter @staynex/backend build` | Build the NestJS API into `staynex-backend/dist`. This is the Railway-equivalent build check. |
| `pnpm --filter @staynex/backend start` | Production start: apply pending Prisma migrations, then start the built backend. This is the Railway start command. |
| `pnpm --filter @staynex/backend start:runtime` | Start the built backend without running migrations. Use only for controlled local diagnostics after `build`. |

## Database And Prisma

Prisma lives in `staynex-backend/prisma`.

| Command | Use |
| --- | --- |
| `pnpm db:generate` | Root shortcut for generating Prisma Client. |
| `pnpm db:push` | Root shortcut for pushing the current Prisma schema to the configured database without creating a migration. Useful during early POC iteration. |
| `pnpm db:migrate` | Root shortcut for creating/applying a Prisma development migration. Use when schema changes should be migration-tracked. |
| `pnpm db:migrate:deploy` | Root shortcut for applying committed migrations in production/staging. |
| `pnpm --filter @staynex/backend prisma:generate` | Generate Prisma Client from `staynex-backend/prisma/schema.prisma`. |
| `pnpm --filter @staynex/backend prisma:push` | Push Prisma schema to the database configured by `DATABASE_URL`. |
| `pnpm --filter @staynex/backend prisma:migrate` | Run `prisma migrate dev` against the backend schema. |
| `pnpm --filter @staynex/backend prisma:migrate:deploy` | Run `prisma migrate deploy` against the configured database. |
| `pnpm --filter @staynex/backend prisma:seed` | Seed the database using `staynex-backend/prisma/seed.mjs`. |

## Recommended Verification Sets

Use this before handing off backend, booking, payment, or database work:

```powershell
pnpm check
pnpm --filter @staynex/backend prisma:generate
pnpm --filter @staynex/backend build
```

Use this before handing off frontend or full-stack work:

```powershell
pnpm check
pnpm --filter @staynex/frontend build
pnpm --filter @staynex/backend build
```

Use this before a full project handoff:

```powershell
pnpm check
pnpm --filter @staynex/backend prisma:generate
pnpm --filter @staynex/backend build
pnpm --filter @staynex/frontend build
```

## Deployment-Oriented Commands

Vercel should target `staynex-frontend`.

| Command | Use |
| --- | --- |
| `pnpm --filter @staynex/frontend build` | Build command for Vercel validation. |
| `pnpm --filter @staynex/frontend start` | Local production start command for frontend. |

Railway should target `staynex-backend`.

| Command | Use |
| --- | --- |
| `pnpm --filter @staynex/backend build` | Build command for Railway validation. |
| `pnpm --filter @staynex/backend start` | Start command for the built Railway API; applies migrations before Nest boots. |
| `pnpm --filter @staynex/backend prisma:generate` | Generate Prisma Client during backend setup/build if needed. |

## Git Helpers

| Command | Use |
| --- | --- |
| `git status --short` | See changed/untracked files concisely. |
| `git diff -- <path>` | Review unstaged changes for a specific tracked file or folder. |
| `git branch` | See local branches. |
| `git switch <branch>` | Switch branches. |
| `git switch -c <branch>` | Create and switch to a new branch. |
| `git add <path>` | Stage specific files. |
| `git commit -m "message"` | Commit staged changes. |

## Notes

- Use `pnpm`, not `npm` or `yarn`.
- Use Prisma, not Drizzle.
- Do not run database commands unless `DATABASE_URL` is correctly set.
- Do not commit `.env` files or provider secrets.
- `prisma:push` is convenient for the POC; use migrations when schema history matters.
