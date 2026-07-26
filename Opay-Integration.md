# Opay Integration — Slice Plan

Adding Opay as a **second payment provider** alongside Paystack.

This document is the plan of record: how payments work today, what Opay actually
buys us, what it puts at risk, and the ordered slices that get us there without
ever putting a guest's money in an ambiguous state.

Companion docs: `docs/architecture.md`, `skill.md` (source of truth),
`implimentation.md` (phase model).

---

## 1. How payments work today

Everything below is current `main` behaviour, not aspiration.

### 1.1 The payin path (guest → Staynex)

| Step | Where | What happens |
| --- | --- | --- |
| Hold | `bookings.service.ts` `createHold` | Capacity is held, price snapshotted |
| Checkout | `bookings.service.ts:173` `checkout()` | Booking `PENDING_PAYMENT` + `Payment` row created in one transaction, then provider `initializeTransaction` |
| Redirect | `checkout-client.tsx:53` | `window.location.href = result.authorizationUrl` |
| Guest pays | Paystack hosted page | — |
| Return | `/payment/status?reference=…&trxref=…` | Page polls `GET /payments/:reference` |
| Truth | `webhook.controller.ts:47` | `POST /payments/paystack/webhook`, HMAC-verified |
| Reconcile | `bookings.service.ts:409` `syncPaymentStatus` | Debounced provider `verify` as webhook backstop |

Two independent confirmation paths (webhook + polled verify) converge on the same
transition functions. That redundancy is a genuine strength of the current design
and must survive this integration.

### 1.2 The money state machine

`applyChargeSuccess` (`bookings.service.ts:268`) is the heart of the system. It
runs in a **serializable** transaction and encodes a real truth table:

- normal `PENDING_PAYMENT → CONFIRMED`
- **late success** after hold expiry → revive if capacity is still free, else
  `REQUIRES_REFUND`
- **underpayment** → never confirms, flags `UNDERPAID`
- **currency mismatch** → `CURRENCY_MISMATCH`, human review
- missing amount/currency on the event → **verify with the provider first**,
  never confirm unvalidated

`applyChargeFailure` releases capacity. `applyRefund` cancels the booking and
claws back an unsettled payout (or flags an already-`PAID` payout for out-of-band
recovery).

### 1.3 The audit trail

`PaymentEvent` (schema line 670) is an immutable row per webhook delivery, per
state-changing verify, and per admin money action — always with an outcome.
`EXCEPTION_OUTCOMES` (`REQUIRES_REFUND`, `UNDERPAID`, `CURRENCY_MISMATCH`) also
page every admin via `notifications.onPaymentException`. Nothing that touches
funds resolves invisibly. **This is the contract Opay must be held to.**

### 1.4 Where Paystack is currently hard-wired

This is the actual coupling surface — the work in this plan is mostly about these
eleven places.

**Backend**
1. `bookings.service.ts:226` — `provider: "paystack"` written as a literal at checkout.
2. `bookings.service.ts:237` — `this.paystack.initializeTransaction(...)`.
3. `bookings.service.ts:277` — `this.paystack.verifyTransaction(...)` inside `applyChargeSuccess`.
4. `bookings.service.ts:431` — `this.paystack.verifyTransaction(...)` inside `syncPaymentStatus`.
5. `admin.service.ts:586` — `this.paystack.refundTransaction(...)`.
6. `webhook.controller.ts` — the whole controller is Paystack-shaped: route path, `x-paystack-signature`, and Paystack's event names (`charge.success`, `charge.failed`, `refund.processed`).
7. `security.ts:24` — `CSRF_EXEMPT_PATHS` contains the literal `/payments/paystack/webhook`.
8. `paystack.service.ts:92` — `callbackUrl()` is provider-agnostic in shape but lives inside the Paystack class.
9. `bank-directory.service.ts:15` — `PROVIDER = "paystack"` for the **payout** bank directory (see §4, this is deliberately out of scope).

**Frontend**
10. `checkout-client.tsx:176,178` — "Pay … **with Paystack**", "redirected to Paystack's secure test checkout"; `payment-status-client.tsx:146` — "verify with **Paystack**".
11. `types.ts:719,733` — `provider: "paystack"` as a **string-literal type**, plus `legal/page.tsx:58` and `policies/page.tsx:47` naming Paystack as the processor.

### 1.5 What is already provider-agnostic (keep it that way)

- `commission.ts` — `splitPayment` / `resolveCommissionBps`. Pure math, no provider.
- `Payment.reference` — **we** generate it (`stx_<uuid>`, `bookings.service.ts:174`), it is `@unique`, and it is what the guest sees on the voucher. Opay must adopt our reference, not impose its own.
- `PaymentEvent.provider` — the column **already exists** with `@default("paystack")`. The webhook controller just never sets it explicitly today.
- The entire `Payout` model and settlement flow — denominated in kobo, provider-free.

---

## 2. What Opay actually solves

Ranked by how much they matter to Staynex specifically.

### 2.1 Removing a single point of failure (the real reason)

Today, if Paystack has an outage, throttles us, or restricts the merchant
account, **checkout is 100% down and revenue is exactly zero**. There is no
degraded mode. For a Nigerian booking platform where a stay is often booked
hours before check-in, an hour of downtime is not deferred revenue — it is lost
bookings that go to a competitor.

`checkout()` already handles an initialize failure correctly (releases capacity,
audits `checkout.init_failed`) — but the guest still gets an error and leaves.
A second provider converts a total outage into a routing decision.

### 2.2 Payment-method coverage

Opay's value in Nigeria is its **wallet and agent network** — a large base of
users who transact from an OPay balance rather than a card. Paystack covers
card/bank-transfer/USSD well; the OPay wallet is a rail we currently cannot
reach at all. Guests without a working card are, today, unbookable.

### 2.3 Commercial leverage

A live, switchable second processor changes fee negotiation from a letter into a
credible position, and lets us route by cost per rail once we have per-provider
success-rate data (Slice 7).

### 2.4 Success-rate arbitrage (speculative — must be measured, not assumed)

Providers differ in authorisation success by rail and by issuing bank. If that
proves true for our traffic mix, routing follows the data. **We should not claim
this benefit until Slice 7 measures it.**

---

## 3. Honest risk assessment

Adding a second money provider is the highest-blast-radius change we can make to
this codebase. Ordered by severity.

### R1 — Cross-provider verification (CRITICAL)

**The single most dangerous bug in this integration.** `applyChargeSuccess`,
`syncPaymentStatus`, and `admin.refundPayment` call `this.paystack.*`
unconditionally. If an Opay payment reaches any of them unchanged, we would ask
**Paystack** about an **Opay** reference. Paystack returns not-found → the code
path treats it as `abandoned`/`failed` → `applyChargeFailure` → **a guest who
genuinely paid has their booking cancelled and their capacity released.**

The `syncPaymentStatus` path makes this worse: it fires automatically from
status-page polling, so the damage happens within seconds, unattended.

> **Mitigation:** Slice 1 is a pure refactor that resolves the adapter from the
> **stored `Payment.provider`** for every one of these call sites, shipped and
> verified *before* any Opay code exists. Enforced by a test asserting an
> unknown/mismatched provider **throws** rather than silently defaulting.

### R2 — Amount and currency unit mismatch (CRITICAL)

Our entire system is **kobo** (integer minor units). Paystack takes kobo for NGN.
Opay's amount representation must be confirmed — if it expects a decimal naira
string or a `{currency, value}` object and the adapter gets it wrong by 100×, the
consequences are automatic and severe: `applySuccessTx` compares the paid amount
against what is owed, so a ₦50,000 booking reported as ₦500 is flagged
`UNDERPAID` (never confirms, pages every admin) and ₦5,000,000 sails through as
an overpayment. Rounding a decimal string is a silent money leak.

> **Mitigation:** the adapter converts **at the boundary only**; core stays kobo,
> integer, always. Property-based test over the kobo↔provider-unit round trip
> asserting exact equality for the full realistic price range. No floats — parse
> decimal strings as integers. Slice 0 pins the actual representation.

### R3 — Webhook authenticity

Paystack's scheme (HMAC-SHA512 over the raw body, `x-paystack-signature`) is
almost certainly **not** Opay's. A weak or wrong implementation means an attacker
can forge `charge.success` and get free stays. Note `verifySignature`
(`paystack.service.ts:308`) already does the right things — raw body,
`timingSafeEqual`, length check — and that bar must be met, not lowered.

> **Mitigation:** separate route per provider, each with its own verifier. No
> shared "try both" path. Negative tests (tampered body, wrong key, replayed
> delivery, empty signature) are **acceptance criteria, not follow-ups**.
> `rawBody: true` is already global in `main.ts`, so no bootstrap change needed.

### R4 — Double payment / split brain

A guest whose Opay attempt stalls may retry on Paystack. `Payment` is
`@unique` on `bookingId`, so a second attempt on the same booking cannot create a
second row — but a *late* success on the abandoned first attempt can still arrive
after the booking was cancelled and capacity released.

The existing design already handles this exact shape: late success → revive if
capacity is free, else `REQUIRES_REFUND` + admin page. **Two providers make it
more frequent, not newly possible.**

> **Mitigation:** preserve that truth table untouched (it is why Slice 1 is a
> refactor, not a rewrite). Do not offer provider switching on an in-flight
> attempt in v1 — the guest must return to checkout, which consumes the hold.

### R5 — Refund asymmetry

`refundPayment` is provider-first by design: if the provider rejects, nothing
changes locally. Correct — and it must stay correct when the provider is Opay,
including when Opay's refund is asynchronous, partial-only, or unsupported for a
rail. An adapter that silently no-ops a refund would let an admin believe money
was returned when it was not.

> **Mitigation:** `refund()` throws unless the provider **accepted**. If Opay
> cannot refund a given rail, the adapter throws a typed, explicit error so the
> admin sees "not supported — settle manually", never a false success.

### R6 — Reduced coverage on a critical path

Paystack's path is battle-tested by real traffic. Opay's will not be on day one.

> **Mitigation:** ship dark (Slice 3), staff-only forced routing, then a small
> traffic percentage before it is ever a default. Kill switch at every stage.

### R7 — Reconciliation and settlement drift

Two providers means two settlement schedules and two sets of fees landing in two
places, against one `Payout` ledger. Ops burden and drift risk both rise.

> **Mitigation:** Slice 2 persists `providerReference` (the provider's own id) so
> every Staynex reference is traceable to a provider-side transaction. Slice 7
> adds per-provider reconciliation. Note the `Payout` side is **unchanged** — see §4.

### R8 — Guest confusion and trust

A checkout offering two providers with no explanation adds friction at the exact
moment we most need confidence. Our public copy also currently names Paystack
specifically (`legal/page.tsx`, `policies/page.tsx`) — leaving that stale while
charging via Opay is a factual misstatement in a legal page.

> **Mitigation:** default to one provider with a quiet alternative, not a
> 50/50 choice. Legal/policy copy updates ship **in the same slice** that first
> exposes Opay to a real guest (Slice 4), not after.

### R9 — Secret sprawl

Another set of production money credentials to store, rotate, and keep out of
logs. `paystack.service.ts` reads its key lazily at call time so the API boots
without it — a good pattern to copy exactly.

> **Mitigation:** same lazy-read pattern; `ServiceUnavailableException` when
> unconfigured; adapter is never registered if its secret is absent, so a
> misconfigured deploy fails closed (Paystack-only) rather than erroring at
> checkout.

---

## 4. Explicit non-goals

Naming these prevents scope creep into money-handling code.

- **Payout / bank directory stays Paystack.** `bank-directory.service.ts` and
  `resolveBankAccount` serve **host payouts** — a different direction of money
  flow from checkout. Opay may later serve payouts too; that is a separate plan
  with its own risk model. This integration is **payin only**.
- **No change to the commission split.** `commission.ts` is provider-independent
  and stays untouched.
- **No change to the money state machine.** `applyChargeSuccess` /
  `applyChargeFailure` / `applyRefund` keep their exact semantics. If a slice
  needs to change that truth table, the slice is wrong.
- **No card data touches Staynex.** Both providers stay redirect/hosted-checkout.
  We do not become PCI-DSS in scope.
- **Not a migration.** Paystack remains a first-class, fully supported provider.

---

## 5. Target architecture

A narrow port, one adapter per provider, resolved **from persisted state**.

```
                        ┌──────────────────────────────┐
   checkout() ─────────▶│  PaymentProviderRegistry     │
   applyChargeSuccess ─▶│  .get(payment.provider)      │
   syncPaymentStatus ──▶│  .default()  ← new payments  │
   admin.refund ───────▶└──────────────┬───────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
          PaystackProvider                          OpayProvider
    (today's paystack.service.ts,               (new, same interface)
     wrapped — logic unchanged)
```

```ts
// modules/payments/payment-provider.port.ts
export type ProviderName = "paystack" | "opay";

export interface InitializedTransaction {
  authorizationUrl: string;
  /** Our reference, echoed back. Core never adopts a provider-side reference. */
  reference: string;
  /** The provider's own transaction id, for reconciliation. */
  providerReference: string | null;
}

export interface VerifiedTransaction {
  /** Normalized by the adapter — core never sees provider-specific statuses. */
  status: "success" | "failed" | "abandoned" | "pending";
  reference: string;
  providerReference: string | null;
  /** ALWAYS kobo. Conversion happens inside the adapter, never outside. */
  amountKobo: number;
  currency: string;
}

export interface NormalizedWebhookEvent {
  kind: "charge.success" | "charge.failed" | "refund.processed" | "other";
  reference: string | null;
  providerReference: string | null;
  amountKobo: number | null;
  currency: string | null;
  rawType: string;
}

export interface PaymentProvider {
  readonly name: ProviderName;
  isConfigured(): boolean;
  initializeTransaction(input: InitializeInput): Promise<InitializedTransaction>;
  verifyTransaction(reference: string): Promise<VerifiedTransaction>;
  /** Must throw unless the provider ACCEPTED the refund. Never silently no-op. */
  refundTransaction(reference: string): Promise<void>;
  verifySignature(rawBody: Buffer, headers: Record<string, string | undefined>): boolean;
  parseWebhook(rawBody: Buffer): NormalizedWebhookEvent;
}
```

Three invariants the design turns into code:

1. **Resolution is by persisted `Payment.provider`, never by a global default**,
   for every operation on an *existing* payment. `.default()` is only legal when
   creating a *new* payment.
2. **Kobo is the only unit that crosses the port.** Adapters convert inward.
3. **Adapters normalize status and event vocabulary.** Core never learns a
   provider's status strings or event names.

---

## 6. The slices

Each slice is independently shippable and independently revertable. Slices 1–2
carry real risk but **zero user-visible change** — that is deliberate.

---

### Slice 0 — Contract spike (no product code)

**Goal:** replace assumptions about Opay's API with verified facts before any
adapter exists.

Everything below must be answered from Opay's **current merchant documentation
and a live sandbox transaction** — not from memory, not from a blog post.

**Contract sheet to fill in:**

| Question | Why it blocks us |
| --- | --- |
| Amount representation — minor units, or decimal string? Currency field shape? | **R2.** Wrong by 100× = automatic `UNDERPAID` / silent overpayment |
| Can we supply our own `stx_<uuid>` reference? Length/charset limits? | Our reference is on the guest voucher and is the `@unique` DB key |
| Webhook signature: algorithm, which header, signed over raw body or a field subset? | **R3.** Determines the verifier |
| Webhook event names for success / failure / refund | Adapter's `parseWebhook` mapping |
| Is there a synchronous verify/query endpoint? Rate limits? | `syncPaymentStatus` backstop depends on it |
| Refunds: supported? sync or async? partial-only? per-rail limits? | **R5.** Determines whether admin refund can stay uniform |
| Callback return URL — which query param carries the reference? | `/payment/status` reads `reference`/`trxref` today (Paystack names) |
| Sandbox parity with production | Whether Slice 3 testing means anything |
| Settlement schedule, fee structure per rail | Slice 7 reconciliation + the §2.3 commercial case |
| Idempotency/replay semantics on webhook redelivery | `PaymentEvent` dedupe behaviour |

**Deliverable:** this table filled in, plus a throwaway script proving
initialize → pay → webhook → verify → refund end-to-end in sandbox. Committed to
`docs/future/opay-contract.md`.

**Gate:** no adapter code is written until every row is answered. If refunds turn
out to be unsupported or manual-only, that changes Slice 6 materially and we want
to know *now*, not after building four slices on a bad assumption.

**Acceptance:** contract sheet committed; sandbox transcript attached; open
questions escalated to Opay support with ticket references.

---

### Slice 1 — Provider port + Paystack behind it (pure refactor)

**Goal:** make provider resolution dynamic and correct, with **zero behaviour
change** and no Opay code. This slice exists to make R1 structurally impossible.

**Changes:**
- New `payment-provider.port.ts` (§5).
- `PaystackProvider implements PaymentProvider` — wraps the existing service.
  Internal HTTP logic is **moved, not rewritten**; `verifySignature` keeps its
  exact `timingSafeEqual` implementation.
- New `PaymentProviderRegistry` with `get(name)` and `default()`.
  `get()` **throws** on unknown/unconfigured — never falls back.
- Replace the four direct-call sites: `bookings.service.ts:237` uses
  `.default()` (new payment); `:277`, `:431`, and `admin.service.ts:586` use
  `.get(payment.provider)` (existing payment).
- `checkout()` writes `provider: registry.default().name` instead of the literal
  `"paystack"`.

**Acceptance criteria:**
- Full existing payment test suite green, unmodified.
- New test: a `Payment` row with `provider: "opay"` (no adapter registered) makes
  verify/refund **throw** — proving no silent Paystack fallback. **This is the R1
  regression test and it must exist before Slice 3.**
- New test: `checkout()` persists the default provider's name.
- Manual: full sandbox Paystack booking → confirmed, unchanged.
- Diff contains no change to the `applySuccessTx` truth table.

**Rollback:** revert the commit; no schema or data change.

---

### Slice 2 — Persist provider identity end-to-end

**Goal:** make every money row self-describing, so reconciliation and support can
answer "which provider, which transaction" without guessing.

**Changes:**
- Schema (additive, nullable — safe on live data):
  ```prisma
  model Payment {
    /// The provider's own transaction id. Ours stays `reference`.
    providerReference String?
    @@index([provider, status])   // per-provider ops queries
  }
  ```
- `PaymentEvent.provider` — actually **set** it at every `record()` call site
  (the column exists and defaults to `"paystack"`, so today an Opay event would
  be mislabelled).
- Populate `providerReference` from `initializeTransaction` and from every
  verify/webhook that carries it.
- Surface provider + `providerReference` in the admin payment row and timeline.

**Acceptance criteria:**
- Migration applies cleanly to a production-shaped snapshot; existing rows keep
  working (`provider` already backfilled by Slice 1, `providerReference` null).
- Admin payment detail shows provider and provider-side id.
- `PaymentEvent.provider` is correct on every new row.

**Rollback:** revert code; the nullable column is inert if left in place.

---

### Slice 3 — Opay adapter, shipped dark

**Goal:** a complete, tested Opay implementation that **no guest can reach**.

**Changes:**
- `OpayProvider implements PaymentProvider`, built strictly to the Slice 0
  contract sheet. Lazy secret read (`OPAY_*`); `isConfigured()` false when unset
  so the registry never registers it in a misconfigured deploy (**R9** — fails
  closed to Paystack-only).
- Kobo conversion isolated in two small pure functions, unit-tested (**R2**).
- New route `POST /payments/opay/webhook` with its own verifier. Add the path to
  `CSRF_EXEMPT_PATHS` in `security.ts:23`.
- Refactor `webhook.controller.ts` so the per-provider route resolves its adapter
  and shares the existing record/audit wrapper — **the audit and outcome
  behaviour is identical for both providers**.
- Env flag `OPAY_ENABLED=false` by default. Staff-only forced routing
  (admin-capability-gated) to exercise the real path in production.

**Acceptance criteria:**
- Sandbox: initialize → pay → webhook → `CONFIRMED`, with a `PaymentEvent` row
  carrying `provider: "opay"`.
- Sandbox: failed payment → `MARKED_FAILED`, capacity released.
- Webhook negative tests **all reject**: tampered body, wrong secret, missing
  signature, replayed delivery (**R3**).
- Kobo round-trip property test passes across ₦100–₦10,000,000 with exact
  integer equality (**R2**).
- Amount-mismatch test: an Opay success reporting less than owed produces
  `UNDERPAID` and does **not** confirm.
- With `OPAY_ENABLED=false`, no guest-reachable path selects Opay — asserted by test.

**Rollback:** flag off (instant, no deploy).

---

### Slice 4 — Provider selection + honest guest copy

**Goal:** first real guest traffic, on a controlled percentage.

**Changes:**
- Selection policy in one place: default provider, optional guest choice,
  percentage rollout knob. Policy is **not** scattered through `checkout()`.
- `CheckoutResult` gains `provider` so the UI can label truthfully.
- De-hardcode `checkout-client.tsx:176,178` and `payment-status-client.tsx:146`.
- Widen the frontend literal types (`types.ts:719,733`) from `"paystack"` to the
  provider union.
- **Update `legal/page.tsx:58` and `policies/page.tsx:47` in this slice** — the
  moment a real guest can be charged via Opay, naming only Paystack as our
  processor is factually wrong (**R8**).
- Default remains Paystack. Rollout starts at a small percentage.

**Acceptance criteria:**
- Guest sees the provider they will actually be sent to — no stale label.
- Legal and policy pages name both processors, shipped in the same commit.
- Rollout percentage is runtime-adjustable without a deploy; setting 0 fully
  disables Opay for guests.
- A11y/responsive check on the provider selector if a visible choice ships.

**Rollback:** percentage to 0.

---

### Slice 5 — Failover

**Goal:** deliver §2.1 — the actual reason for this work.

**Changes:**
- When the selected provider's `initializeTransaction` fails, retry once on the
  alternate **before** the guest sees an error.
- **Strictly bounded:** failover only at initialize, only before any redirect,
  only when no charge could possibly have been created. Never after redirect,
  never on verify, never on an in-flight attempt (**R4**).
- Audit both the failure and the failover as `PaymentEvent` rows.
- Circuit breaker: consecutive initialize failures temporarily deprioritise a
  provider, with automatic recovery.

**Acceptance criteria:**
- Simulated total Paystack initialize outage → guest completes on Opay, booking
  confirms, both attempts visible in the audit trail.
- Failover **never** fires after a redirect (explicit test).
- Both providers down → today's clean failure: capacity released,
  `checkout.init_failed` audited, honest guest error.

**Rollback:** failover flag off; selection falls back to Slice 4 behaviour.

---

### Slice 6 — Refund + admin parity

**Goal:** an admin handles an Opay payment exactly like a Paystack one, or is
told plainly that they cannot.

**Changes:**
- Admin refund routes through the registry (already true after Slice 1) and is
  verified end-to-end against Opay sandbox.
- If Opay refunds are async, wire the terminal refund webhook to `applyRefund`
  the way `refund.processed` is wired today.
- If a refund is unsupported for a rail, the adapter throws a typed error and the
  admin UI says "not supported by this provider — settle manually" (**R5**).
  Never a false success.
- Admin exception queue and re-verify action confirmed working per provider.

**Acceptance criteria:**
- Sandbox Opay refund → `REFUNDED`, booking cancelled, payout clawed back —
  identical outcomes to Paystack.
- Unsupported-refund path shows an explicit, actionable admin message.
- A provider-rejected refund changes **nothing** locally (provider-first ordering
  preserved).

---

### Slice 7 — Reconciliation and observability

**Goal:** operate two providers with evidence instead of vibes, and settle the
open question in §2.4.

**Changes:**
- Per-provider metrics: initialize success, checkout→confirm conversion, webhook
  latency, verify-fallback rate, exception rate.
- Daily reconciliation job: provider settlement report vs `Payment` rows;
  mismatches raised as exceptions through the existing notification path.
- Admin dashboard split by provider.

**Acceptance criteria:**
- A deliberately orphaned provider-side transaction is caught by the recon job
  within one cycle.
- Dashboard answers "which provider is converting better, on which rail" with
  real data — the input to any future routing decision.

---

## 7. Environment variables

| Variable | Slice | Notes |
| --- | --- | --- |
| `OPAY_MERCHANT_ID` | 3 | Lazy-read at call time (mirrors `PAYSTACK_SECRET_KEY`) |
| `OPAY_PUBLIC_KEY` | 3 | Per Slice 0 findings |
| `OPAY_SECRET_KEY` | 3 | Never logged; absence ⇒ adapter unregistered |
| `OPAY_BASE_URL` | 3 | Sandbox vs production |
| `OPAY_ENABLED` | 3 | Master kill switch, default `false` |
| `PAYMENT_DEFAULT_PROVIDER` | 4 | Defaults to `paystack` |
| `PAYMENT_OPAY_ROLLOUT_PERCENT` | 4 | `0`–`100`, default `0` |
| `PAYMENT_FAILOVER_ENABLED` | 5 | Default `false` until Slice 5 proves out |

All secrets follow the existing lazy-read pattern so the API still boots
unconfigured.

---

## 8. Sequencing and dependencies

```
Slice 0 (spike) ──▶ Slice 1 (port) ──▶ Slice 2 (identity) ──▶ Slice 3 (adapter, dark)
                          │                                          │
                          │                                          ▼
                          │                                   Slice 4 (guests)
                          │                                          │
                          │                          ┌───────────────┼───────────────┐
                          │                          ▼               ▼               ▼
                          └──── R1 test gate ────▶ Slice 5      Slice 6         Slice 7
                                                 (failover)     (refunds)      (recon)
```

Hard gates:
- **Slice 0 → 1:** contract sheet complete. Unknown refund semantics change Slice 6's shape.
- **Slice 1 → 3:** the R1 regression test must exist and pass. Non-negotiable.
- **Slice 3 → 4:** all webhook negative tests and the kobo round-trip test green.
- **Slice 4 → 5:** Opay confirmed working on real traffic at a low percentage first.

Slices 5, 6, 7 can run in parallel after Slice 4. **Slice 6 should not lag far
behind Slice 4** — taking real Opay money without a proven refund path is an
operational liability.

---

## 9. Recommendation

**Do it — but the value is in Slices 1 and 2 regardless of whether Opay ever
ships.**

Right now a single Paystack incident takes checkout to zero, and the code makes
that impossible to fix quickly because the provider is assumed in five call
sites. Slices 1–2 remove that assumption with no user-visible change and no new
vendor risk. They are worth shipping even if Opay is deferred.

The genuine risk is not "Opay is hard to integrate" — it is R1 and R2: verifying
an Opay payment against Paystack, or getting kobo wrong by 100×. Both are
automatic, both hit real guest money in seconds, and both are entirely prevented
by structure rather than by care. That is why the refactor ships first, alone,
with its regression test as a hard gate.

Suggested first move: **Slice 0 and Slice 1 in parallel** — Slice 0 is
integration/commercial work (docs, sandbox, Opay support), Slice 1 is internal
refactor with no external dependency. Neither blocks the other, and together they
de-risk everything downstream.
