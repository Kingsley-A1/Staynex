# Staynex Design System

The foundation layer for the Staynex web app. Built on **Apple HIG clarity**,
**Google Material structure**, and **WCAG 2.2 AA** accessibility, implemented as
**Tailwind CSS v4** (CSS-first) so the design tokens _are_ the Tailwind theme.

Brand source of truth: [`skill.md` §6](../../../skill.md) and
[`Staynex_plan.md`](../../../Staynex_plan.md). This implements Workstream 1
(Design System).

> Scope: lives in `staynex-frontend`. The legacy `staynex-prototype/` is left
> untouched by design — but this system deliberately matches its Tailwind v4 +
> shadcn-style token conventions so code reads the same across both.

---

## 1. Stack & files

Tailwind **v4.1.x**, CSS-first (no `tailwind.config.js`). Wired via
[`postcss.config.mjs`](../../postcss.config.mjs) → `@tailwindcss/postcss`.

| File         | Responsibility                                                                  |
| ------------ | ------------------------------------------------------------------------------- |
| `tokens.css` | **Primitives** in `@theme` — color ramps, type scale, radius, shadow (generate utilities + vars) |
| `theme.css`  | **Semantic roles** — raw `:root`/dark vars mapped via `@theme inline`; base layer; type-role classes |
| `motion.css` | **Motion** — easings + `--animate-*` keyframes (`@theme`), duration vars, reduced-motion |
| `globals.css`| **Entrypoint** — `@import "tailwindcss"` + the three files + dark variant       |

`globals.css` is imported once in
[`src/app/layout.tsx`](../app/layout.tsx).

**The golden rule:** use **semantic** utilities (`bg-primary`, `text-ink`,
`bg-surface`, `border-border`), not raw primitives (`bg-indigo-700`). Semantic
tokens re-theme automatically in dark mode; primitives don't.

---

## 2. Why Tailwind v4 (CSS-first)

- **Tokens are the config.** Every value lives in CSS `@theme`; Tailwind
  generates utilities from it. One source of truth, no JS config drift.
- **Dark mode flips for free.** Themeable roles are `:root` variables mapped via
  `@theme inline`, so `bg-primary` etc. resolve to the live variable and change
  with the theme — no `dark:` duplication needed.
- **Matches the prototype.** Same v4 + shadcn role names, so code is portable.
- **Leans on matching defaults.** Tailwind's default **spacing** (4px base) and
  **breakpoints** (640/768/1024/1280/1536) already match Staynex, so they aren't
  redefined.

---

## 3. Audit — before this foundation

`staynex-frontend` scored against the design-system checklist:

| Area        | Before                                                    | Status | Resolution |
| ----------- | --------------------------------------------------------- | ------ | ---------- |
| Tooling     | No Tailwind, no PostCSS — plain `sans-serif` body         | ❌ Gap | Tailwind v4 + token-driven theme |
| Colors      | Brand colors only as a doc list; none in CSS              | ❌ Gap | Tonal ramps + semantic roles |
| Typography  | No scale, no weights                                      | ❌ Gap | 11-step scale, role classes, system stack |
| Spacing     | None                                                      | ❌ Gap | Tailwind 4px scale (defaults) |
| Tokens      | None                                                      | ❌ Gap | Color/type/radius/shadow/motion/z/sizing |
| Light/Dark  | `color-scheme: light` only                                | ❌ Gap | Dark theme via `[data-theme]` + OS |
| Focus / a11y| No focus, reduced-motion, or skip link                    | ❌ Gap | `:focus-visible` ring, reduced-motion, skip-link |
| Motion      | None                                                      | ❌ Gap | Easings, `animate-*`, skeleton loader |
| Consistency | Prototype on **blue**; brand is indigo `#27187D`          | ⚠️ Risk| Standardized on brand indigo |

---

## 4. Token → utility reference

### Brand & neutral ramps (primitives)

`bg-indigo-{50–900}`, `bg-neutral-{0–950}` (+ `text-`, `border-`, `ring-`).
Anchor: `indigo-700` = `#27187D`, `neutral-50` = `#F7F7FF`, `neutral-900` =
`#101014` (ink), `neutral-600` = `#6E6A83` (muted), `neutral-200` = `#E7E5F2`
(border).

### Semantic roles (use these)

| Utility (example)        | Role / value (light)            |
| ------------------------ | ------------------------------- |
| `bg-background`          | App background `#F7F7FF`         |
| `text-foreground` / `text-ink` | Primary text `#101014`     |
| `bg-card`, `bg-surface-raised` | Card surface `#FFFFFF`     |
| `bg-surface-sunken`      | Recessed surface                 |
| `text-muted-foreground`  | Muted text `#6E6A83`             |
| `bg-primary` / `text-primary-foreground` | Brand `#27187D` / white |
| `bg-primary-subtle`      | Brand tint (selected/hover)      |
| `bg-secondary`, `bg-accent` | Neutral / brand-tint actions  |
| `border-border`, `border-border-strong`, `bg-input` | Borders / inputs |
| `ring-ring`              | Focus ring (brand)               |
| `bg-success` / `text-success-foreground` | `#15803D` / white  |
| `bg-warning` / `text-warning-foreground` | `#B7791F` / **dark ink** |
| `bg-error` / `bg-destructive` | `#B42318` (+ `-foreground`) |
| `bg-info`                | `#1D4ED8`                        |
| `bg-{success,warning,error,info}-surface` / `-border` | Tinted alert blocks |

### Typography

Scale utilities `text-2xs … text-5xl` (each pairs a line-height). Weights
`font-regular/medium/semibold/bold`. Tracking `tracking-tighter … tracking-wider`.
Leading `leading-tight … leading-relaxed`.

Composite **role classes** (recommended for consistency):
`text-display-lg/-md/-sm`, `text-title-lg/-md/-sm`, `text-body-lg/-md/-sm`,
`text-label`, `text-caption`, `text-overline`. Bare `h1–h6/p/a` are themed in the
base layer.

### Radius / shadow / motion

- Radius: `rounded-xs/sm/md/lg/xl/2xl` (cards = `rounded-lg` = 14px) + `rounded-full`.
- Shadow: `shadow-xs … shadow-xl` (soft, ink-tinted).
- Easing: `ease-standard/-decelerate/-accelerate/-emphasized/-spring`.
- Animation: `animate-fade-in/-slide-up/-slide-down/-scale-in/-shimmer/-pulse-soft`.
- Duration: no utility namespace — use `duration-[var(--duration-base)]` or bare
  `duration-200`. Vars: `--duration-fast … --duration-slower`.
- `.skeleton` loading placeholder.

### Non-utility tokens (use via `var()`)

Z-index `--z-dropdown … --z-tooltip` (e.g. `z-[var(--z-modal)]`), tap target
`--tap-target-min` (44px), `--layout-max-width`, `--layout-gutter`, focus-ring
width/offset. `.layout-container` centers + gutters page content.

---

## 5. WCAG contrast (verified, light theme)

✓ = passes WCAG 2.2 AA for the stated use.

| Foreground / Background                | Ratio    | Use            | Result |
| -------------------------------------- | -------- | -------------- | ------ |
| Ink `#101014` on bg `#F7F7FF`          | 17.8 : 1 | Body text      | ✓ AAA  |
| Primary `#27187D` text on bg           | 13.0 : 1 | Links/headings | ✓ AAA  |
| Muted `#6E6A83` on bg                   | 4.86 : 1 | Secondary text | ✓ AA   |
| White on Primary `#27187D`              | 13.9 : 1 | Button label   | ✓ AAA  |
| White on Success `#15803D`              | 5.03 : 1 | Solid badge    | ✓ AA   |
| White on Error `#B42318`                | 6.50 : 1 | Solid badge    | ✓ AA   |
| White on Info `#1D4ED8`                 | 6.70 : 1 | Solid badge    | ✓ AA   |
| **Dark ink** on Warning `#B7791F`       | 5.25 : 1 | Solid badge    | ✓ AA   |
| Focus ring `#27187D` on bg              | 13.0 : 1 | Focus (≥3:1)   | ✓      |

> ⚠️ White text on **Warning** `#B7791F` is only ~3.6:1 (fails AA for normal
> text). That's why `--warning-foreground` is **dark ink** — never use white text
> on an amber fill. For inline warning text on light backgrounds use a darker
> amber, not the base.
>
> ⚠️ Borders (`#E7E5F2`) are decorative (~1.1:1) — never the _only_ signal of
> state (WCAG 1.4.1); pair with text/icon.

---

## 6. Dark mode

```html
<html lang="en">                      <!-- light; tokens follow OS automatically -->
<html lang="en" data-theme="dark">     <!-- force dark -->
<html lang="en" data-theme="light">    <!-- force light, ignore OS -->
```

Semantic tokens flip via `[data-theme]` with an OS-preference fallback, so all
`bg-*/text-*/border-*` that use roles re-theme automatically. The `dark:` variant
is mapped to `[data-theme="dark"]`; prefer semantic tokens over `dark:` here. A
theme toggle just sets/persists `data-theme` on `<html>` (read OS on first load).

---

## 7. Accessibility (baked in)

- [x] `:focus-visible` ring on interactive elements, contrast ≥ 3:1 (WCAG 2.4.7/2.4.11)
- [x] All documented text pairings meet AA (§5)
- [x] `prefers-reduced-motion` honored globally (WCAG 2.3.3)
- [x] 44px min touch target token; `cursor` states set
- [x] `sr-only` (Tailwind) for SR-only content; `.skip-link` for skip-to-content
- [x] `color-scheme` per theme; 16px base font (prevents iOS input zoom)

Still verify per component: semantic HTML, ARIA, keyboard operability, and that
color is never the sole state indicator.

---

## 8. Usage

```tsx
// Already wired — globals.css imported in app/src/app/layout.tsx.
export default function BookButton() {
  return (
    <button
      className="bg-primary text-primary-foreground hover:bg-primary-hover
                 active:bg-primary-active rounded-md px-5 py-3 font-semibold
                 min-h-[var(--tap-target-min)] transition-colors"
    >
      Book now
    </button>
  );
}
```

```tsx
// Card using a role class + semantic utilities
<article className="surface-card p-4">
  <h3 className="text-title-sm">Marina Crest Hotel</h3>
  <p className="text-caption">Calabar · from ₦45,000 / night</p>
  <span className="bg-success-surface text-success border border-success-border
                   rounded-full px-2 py-0.5 text-xs">Available</span>
</article>
```

For component CSS (CSS Modules), reference the variables directly:

```css
.cta { background: var(--color-primary); color: var(--color-primary-foreground); }
```

---

## 9. Governance & next steps

- **Source of truth:** add new primitives to `tokens.css` `@theme`, then expose a
  semantic role in `theme.css`. Don't hardcode hex/px/ms in components.
- **Next (Workstream 1):** build Card, Carousel, and the loading / empty / error /
  success states on these tokens — ideally as shared primitives in
  [`src/ui`](../ui).
- Keep these token files in `staynex-frontend/src/styles` until the frontend
  surface proves its foundation, then extract only if reuse pressure is real.
