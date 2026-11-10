# Staynex Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a fail-closed test/live payment contract, payment-state integrity, private booking evidence, least-privilege money operations, truthful public/host recovery, sandbox evidence, and an enforceable staging-to-production Git policy.

**Architecture:** A typed payment configuration service selects test or live provider credentials from `PAYMENT_ENABLED`; the selected mode is persisted with every payment and enforced at every provider boundary. Booking ownership and capability guards protect private state, while shared recovery UI replaces generic failure indicators. Sandbox acceptance gates repository normalization and all merges.

**Tech Stack:** NestJS 11, Zod 4, Prisma 6 with CockroachDB, Node test runner, Next.js 15, React 19, TypeScript 5.9, pnpm 10, GitHub Actions.

## Global Constraints

- Follow `Codex.md`, `skill.md`, and `docs/superpowers/specs/2026-08-21-production-payment-access-host-governance-design.md`.
- Work only on `codex/payment-production-readiness`; do not implement on `main` or `master`.
- Use red-green-refactor for every behavior change and record the expected failing assertion before production edits.
- Never print, copy, infer, or commit secret values; environment inspection is name/presence only.
- `PAYMENT_ENABLED=false` means provider test/sandbox mode and is `ADMIN_MANAGER`-only in production.
- Test payments never affect live inventory, revenue, settlement, host earnings, or payouts.
- `PAYMENT_ENABLED=true` never falls back to test mode or another provider.
- No merge or branch normalization before both enabled providers pass sandbox acceptance.
- User-visible recovery explains what failed, why, and supplies Retry plus Close/Return when applicable.

---

### Task 1: Validated payment-mode configuration

**Files:**
- Create: `staynex-backend/src/modules/payments/payment-config.service.ts`
- Modify: `staynex-backend/config/env.ts`
- Modify: `staynex-backend/src/modules/payments/payments.module.ts`
- Modify: `staynex-backend/src/modules/payments/payment-provider.port.ts`
- Modify: `staynex-backend/src/modules/payments/payment-provider.registry.ts`
- Modify: `staynex-backend/src/modules/payments/paystack.service.ts`
- Modify: `staynex-backend/src/modules/payments/paystack.provider.ts`
- Modify: `staynex-backend/src/modules/payments/opay.provider.ts`
- Modify: `.env.example`
- Test: `staynex-backend/test/payment-mode-config.test.mjs`
- Test: `staynex-backend/test/payment-provider-routing.test.mjs`

**Interfaces:**
- Produces: `PaymentMode = "TEST" | "LIVE"` and `PaymentConfigService.current(): PaymentRuntimeConfig`.
- Produces: mode-specific provider configuration without direct `process.env` reads in provider adapters or registry.
- Consumes: existing provider port and deterministic checkout selection.

- [ ] **Step 1: Write configuration truth-table tests**

```js
test("PAYMENT_ENABLED=false resolves TEST and rejects a live Paystack key in the test slot", () => {
  const config = resolvePaymentRuntime(baseEnv({
    PAYMENT_ENABLED: "false",
    PAYSTACK_TEST_SECRET_KEY: "sk_test_example",
  }));
  assert.equal(config.mode, "TEST");
  assert.throws(() => resolvePaymentRuntime(baseEnv({
    PAYMENT_ENABLED: "false",
    PAYSTACK_TEST_SECRET_KEY: "sk_live_example",
  })), /PAYSTACK_TEST_SECRET_KEY must be a test credential/);
});

test("PAYMENT_ENABLED=true resolves LIVE and never accepts a test key", () => {
  assert.throws(() => resolvePaymentRuntime(baseEnv({
    PAYMENT_ENABLED: "true",
    PAYSTACK_LIVE_SECRET_KEY: "sk_test_example",
  })), /PAYSTACK_LIVE_SECRET_KEY must be a live credential/);
});
```

- [ ] **Step 2: Run the targeted test and observe RED**

Run: `pnpm --filter @staynex/backend build && node --test staynex-backend/test/payment-mode-config.test.mjs`

Expected: failure because `resolvePaymentRuntime`, `PaymentMode`, and the mode-specific variables do not exist.

- [ ] **Step 3: Implement strict environment and typed runtime configuration**

```ts
export type PaymentMode = "TEST" | "LIVE";

export interface PaymentRuntimeConfig {
  enabled: boolean;
  mode: PaymentMode;
  defaultProvider: ProviderName;
  opayRolloutPercent: number;
  providers: Record<ProviderName, ProviderRuntimeConfig>;
}

export function resolvePaymentRuntime(env: Env): PaymentRuntimeConfig {
  const mode: PaymentMode = env.PAYMENT_ENABLED ? "LIVE" : "TEST";
  return validateSelectedCredentials({ mode, env });
}
```

Parse booleans strictly from `"true"` and `"false"`, constrain rollout to integer `0..100`, validate key prefixes without logging values, and make partial provider configuration an error. Keep OPay unavailable unless its selected mode has a complete credential set.

- [ ] **Step 4: Inject configuration into the registry and adapters**

Replace provider/registry `process.env` reads with `PaymentConfigService`. `selectForCheckout` may route only among providers configured for `current().mode`; `get(provider, mode)` must match both identities and never fall back.

- [ ] **Step 5: Document safe environment names**

Add `PAYMENT_ENABLED`, `PAYMENT_DEFAULT_PROVIDER`, rollout, Paystack test/live keys, OPay test/live credentials/base URLs, and `ADMIN_REGISTRATION_ENABLED` to `.env.example` with empty values and explanatory comments only.

- [ ] **Step 6: Run GREEN verification**

Run: `pnpm --filter @staynex/backend test:payments`

Expected: all configuration and provider-routing tests pass with no direct environment reads in registry/adapters.

- [ ] **Step 7: Commit**

```bash
git add .env.example staynex-backend/config/env.ts staynex-backend/src/modules/payments staynex-backend/test/payment-mode-config.test.mjs staynex-backend/test/payment-provider-routing.test.mjs
git commit -m "feat(payments): validate test and live provider modes"
```

### Task 2: Additive payment mode migration and financial neutrality

**Files:**
- Modify: `staynex-backend/prisma/schema.prisma`
- Create: `staynex-backend/prisma/migrations/20260821090000_payment_provider_mode/migration.sql`
- Modify: `staynex-backend/src/modules/bookings/bookings.service.ts`
- Modify: `staynex-backend/src/modules/bookings/report-mappers.ts`
- Modify: `staynex-backend/types/index.ts`
- Test: `staynex-backend/test/payment-mode-persistence.test.mjs`
- Test: `staynex-backend/test/payment-migration-contract.test.mjs`

**Interfaces:**
- Consumes: `PaymentMode` from Task 1.
- Produces: non-null `Payment.provider`, nullable `Payment.providerReference`, and non-null `Payment.mode`.
- Produces: mode-aware success/refund behavior and provider metadata in admin/report contracts.

- [ ] **Step 1: Write migration and source-contract tests**

```js
test("payment migration preserves provider identity and backfills TEST mode", async () => {
  const sql = await readMigration("20260821090000_payment_provider_mode");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "providerReference" STRING/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "mode" STRING NOT NULL DEFAULT 'TEST'/);
  assert.match(sql, /SET "provider" = 'paystack' WHERE "provider" IS NULL/);
  assert.doesNotMatch(sql, /DROP COLUMN|DROP TABLE|TRUNCATE/);
});
```

Add behavioral tests showing TEST success releases `heldUnits`, does not increment `bookedUnits`, and does not create a payout; LIVE success retains existing booking and payout behavior.

- [ ] **Step 2: Run tests and observe RED**

Run: `node --test staynex-backend/test/payment-migration-contract.test.mjs staynex-backend/test/payment-mode-persistence.test.mjs`

Expected: missing migration and missing mode-aware booking behavior.

- [ ] **Step 3: Add schema and additive migration**

```prisma
enum PaymentMode {
  TEST
  LIVE
}

model Payment {
  provider          String      @default("paystack")
  providerReference String?
  mode              PaymentMode @default(TEST)
  @@index([provider, mode, status])
}
```

The SQL must backfill provider before enforcing non-null and must preserve every existing payment row.

- [ ] **Step 4: Persist mode and enforce financial neutrality**

At checkout, snapshot provider and mode. On TEST success, release holds without incrementing booked inventory and skip payout creation. On TEST refund, do not decrement booked inventory. Include `providerReference` and `mode` in payment/admin mappers.

- [ ] **Step 5: Run GREEN verification**

Run: `pnpm --filter @staynex/backend prisma:generate && pnpm --filter @staynex/backend build && node --test staynex-backend/test/payment-migration-contract.test.mjs staynex-backend/test/payment-mode-persistence.test.mjs`

- [ ] **Step 6: Commit**

```bash
git add staynex-backend/prisma staynex-backend/src/modules/bookings staynex-backend/types/index.ts staynex-backend/test/payment-*.test.mjs
git commit -m "feat(payments): persist provider mode without financial side effects"
```

### Task 3: Bind provider webhooks and durable audit evidence

**Files:**
- Modify: `staynex-backend/src/modules/bookings/webhook.controller.ts`
- Modify: `staynex-backend/src/modules/bookings/bookings.service.ts`
- Modify: `staynex-backend/src/modules/payments/payment-events.service.ts`
- Test: `staynex-backend/test/payment-webhook-binding.test.mjs`

**Interfaces:**
- Consumes: persisted provider and mode from Task 2.
- Produces: `assertPaymentProvider(reference, provider, mode)` before mutations.
- Produces: required provider/mode audit fields and rejected-event outcomes.

- [ ] **Step 1: Write cross-provider and replay tests**

```js
test("an OPay webhook cannot mutate a Paystack payment", async () => {
  const result = await harness.processWebhook({
    routeProvider: "opay",
    persistedProvider: "paystack",
    persistedMode: "TEST",
    reference: "stx_cross_provider",
  });
  assert.equal(result.outcome, "PROVIDER_MISMATCH");
  assert.equal(harness.paymentWrites, 0);
  assert.equal(harness.inventoryWrites, 0);
});
```

Cover provider-reference mismatch, mode mismatch, duplicate success, repeated refund, amount mismatch, and currency mismatch.

- [ ] **Step 2: Run the webhook test and observe RED**

Run: `pnpm --filter @staynex/backend build && node --test staynex-backend/test/payment-webhook-binding.test.mjs`

Expected: existing webhook processing accepts a route provider without comparing the stored payment provider.

- [ ] **Step 3: Enforce provider/mode/reference identity before transitions**

Pass `{ provider, mode, providerReference }` into success/failure/refund methods. Read and compare the persisted payment before state changes; return a rejected, audited outcome on mismatch.

- [ ] **Step 4: Make money-event audit writes fail closed**

Require `provider` and `mode` in `PaymentEventsService.record`. Do not swallow writes associated with state transitions. Store minimized normalized payload evidence rather than unrestricted provider payloads.

- [ ] **Step 5: Run GREEN and regression verification**

Run: `pnpm --filter @staynex/backend test:payments`

- [ ] **Step 6: Commit**

```bash
git add staynex-backend/src/modules/bookings staynex-backend/src/modules/payments/payment-events.service.ts staynex-backend/test/payment-webhook-binding.test.mjs
git commit -m "fix(payments): bind webhook transitions to persisted provider"
```

### Task 4: Secure booking, payment-status, and voucher evidence

**Files:**
- Modify: `staynex-backend/src/modules/bookings/bookings.controller.ts`
- Modify: `staynex-backend/src/modules/bookings/webhook.controller.ts`
- Modify: `staynex-backend/src/modules/bookings/bookings.service.ts`
- Modify: `staynex-backend/src/modules/vouchers/voucher.controller.ts`
- Modify: `staynex-backend/src/modules/vouchers/voucher.service.ts`
- Modify: `staynex-backend/src/modules/vouchers/voucher-document.tsx`
- Modify: `staynex-backend/types/index.ts`
- Modify: `staynex-frontend/src/lib/server-catalog.ts`
- Modify: `staynex-frontend/src/lib/api.ts`
- Test: `staynex-backend/test/booking-voucher-access.test.mjs`

**Interfaces:**
- Produces: owner-scoped `getBookingForUser`, `getPaymentStatusForUser`, and `renderPdfForUser`.
- Preserves: public minimal `GET /verify/:reference`.

- [ ] **Step 1: Write ownership tests**

```js
test("a signed-in user cannot read another user's booking or voucher PDF", async () => {
  await assert.rejects(() => access.booking({ viewerId: "user-b", ownerId: "user-a" }), /not found/i);
  await assert.rejects(() => access.voucherPdf({ viewerId: "user-b", ownerId: "user-a" }), /not found/i);
});

test("public verification remains minimal and marks TEST vouchers invalid for check-in", async () => {
  const view = await access.verify({ mode: "TEST" });
  assert.equal(view.validForCheckIn, false);
  assert.equal("guestEmail" in view, false);
});
```

- [ ] **Step 2: Run and observe RED**

Run: `pnpm --filter @staynex/backend build && node --test staynex-backend/test/booking-voucher-access.test.mjs`

- [ ] **Step 3: Add session and persisted-owner authorization**

Apply `SessionGuard` and `@CurrentUser()` to private endpoints. Query with both resource identity and `booking.userId`; respond with not-found semantics for non-owners to avoid resource enumeration.

- [ ] **Step 4: Mark test voucher evidence**

Add `mode`, `validForCheckIn`, and test labelling to voucher data/PDF. Preserve the minimal public verification route and remove public QR/PDF authorization assumptions.

- [ ] **Step 5: Forward session cookies from frontend server helpers**

Private booking rendering and voucher links must call the backend with the current session. The public verification helper remains unauthenticated.

- [ ] **Step 6: Run GREEN verification**

Run: `pnpm --filter @staynex/backend build && node --test staynex-backend/test/booking-voucher-access.test.mjs && pnpm --filter @staynex/frontend check`

- [ ] **Step 7: Commit**

```bash
git add staynex-backend/src/modules/bookings staynex-backend/src/modules/vouchers staynex-backend/types/index.ts staynex-backend/test/booking-voucher-access.test.mjs staynex-frontend/src/lib
git commit -m "fix(security): require ownership for private booking evidence"
```

### Task 5: Restrict administrative money authority

**Files:**
- Modify: `staynex-backend/config/env.ts`
- Modify: `staynex-backend/src/modules/auth/auth.controller.ts`
- Modify: `staynex-backend/src/modules/admin/admin.controller.ts`
- Modify: `staynex-backend/src/modules/admin/dto.ts`
- Modify: `staynex-backend/src/modules/admin/admin.service.ts`
- Modify: `staynex-frontend/src/features/admin/payout-actions.tsx`
- Test: `staynex-backend/test/admin-money-authority.test.mjs`
- Test: `staynex-frontend/test/admin-auth-support.test.mjs`

**Interfaces:**
- Consumes: existing capability guard.
- Produces: manager-only refund/payout mutations, closed registration, required settlement reference.

- [ ] **Step 1: Write authority and validation tests**

```js
test("refund and payout mutations require ADMIN_MANAGER", async () => {
  for (const route of ["refundPayment", "markPayoutPaid", "markPayoutFailed"]) {
    assert.deepEqual(requiredCapabilities(route), ["ADMIN_MANAGER"]);
  }
});

test("marking a payout paid requires an external settlement reference", () => {
  assert.equal(markPayoutPaidSchema.safeParse({ settlementReference: "" }).success, false);
  assert.equal(markPayoutPaidSchema.safeParse({ settlementReference: "bank-20260821-001" }).success, true);
});
```

- [ ] **Step 2: Run and observe RED**

Run: `pnpm --filter @staynex/backend build && node --test staynex-backend/test/admin-money-authority.test.mjs`

- [ ] **Step 3: Apply least-privilege decorators and registration gate**

Add method-level `@RequireAnyCapability("ADMIN_MANAGER")` to refunds and payout mutations. Reject `/auth/admin/register` unless validated `ADMIN_REGISTRATION_ENABLED=true` before checking access codes.

- [ ] **Step 4: Require and audit settlement evidence**

Replace optional payout note with `settlementReference: z.string().trim().min(3).max(120)` and persist it in the payout/audit record without treating a browser success response as transfer-provider proof.

- [ ] **Step 5: Run GREEN verification**

Run: `node --test staynex-backend/test/admin-money-authority.test.mjs && pnpm --filter @staynex/frontend test:admin-auth`

- [ ] **Step 6: Commit**

```bash
git add staynex-backend/config/env.ts staynex-backend/src/modules/auth staynex-backend/src/modules/admin staynex-backend/test/admin-money-authority.test.mjs staynex-frontend/src/features/admin/payout-actions.tsx staynex-frontend/test/admin-auth-support.test.mjs
git commit -m "fix(admin): reserve money mutations for managers"
```

### Task 6: Remove production fixtures and add actionable recovery

**Files:**
- Modify: `staynex-frontend/src/lib/server-catalog.ts`
- Modify: `staynex-frontend/src/lib/server-host.ts`
- Modify: `staynex-frontend/src/app/(public)/search/page.tsx`
- Modify: `staynex-frontend/src/app/(public)/stays/[slug]/page.tsx`
- Modify: `staynex-frontend/src/app/(host)/host/dashboard/page.tsx`
- Modify: `staynex-frontend/src/app/(host)/host/properties/new/page.tsx`
- Modify: `staynex-frontend/src/features/properties/property-form.tsx`
- Modify: `staynex-frontend/src/features/booking/checkout-client.tsx`
- Modify: `staynex-frontend/src/features/booking/payment-status-client.tsx`
- Modify: `staynex-frontend/src/components/error-state.tsx`
- Create: `staynex-frontend/src/components/recovery-notice.tsx`
- Test: `staynex-frontend/test/production-recovery.test.mjs`
- Test: `staynex-frontend/test/host-admin-ui-regressions.test.mjs`

**Interfaces:**
- Produces: `RecoveryNotice` with `title`, `reason`, `retryLabel`, `onRetry`, and `secondaryAction`.
- Produces: catalog/host results that distinguish `data`, `empty`, and `unavailable` without fixtures.

- [ ] **Step 1: Read the product-design and React guidance before UI edits**

Read the complete `bespoke-product-design` and `vercel-react-best-practices` skill instructions. Preserve branding, keyboard access, mobile behavior, and server/client boundaries.

- [ ] **Step 2: Write fixture-removal and recovery tests**

```js
test("production catalog and host loaders never import fixture data", async () => {
  for (const file of ["server-catalog.ts", "server-host.ts"]) {
    const code = await source(`../src/lib/${file}`);
    assert.doesNotMatch(code, /features\/properties\/fixtures/);
  }
});

test("payment and property recovery gives a reason and retry or return action", async () => {
  const recovery = await source("../src/components/recovery-notice.tsx");
  assert.match(recovery, /reason/);
  assert.match(recovery, /Retry/);
  assert.match(recovery, /secondaryAction/);
});
```

- [ ] **Step 3: Run and observe RED**

Run: `node --test staynex-frontend/test/production-recovery.test.mjs`

- [ ] **Step 4: Remove runtime fixtures and disable invalid actions**

Return explicit unavailable results from catalog and city loaders. Do not render a booking widget for unavailable property data. Pass `citiesAvailable=false` to the host property form and disable creation until Retry succeeds.

- [ ] **Step 5: Implement calm actionable recovery**

Use a neutral or warning surface rather than a machine-red status ornament. Error copy names the failed operation and known reason. Retry re-runs the relevant request; the secondary action closes, returns, or navigates to a safe path. Replace generic `Something went wrong` in touched auth/property/payment paths.

- [ ] **Step 6: Run GREEN and UI verification**

Run: `pnpm --filter @staynex/frontend test:host-admin && node --test staynex-frontend/test/production-recovery.test.mjs && pnpm --filter @staynex/frontend check && pnpm --filter @staynex/frontend build`

- [ ] **Step 7: Commit**

```bash
git add staynex-frontend/src staynex-frontend/test
git commit -m "fix(platform): replace production fixtures with recovery states"
```

### Task 7: Provider sandbox acceptance harness

**Files:**
- Create: `staynex-backend/scripts/payment-sandbox-preflight.mjs`
- Create: `staynex-backend/scripts/payment-sandbox-acceptance.mjs`
- Modify: `staynex-backend/package.json`
- Modify: `Opay-Integration.md`
- Test: `staynex-backend/test/payment-sandbox-harness.test.mjs`

**Interfaces:**
- Produces: name/presence-only preflight and sanitized acceptance evidence.
- Consumes: test-mode provider configuration and an operator-supplied sandbox reference.

- [ ] **Step 1: Write harness safety tests**

```js
test("sandbox preflight reports variable presence without values", async () => {
  const output = await runPreflight({ PAYSTACK_TEST_SECRET_KEY: "sk_test_sensitive" });
  assert.match(output, /PAYSTACK_TEST_SECRET_KEY: present/);
  assert.doesNotMatch(output, /sk_test_sensitive/);
});
```

Test refusal when `PAYMENT_ENABLED=true`, when a live credential is supplied, or when required OPay contract inputs are incomplete.

- [ ] **Step 2: Run and observe RED**

Run: `node --test staynex-backend/test/payment-sandbox-harness.test.mjs`

- [ ] **Step 3: Implement preflight and acceptance commands**

Add `payment:sandbox:preflight` and `payment:sandbox:accept`. The acceptance command verifies the supplied provider/reference, fetches sanitized local booking/payment evidence, checks TEST mode, idempotency, zero payout, and inventory neutrality, then emits a timestamped pass/fail summary without secrets or personal data.

- [ ] **Step 4: Run local harness tests**

Run: `node --test staynex-backend/test/payment-sandbox-harness.test.mjs`

- [ ] **Step 5: Run external sandbox acceptance**

Run: `pnpm --filter @staynex/backend payment:sandbox:preflight`

Then, only when the required sandbox environment names are present and callbacks are reachable, complete provider test transactions and run `pnpm --filter @staynex/backend payment:sandbox:accept -- --provider <provider> --reference <reference>` for Paystack and OPay.

Expected: both enabled providers pass initialization, verification, signed webhook, one-time confirmation, failure/replay/refund, zero payout, and inventory-neutral checks. If either cannot be run, record `UNVERIFIED`, stop merge work, and retain the feature branch.

- [ ] **Step 6: Commit harness code after local verification**

```bash
git add staynex-backend/scripts staynex-backend/test/payment-sandbox-harness.test.mjs staynex-backend/package.json Opay-Integration.md
git commit -m "test(payments): add sandbox acceptance gate"
```

### Task 8: Git workflow source of truth and enforcement

**Gate:** Execute only after Task 7 records passing sandbox acceptance for every enabled provider.

**Files:**
- Create: `GIT-WORKFLOW.md`
- Create: `.github/workflows/quality.yml`
- Modify: `Codex.md`
- Modify: `skill.md`
- Test: `scripts/git-workflow-audit.ps1`

**Interfaces:**
- Produces: long-lived branch policy `main`, `master`, and temporary `staynex-mobile-staging` exception.
- Produces: auditable feature-to-staging-to-production promotion checks.

- [ ] **Step 1: Write the branch-policy audit first**

The PowerShell audit must fetch/prune, enumerate local and remote branch names, verify `origin/master` ancestry relative to `origin/main`, identify unmerged branches without deleting them, and return non-zero when policy evidence is incomplete.

- [ ] **Step 2: Run audit and observe RED**

Run: `pwsh -File scripts/git-workflow-audit.ps1`

Expected: failure because `origin/master` and the workflow source of truth do not yet exist.

- [ ] **Step 3: Document and link the policy**

Document feature branch to `master`, staging verification, reviewed `master` to `main` promotion, no direct production commits, no force push, short-lived branch cleanup, mobile exception expiry, secret boundaries, required checks, and rollback authority. Link it prominently from both `Codex.md` and `skill.md`.

- [ ] **Step 4: Add quality CI**

The workflow installs pnpm with the locked version, performs frozen install, Prisma generation, backend/frontend checks, targeted tests, builds, migration contract checks, and sandbox-harness unit tests. External provider acceptance remains a protected manual gate and is never simulated as CI success.

- [ ] **Step 5: Establish `master` and audit existing branches**

Fetch current remote state, prove the chosen baseline SHA, create `master` from that verified baseline, and push it only after the sandbox gate. For each obsolete remote branch, prove its commits merged or intentionally superseded before requesting or executing deletion. Preserve `staynex-mobile-staging`.

- [ ] **Step 6: Commit governance artifacts**

```bash
git add GIT-WORKFLOW.md .github/workflows/quality.yml Codex.md skill.md scripts/git-workflow-audit.ps1
git commit -m "docs(git): establish staging and production workflow"
```

### Task 9: Fresh verification and truthful handoff

**Files:**
- Review all changed files and commits from Tasks 1 through 8.

- [ ] **Step 1: Run repository checks from a clean dependency state**

```bash
pnpm install --frozen-lockfile
pnpm --filter @staynex/backend prisma:generate
pnpm --filter @staynex/backend check
pnpm --filter @staynex/backend test:payments
pnpm --filter @staynex/backend test:availability
pnpm --filter @staynex/backend test:workspace
pnpm --filter @staynex/backend test:ai
pnpm --filter @staynex/backend build
pnpm --filter @staynex/frontend test:host-admin
pnpm --filter @staynex/frontend test:admin-auth
pnpm --filter @staynex/frontend test:ai
pnpm --filter @staynex/frontend check
pnpm --filter @staynex/frontend build
pnpm --filter @staynex/frontend perf:budget
git diff --check
```

- [ ] **Step 2: Review security and product truth**

Confirm no direct payment-provider environment reads, no test payouts/revenue/live inventory, no public private-record access, no reviewer money mutations, no production fixture fallback, no generic `Something went wrong` in touched paths, and no secret-bearing output.

- [ ] **Step 3: Re-run sandbox and Git gates**

Provider acceptance must be fresh. Run the Git audit only after sandbox success. Do not merge, push production, deploy, delete branches, or claim staging/live verification when any gate is unverified.

- [ ] **Step 4: Report evidence**

List implementation commits, exact test/build results, sandbox evidence, current branch/worktree state, and separate `VERIFIED`, `UNVERIFIED`, and `PENDING` sections with reasons.
