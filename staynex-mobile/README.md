# Staynex Mobile

The Expo / React Native guest app. Search, view a stay, hold, pay via Paystack,
and see the booking confirmed.

## Running it

```bash
cp .env.example .env     # then set STAYNEX_API_BASE_URL
pnpm dev:mobile          # or: pnpm --filter @staynex/mobile start
```

`STAYNEX_API_BASE_URL` differs per target, because "localhost" on a device is
the device itself:

| Target           | Host                        |
| ---------------- | --------------------------- |
| Android emulator | `http://10.0.2.2:8080`      |
| iOS simulator    | `http://localhost:8080`     |
| Physical device  | `http://<your-LAN-IP>:8080` |

Before handing off:

```bash
pnpm --filter @staynex/mobile check
pnpm --filter @staynex/mobile lint
```

## Layout

```txt
app/          expo-router screens; the file tree is the route tree
  (auth)/     sign in and register
  (tabs)/     the signed-in tab bar
  booking/    quote -> checkout -> confirmation
  payment/    payment status polling
  stays/      stay detail
src/
  core/       HTTP client, session, storage
  data/       typed API calls
  ui/         presentational primitives
```

## Rules

**The backend owns the contract.** Import types from `@staynex/backend/types`
and status labels from `@staynex/shared`. Never redeclare an API type locally.
The payment status screen once omitted `REQUIRES_REFUND` from its terminal
states, so a guest whose money had been captured saw an endless spinner and
then "Payment failed". That is what a local copy of a contract costs.

**Handle every state of a union.** Type payment and booking state maps as
`Record<PaymentState, T>` so a new backend state fails `tsc` here rather than
rendering as a wrong screen.

**No client-side business logic.** The app never decides whether a booking is
confirmed, whether a room is available, or whether a payment succeeded. It asks
the API and renders the answer. `skill.md` §9.

**Never import backend services or Prisma.** Types only — they are erased at
build time. ESLint enforces this.

## Two things that will bite you

- **React types.** RN 0.76 is a React 18 runtime while the web apps are on
  React 19, so both `@types/react` majors exist in the workspace. `tsconfig.json`
  pins `react` to the local v18 copy. Remove that pin and every navigator fails
  with `TS2786`. The comment there explains it; leave it until the whole
  workspace shares one React major.
- **Metro and pnpm.** `metro.config.js` watches the workspace root and disables
  hierarchical lookup, because pnpm's symlinked layout breaks Metro's default
  resolution. Read its comments before changing bundler config.
