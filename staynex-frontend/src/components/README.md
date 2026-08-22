# App Components

Application-level chrome shared across routes: shells, navigation, global
states, and the pieces that frame a page.

This is the layer between generic primitives and domain features. A component
belongs here when it is specific to the Staynex app but not to a single
feature — `DashboardShell`, `MobileNav`, `NotificationCenter`, `ErrorState`.

```txt
ui/         generic primitives      Button, Field, Badge
components/ app-level chrome        DashboardShell, MobileNav   <- you are here
features/   domain slices           checkout, host, admin
```

## Rules

- Compose from `@/ui`. Do not re-implement a primitive here.
- Chrome may know about routes and navigation. It should not implement a
  domain workflow — that is a feature.
- Keep navigation structure in `nav-config.ts` rather than inline in a
  component, so the surfaces stay in one place.
- Never import Prisma, backend services, or anything under
  `staynex-backend/src`. See [`../../../docs/architecture.md`](../../../docs/architecture.md).
