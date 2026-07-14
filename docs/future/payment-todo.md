
==========================

Payment system, end to end
What's genuinely solid (credit where due)
Webhook HMAC-SHA512 over the raw body with timingSafeEqual and rawBody: true wired correctly in main.ts:46; idempotent confirmation with status-guarded transitions; underpayment is rejected against the recorded amount; commission snapshotted per payment in bps with fee+payout summing exactly to gross (commission.ts); payout upsert on unique paymentId; manual settlements audited in-transaction; checkout requires a session; holds use a serializable transaction. The skeleton is sound. The failure modes live in the edges.

The errors
P1 — The "paid after expiry" black hole. (Critical. This will lose real money and real trust.)
A pending booking expires after 20 minutes (bookings.service.ts:28): releaseStale marks the booking EXPIRED, the payment FAILED, and frees the capacity. But Paystack sessions outlive 20 minutes routinely — bank transfer and USSD flows are slow, and Paystack retries webhooks for days. When the guest's charge.success finally arrives, confirmByReference:225 sees status: FAILED and returns null. Silently. The guest was charged; there is no booking, no refund, no alert, no admin-visible record. The same hole exists via failByReference racing a success. In this market this is a when-not-if.
Solution: on a verified success hitting a FAILED payment/EXPIRED booking: (a) attempt re-confirmation if the calendar still has capacity for those nights; (b) otherwise transition the payment to a new REQUIRES_REFUND-style state, alert, and surface it in an admin exception queue. And persist every webhook delivery (see admin section) so nothing can be dropped invisibly again.

P2 — Price is never snapshotted. (High.)
The hold stores no amount. Checkout charges roomType.basePriceKobo * nights at checkout time (bookings.service.ts:155). If the owner edits the price between quote and checkout, the guest pays a number they never saw. BookingView also falls back to the current base price for display — historical records drift.
Solution: snapshot nightlyPriceKobo/totalKobo on BookingHold at creation; checkout charges the snapshot or forces an explicit re-quote if it changed.

P3 — Every booking points at the same physical room unit. (High, operational.)
createHold:61 does findFirst({ isActive: true }) — deterministically the same unit — while capacity is counted at the room-type level. So Booking.roomUnitId is fiction: ten concurrent confirmed bookings all "occupy" unit #1. The day an owner asks "which guest is in which room," the data model can't answer.
Solution: either allocate a genuinely free unit per date range (unit-level assignment), or be honest — hang holds/bookings off roomTypeId and treat unit assignment as a separate operational step.

P4 — Refunds and cancellation don't exist; the enums lie. (High, product.)
PaymentStatus.REFUNDED, INITIATED, and PayoutStatus.PROCESSING/FAILED are never set by any code path — dead states. There is no cancellation endpoint for a confirmed booking, no Paystack refund API call, and the webhook ignores refund.* and charge.dispute.* events entirely. Combined with P1, "we owe this person money" has no representation in the system.
Solution (minimum viable): admin-initiated refund action → Paystack refund API → REFUNDED transition → cancel/claw back the linked PENDING payout → audit log. Handle refund/dispute webhook events at least by recording them.

P5 — Currency is never verified. Confirmation checks amount but not currency; syncPaymentStatus receives verified.currency and discards it. One-line fix: flag/reject on currency !== payment.currency.

P6 — Webhook missing amount skips validation. event.data?.amount ?? null → the underpaid check is bypassed entirely (bookings.service.ts:235). Fall back to verifyTransaction before confirming when amount is absent.

P7 — releaseStale() runs on the hot path. Every quote/hold/checkout full-scans expired holds and stale bookings, then loops sequential transactions. You already built the correct pattern for property publishing (property-auto-publisher.service.ts) — holds deserve the same background sweeper. The comment even admits it: "no scheduler in POC."

P8 — Unthrottled public endpoints that call Paystack. GET /payments/:reference (webhook.controller.ts:57) has no @RateLimit, and every poll on a non-terminal payment triggers a live Paystack verify. Your own status page polls it every 3s × 20. Rate-limit it and debounce the sync (skip if verified < ~15s ago).

P9 — The status page dead-ends. After 60 seconds payment-status-client.tsx stops polling but keeps showing the spinner forever. It needs a terminal "this is taking longer than expected — keep your reference stx_…, we'll email you / contact support" state.

P10 — Availability drift is invisible. All counter releases are best-effort updateMany ... where heldUnits > 0. Any double-release bug is silently absorbed; no invariant ever checks that calendar counters match derived truth from live holds + pending bookings. Add a periodic reconciliation job that alerts on drift.

P11 — markPayoutPaid ignores eligibleAt. An admin can settle a payout before check-in even happens — the eligibility gate exists in data (admin.service.ts:209) but is not enforced in the transition. Block (or require an explicit override + note) before eligibleAt; add a mark-FAILED path with a reason.

What admins need that they don't have
Today the admin gets: last-100 bookings, last-100 payments, a 100-row payout queue with totals, a mark-paid button, and 100 audit/AI log rows. That's a demo surface, not a management one. In priority order:

A payment exception queue — the P1/P4/P5 class: money moved but no booking confirmed, underpaid-then-cancelled, currency mismatches, refunds owed. These states are currently invisible by construction, which is the most dangerous property a payment system can have.
Persisted webhook events — a PaymentEvent table (event id, type, reference, raw payload, processing outcome). Right now webhook handling outcomes exist only in stdout. This is your money audit trail and the backbone of #1.
Search, filters, pagination — by reference, guest email, property, status, date range. take: 100 with no cursor collapses within weeks of real volume.
Payout destination visibility — admins settle payouts manually by bank transfer, yet AdminPayoutRow shows no payout method at all. Bank name + last4 (already stored masked on OwnerPayoutMethod) must appear on the payout row, plus a settlement-reference/note field to record the actual transfer ID.
A "re-verify with Paystack" action per payment — syncPaymentStatus already exists; expose it as an audited admin button for support cases.
Refund initiation (P4) from the payment detail view.
Reconciliation dashboards — daily gross vs. Paystack settlement, availability-counter drift, payouts overdue past eligibleAt, and the active commission rate (env value + per-payment snapshots).