# Web Lib

Web-only utilities, the API client, and the frontend view of the API contract.

```txt
lib/
  api/          the HTTP client, split by domain — see api/index.ts
  types.ts      re-exports the backend contract; add nothing here
  api-base.ts   API origin resolution (server vs browser)
  ...           other web-only helpers
```

## `types.ts` — do not add types here

It re-exports `@staynex/backend/types` and the shared status labels. The API
contract has exactly one definition, in the backend.

- New API type → `staynex-backend/types/api.ts`
- New status label → `packages/shared/src/labels.ts`
- Frontend-only helper (like the capability predicates) → here

This file used to be a hand-maintained copy of all 84 backend types. Nothing
kept them in sync, and the same pattern shipped a payment bug in the mobile
app. Adding a type here re-creates that problem.

## `api/` — add endpoints to a domain module

Every caller imports from `@/lib/api`; `api/index.ts` is the barrel. Add an
endpoint to the module that owns its domain (`host`, `admin`, `auth`,
`catalog`, `assistant`, `notifications`, `media`), not to a new top-level file.

`client.ts` owns URL resolution, CSRF, the `ApiError` shape, and the `request`
helper. Endpoint modules should use `request` rather than calling `fetch`.

## Rules

- Never import Prisma, NestJS, or anything under `staynex-backend/src`. ESLint
  enforces this. Types from `@staynex/backend/types` are fine — they are erased
  at build time.
- If a helper is needed by the mobile app too, it belongs in
  `packages/shared`, not here.
