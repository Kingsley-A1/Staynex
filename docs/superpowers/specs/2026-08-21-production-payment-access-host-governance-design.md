# Staynex Production Payment, Access, Host, and Git Governance Design

**Status:** Approved on 2026-08-21

**Objective:** Prepare Staynex for controlled payment production by introducing a validated test/live payment contract, repairing provider and database integrity, securing booking documents, tightening money-moving permissions, removing production fixture behavior, improving recoverable error states, proving provider sandboxes, and documenting the repository promotion model.

## Delivery order

Work must proceed in this order:

1. Payment-mode contract and validated configuration.
2. Additive payment migration and webhook-to-payment provider binding.
3. Private booking, payment-status, and voucher access.
4. Manager-only financial mutations and closed admin registration.
5. Current host and public fixture/error-state corrections.
6. Provider sandbox acceptance.
7. Git workflow source of truth and long-lived branch normalization.

No merge may occur before the provider sandbox acceptance gate passes. No production deployment, provider enablement, secret mutation, or destructive remote branch action is part of implementation without recorded evidence and explicit authority.

## Payment mode contract

`PAYMENT_ENABLED` is a required, strictly parsed boolean with a fail-closed default of `false` when absent outside validated production configuration.

### Test mode: `PAYMENT_ENABLED=false`

- Payment initialization and verification use the selected provider's test or sandbox endpoint and test credentials.
- In a production runtime, only an authenticated user with the `ADMIN_MANAGER` capability may initialize a test payment.
- Development and automated-test runtimes may exercise test checkout with ordinary test users.
- A successful sandbox payment may produce a confirmed test booking so the complete booking journey can be exercised.
- Every test payment persists `mode=TEST`, its provider, the Staynex reference, and the provider reference.
- Test payments and bookings are visibly labelled `Test payment — no money charged` on authorized payment, booking, voucher, and administrative surfaces.
- Test payments never create payout rows, host earnings, revenue, or settlement obligations.
- Test confirmation releases the temporary room hold without increasing live booked inventory. Test refund and cancellation paths must not decrement live booked inventory.
- A test voucher is visibly marked `TEST BOOKING — NOT VALID FOR CHECK-IN` and public verification must never represent it as a paid live reservation.
- Public users who attempt checkout receive a calm explanation that test payments are restricted, why checkout is unavailable to them, and Retry plus Return actions.

### Live mode: `PAYMENT_ENABLED=true`

- Payment initialization, verification, webhooks, and refunds use live provider endpoints and live credentials.
- Normal authenticated guest checkout is available.
- Startup fails before serving traffic when the selected live provider is incompletely configured or a test credential is supplied as a live credential.
- A live payment can become successful only after provider-authenticated evidence agrees with the persisted provider, reference, amount, currency, and mode.
- There is no silent fallback from live to test, from one provider to another, or from a failed provider call to synthetic success.

### Provider configuration

The validated configuration layer owns payment environment selection. Payment providers receive an immutable typed configuration object; they do not read `process.env` directly.

Paystack uses separate `PAYSTACK_TEST_SECRET_KEY` and `PAYSTACK_LIVE_SECRET_KEY` values. OPay uses separate test and live merchant, public-key, private-key, and base-URL values. `PAYMENT_DEFAULT_PROVIDER` accepts only `paystack` or `opay`; `PAYMENT_OPAY_ROLLOUT_PERCENT` is an integer from 0 through 100. Enabling an incompletely configured provider is a startup error.

Legacy `PAYSTACK_SECRET_KEY` is not silently treated as live. Startup explains which mode-specific variable is required without logging a value. `.env.example` documents variable names and safe descriptions only.

OPay remains unavailable for live routing until its current contract markers are replaced by verified sandbox behavior and its initialize, verify, webhook, failure, replay, and refund acceptance cases pass.

## Persistence and migration

Add an enum-backed payment mode with values `TEST` and `LIVE`. The `Payment` model keeps `provider` non-null, adds `providerReference`, and adds `mode` with a safe `TEST` default. An additive CockroachDB migration performs these schema changes and adds an index suitable for provider/mode/status reconciliation.

Existing rows are backfilled as `provider='paystack'` and `mode='TEST'` because the current checkout is explicitly presented as Paystack test checkout and the product owner confirmed the current no-charge behavior. The migration does not delete or rewrite references, amounts, booking relations, or audit rows. Rollback is a forward corrective migration; production rollback must not drop payment evidence.

## Provider and webhook integrity

Provider selection is deterministic per Staynex reference for new payments. Existing payments always resolve through their persisted provider and mode.

Before any success, failure, or refund transition:

- the payment reference must exist;
- the route or caller provider must equal the persisted provider;
- the provider response reference must equal the Staynex reference;
- the signed webhook must be verified by the same provider;
- successful amount and currency must equal the persisted payment expectation;
- the provider environment must equal the persisted payment mode.

Cross-provider or cross-mode events are recorded as rejected audit evidence and do not mutate the payment, booking, inventory, or payout. Duplicate and replayed events remain idempotent.

Provider reference and payment mode are carried through initialization, synchronous verification, webhook processing, audit records, admin payment rows, and exception rows. Audit persistence for money-state transitions is transactional or otherwise fail-closed; a financial transition must not become invisible because an audit write failed.

## Private booking and voucher access

The signed-in booking owner is required for:

- `GET /bookings/:id`;
- `GET /payments/:reference`;
- private voucher metadata;
- voucher PDF download.

Authorization is based on the persisted booking owner, never on possession of a booking ID or payment reference. Admin and host access continues through their dedicated capability- and ownership-scoped routes.

The public QR verification route remains available but returns only the minimum check-in-safe verification contract. It does not expose guest email, full booking details, payment internals, or a reusable authorization credential. Test vouchers are reported as test-only and invalid for check-in.

## Administrative authority

- Payment refunds require `ADMIN_MANAGER`.
- Payout paid and failed mutations require `ADMIN_MANAGER`.
- Payment re-verification may remain available to `ADMIN_REVIEWER` and `ADMIN_MANAGER` because it rechecks provider evidence rather than initiating a money movement.
- Backend admin registration is disabled by default through validated `ADMIN_REGISTRATION_ENABLED=false`, independent of whether the frontend access page is visible.
- Manual payout completion requires a non-empty external settlement reference and produces immutable audit evidence.
- Unauthorized and forbidden responses explain the required authority without disclosing sensitive account or policy data.

## Public and host production truth

Production search and property-detail routes never return fixture properties when the backend is unavailable. They return an honest unavailable or empty state with a reason and recovery action. A fixture property can never appear bookable in production.

The host dashboard never substitutes fixture KPIs, room counts, city IDs, area IDs, bookings, or earnings. When live data cannot be loaded, the affected value is unavailable and the action that depends on it is disabled. Host property submission cannot send a fixture foreign key.

Local fixture modules may remain for tests and development when guarded by a non-production runtime check and cannot be reached by a production server path.

## Recoverable error experience

Touched public, payment, host, and admin flows use a shared recovery presentation. Every user-visible error states:

1. what could not be completed;
2. why, using safe information the application actually knows;
3. whether retry can help;
4. a Retry action when retryable;
5. a Close, Return, or alternative-path action.

Errors are not represented by an unexplained machine-red indicator. Generic `Something went wrong` copy is removed from the relevant production paths. Error announcements use accessible semantics without trapping focus; controls remain keyboard operable and busy states prevent duplicate submissions.

## Test and sandbox acceptance

Each implementation unit follows red-green-refactor. Tests cover configuration truth tables, manager-only test checkout, live/test credential separation, provider/reference/mode webhook binding, migration shape, payout exclusion, inventory neutrality, booking ownership, voucher privacy, admin money permissions, fixture removal, and recovery actions.

Provider sandbox acceptance is an explicit gate for each enabled provider:

1. initialize a test transaction;
2. complete a successful sandbox payment;
3. verify the transaction synchronously;
4. receive and authenticate the provider webhook;
5. confirm the test booking exactly once;
6. prove no live inventory, revenue, settlement, or payout was created;
7. exercise failure, replay, mismatch, and refund paths;
8. retain sanitized command output and references without secret values or personal data.

If credentials, provider access, callback reachability, or a verified OPay contract is unavailable, acceptance is `UNVERIFIED` and merging remains blocked.

## Git workflow source of truth

After sandbox acceptance succeeds, the repository will document and establish these long-lived branches:

- `main`: production source of truth;
- `master`: staging and integration source of truth;
- `staynex-mobile-staging`: temporary mobile-application WIP exception.

Short-lived feature branches are permitted only for active reviewed work and are removed after merge. The normal promotion path is feature branch to `master`, staging verification, then reviewed promotion from `master` to `main`. Direct production commits, force pushes, secret files, and unverified promotions are prohibited.

`master` is created from a verified production baseline. Existing branches are removed only after their commits are proven merged, intentionally superseded, or preserved in an approved archive reference. Repository guidance links the workflow from the agent and developer entry documents. Remote branch deletion, protection rules, staging deployment, and production promotion remain explicit external mutations and require recorded evidence at execution time.

## Completion evidence

The final handoff separates:

- implemented behavior;
- locally verified checks;
- provider-sandbox verification;
- staging verification;
- production verification;
- unverified and pending work, including the reason.

No successful build or local test is described as proof of provider, database, staging, or production behavior.
