# UI Primitives

The design system: generic, reusable building blocks with no knowledge of
Staynex domain concepts.

A component belongs here if it could appear in any product — `button`,
`field`, `badge`, `breadcrumb`, `kpi-card`. It takes props, renders, and
raises events. It does not fetch, does not know what a booking is, and does
not read global state.

```txt
ui/         generic primitives      Button, Field, Badge      <- you are here
components/ app-level chrome        DashboardShell, MobileNav
features/   domain slices           checkout, host, admin
```

The test: if you cannot name the component without using a Staynex noun, it
does not belong here. `RoomPicker` is a feature. `Select` is a primitive.

## Rules

- No data fetching. No `@/lib/api` imports.
- No domain types. If it imports `PropertySummary`, it is a feature component.
- Style with the design tokens in `../styles/`, never hardcoded hex values.
  Brand token values are defined in `skill.md` §6.
- Export through `index.ts` so call sites import from `@/ui`.
- Accessible by default: real labels, visible focus, keyboard operable, and a
  touch target of at least 44px. `skill.md` §6 requires WCAG 2.2.
