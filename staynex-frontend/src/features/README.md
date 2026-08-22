# Features

Domain slices. Each directory is one area of the product and owns the UI,
state, and API calls for that area.

```txt
ui/         generic primitives      Button, Field, Badge
components/ app-level chrome        DashboardShell, MobileNav
features/   domain slices           checkout, host, admin       <- you are here
```

Current slices: `admin`, `ai`, `auth`, `booking`, `host`, `landing`, `legal`,
`media`, `notifications`, `profile`, `properties`, `reviews`, `settings`,
`support`.

## Rules

- A feature may call the API through `@/lib/api`. Primitives and chrome may not.
- A feature may import from `@/ui` and `@/components`. The reverse is never
  true — chrome must not import a feature.
- Cross-feature imports are a smell. If two features need the same thing, it
  belongs in `@/components`, `@/ui`, or `@/lib` depending on what it is.
- Types come from `@/lib/types`, which re-exports the backend contract. Never
  redeclare an API type locally — that is exactly the duplication that put a
  payment-state bug in the mobile app.
- Route files under `app/` should stay thin and delegate here.

## Keeping files reviewable

Feature components grow. When one passes roughly 400 lines, split it by
responsibility: extract the data hook, the form, or a sub-view. Split along
the seams of what changes together, not by line count.
