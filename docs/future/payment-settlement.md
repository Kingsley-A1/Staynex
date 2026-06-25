# Payment Settlement

How money flows through Staynex: what the guest pays, what Staynex keeps, and what
the owner is owed. The backend is the only authority for these amounts (skill.md
§9). All money is integer **kobo**; currency is **NGN**.

## Model

Every booking charge is split three ways and the split is **snapshotted on the
`Payment` at checkout** so historical accounting never shifts if the platform rate
later changes:

```
grossAmountKobo   = what the guest pays (full booking amount)
platformFeeKobo   = Staynex commission   = round(gross * commissionRateBps / 10000)
ownerPayoutKobo   = what the owner is owed = gross - platformFeeKobo
commissionRateBps = the rate used, in basis points (1000 = 10%)
```

- `platformFeeKobo + ownerPayoutKobo === grossAmountKobo` exactly (the owner
  receives the rounding remainder — no leak).
- The single implementation lives in
  [`commission.ts`](../staynex-backend/src/modules/payments/commission.ts)
  (`splitPayment`, `resolveCommissionBps`). Nothing else re-derives the split.
- Commission defaults to **1000 bps (10%)** and is overridable via the
  `PLATFORM_COMMISSION_BPS` env var, validated at boot in
  [`config/env.ts`](../staynex-backend/config/env.ts).

### `Payment.amount` (compatibility)

`Payment.amount` is retained as a **compatibility mirror** of `grossAmountKobo`.
All new logic reads/writes the explicit accounting fields; `amount` is kept equal
to gross so older rows and any un-migrated reader keep working. Prefer the
explicit fields everywhere.

---

## Phase A — current (implemented)

Guest pays Staynex via Paystack; Staynex records the commission; the owner payout
is created as **pending** and settled **manually**.

### Flow

1. **Checkout** ([`bookings.service.ts`](../staynex-backend/src/modules/bookings/bookings.service.ts) `checkout`)
   creates a `PENDING_PAYMENT` booking and a `PENDING` payment, snapshotting
   `grossAmountKobo / platformFeeKobo / ownerPayoutKobo / commissionRateBps`.
   Paystack collects the **full gross** amount from the guest.
2. **Verified success** (`confirmByReference`, driven by the Paystack webhook and
   the status-sync fallback), in one transaction:
   - payment → `SUCCESS`, `paidAt` set;
   - booking → `CONFIRMED`;
   - a `Payout` row is created `PENDING` with `eligibleAt = checkIn + 24h`,
     linked to `bookingId`, `paymentId`, `ownerId`, `propertyId`, and
     `amount = ownerPayoutKobo`.
   - The payout `upsert` is keyed on the unique `paymentId`, so webhook + sync
     double-delivery is **idempotent** — never two payouts for one payment.
3. **Failed / expired / underpaid** payments **never** create a payout and never
   confirm a booking.
4. **Manual settlement**: an admin reviews the queue at `/admin/payouts` and marks
   a payout **paid** once the owner has been paid out-of-band. This transition is
   an admin override and writes an `AuditLog` entry (`PAYOUT_MARKED_PAID`),
   stamping `paidAt`, `approvedAt`, and `processedByUserId`.

> Paystack is a **payment collector only** in Phase A. Staynex does not initiate
> any owner transfer through Paystack yet.

### Where it surfaces

- **Owner** (`/owner/bookings`, `/owner/bookings/[id]`): earnings show **net owner
  payout**, not gross. KPIs: net earnings (paid, after fee) and pending payout
  (owed, not yet settled). The detail page shows the full gross → fee → payout
  breakdown and payout status.
- **Admin** (`/admin/bookings`): the payments table shows gross, Staynex fee,
  owner payout, payment status, and payout status.
- **Admin** (`/admin/payouts`): the settlement queue with platform totals (gross
  revenue, Staynex commission, pending payout, paid out) and the manual **Mark
  paid** action.

### Eligibility note

`eligibleAt` (check-in + 24h) is **advisory** in Phase A — the queue flags
not-yet-eligible payouts but does not hard-block a manual settlement, since the
admin is the authority. Phase B turns eligibility into an automated trigger.

### Data model

- `Payment`: `grossAmountKobo`, `platformFeeKobo`, `ownerPayoutKobo`,
  `commissionRateBps`, `paidAt` (+ compat `amount`).
- `Payout`: `bookingId` (unique), `paymentId` (unique), `ownerId`, `propertyId`,
  `amount`, `currency`, `status`, `eligibleAt`, `approvedAt`, `paidAt`,
  `processedByUserId`.

---

## Phase B — future (not implemented)

Automate the owner payout once eligibility is reached. **Out of scope for Phase A**
and intentionally not built yet.

- **Owner bank verification**: collect + verify owner bank details (Paystack
  resolve account), stored against the owner profile.
- **Transfer recipients**: create Paystack Transfer Recipients for verified owners
  (store the recipient code, never raw bank credentials beyond what Paystack needs).
- **Automated payout processing**: a scheduled job promotes `PENDING → PROCESSING`
  for eligible payouts (`eligibleAt <= now`) and initiates Paystack Transfers,
  recording the transfer reference.
- **Retries & failures**: handle transfer webhooks (`transfer.success`,
  `transfer.failed`, `transfer.reversed`); back-off retries; surface `FAILED`
  payouts for admin intervention.
- **Refunds & disputes**: model refunds/chargebacks against a settled or
  in-flight payout (clawback / negative balance handling).
- **Payout audit trail expansion**: per-state-transition audit records, batch
  payout runs, and a `Payout` ↔ transfer-event history table.
- **Owner payout statements**: downloadable settlement statements per period.

### Migration path A → B

The Phase A schema is forward-compatible: `Payout.status` already includes
`PROCESSING`/`FAILED`, and `approvedAt`/`eligibleAt`/`processedByUserId` exist so
the automated processor can adopt the same rows without a breaking change. Phase B
adds owner bank/recipient fields and a transfer-event log; it does not need to
rewrite Phase A payouts.
