# @staynex/shared

Contracts shared by more than one Staynex client. Currently the web app and
the mobile app.

```txt
src/
  labels.ts   human-readable labels and tones for backend status enums
  tokens.ts   brand design tokens (color, spacing, radius, type)
  money.ts    kobo -> NGN formatting
  index.ts    the public surface
```

## What belongs here

Something that both the web and mobile clients need, and that does not depend
on either. If only one app needs it, keep it in that app.

## Rules

These are enforced by ESLint, not just convention:

- **No framework imports.** No React, no React Native, no Next.js. This package
  is consumed by a Next.js app and an Expo app, so it must be neutral.
- **No app imports.** Nothing from `staynex-frontend`, `staynex-backend/src`,
  or `staynex-mobile`. Everything depends on this package; it depends on none
  of them.
- **No runtime dependencies.** It is bundled onto a device.
- **Type-only imports from the contract.** Import the enum _unions_ from
  `@staynex/backend/types` rather than re-typing them:

  ```ts
  import type { PaymentState } from "@staynex/backend/types";

  export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = { ... };
  ```

  `Record<PaymentState, string>` is the point. When the backend adds a state,
  `tsc` fails here until a label exists — which is how a missing payment state
  becomes a build error instead of a bug a guest discovers.

## Adding a label map

Add it to `labels.ts`, export it from `index.ts`, key it on the backend union,
and let the compiler tell you if you missed a case.
