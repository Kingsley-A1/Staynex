import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { prisma } from "../dist/db/client.js";
import { BookingsService } from "../dist/src/modules/bookings/bookings.service.js";
import { PaymentsWebhookController } from "../dist/src/modules/bookings/webhook.controller.js";
import { PaymentEventsService } from "../dist/src/modules/payments/payment-events.service.js";

function paymentFixture(overrides = {}) {
  return {
    id: "payment-1",
    bookingId: "booking-1",
    amount: 100_000,
    grossAmountKobo: 100_000,
    platformFeeKobo: 10_000,
    ownerPayoutKobo: 90_000,
    commissionRateBps: 1_000,
    currency: "NGN",
    provider: "paystack",
    providerReference: "provider-1",
    reference: "stx_binding_1",
    mode: "TEST",
    status: "PENDING",
    paidAt: null,
    lastVerifiedAt: null,
    createdAt: new Date("2026-08-21T10:00:00.000Z"),
    updatedAt: new Date("2026-08-21T10:00:00.000Z"),
    booking: {
      id: "booking-1",
      status: "PENDING_PAYMENT",
      checkIn: new Date("2026-09-10T00:00:00.000Z"),
      checkOut: new Date("2026-09-12T00:00:00.000Z"),
      roomUnit: {
        roomType: {
          id: "room-type-1",
          property: { id: "property-1", ownerId: "owner-1" },
        },
      },
    },
    ...overrides,
  };
}

function transitionHarness(overrides = {}) {
  const payment = paymentFixture(overrides);
  const calls = { payment: [], availability: [], booking: [], payouts: [] };
  const tx = {
    payment: {
      findUnique: async () => payment,
      update: async (args) => {
        calls.payment.push(args);
        return payment;
      },
    },
    availabilityCalendar: {
      updateMany: async (args) => {
        calls.availability.push(args);
        return { count: 2 };
      },
      findMany: async () => [],
    },
    booking: {
      update: async (args) => {
        calls.booking.push(args);
        return payment.booking;
      },
    },
    payout: {
      upsert: async (args) => {
        calls.payouts.push(args);
        return args.create;
      },
      update: async (args) => {
        calls.payouts.push(args);
        return args.data;
      },
    },
  };
  const service = new BookingsService(
    {},
    { onBookingConfirmed: async () => {}, onPaymentRefunded: async () => {} },
    {},
  );
  return { payment, calls, tx, service };
}

function evidence(payment, overrides = {}) {
  return {
    provider: payment.provider,
    mode: payment.mode,
    reference: payment.reference,
    providerReference: payment.providerReference,
    ...overrides,
  };
}

async function withTransaction(tx, action) {
  const original = prisma.$transaction;
  prisma.$transaction = async (callback) => callback(tx);
  try {
    return await action();
  } finally {
    prisma.$transaction = original;
  }
}

function assertNoMoneyWrites(calls) {
  assert.equal(calls.payment.length, 0);
  assert.equal(calls.availability.length, 0);
  assert.equal(calls.booking.length, 0);
  assert.equal(calls.payouts.length, 0);
}

test("an OPay webhook cannot mutate a Paystack payment", async () => {
  const harness = transitionHarness();
  const result = await withTransaction(harness.tx, () =>
    harness.service.applyChargeSuccess(
      harness.payment.reference,
      { amountKobo: 100_000, currency: "NGN" },
      evidence(harness.payment, { provider: "opay" }),
    ),
  );

  assert.equal(result.outcome, "PROVIDER_MISMATCH");
  assertNoMoneyWrites(harness.calls);
});

test("the signed webhook route forwards provider identity into transition and audit", async () => {
  const event = {
    kind: "charge.success",
    reference: "stx_binding_1",
    providerReference: "opay-transaction-1",
    amountKobo: 100_000,
    currency: "NGN",
    rawType: "payment.success",
    payload: { authorization: "secret-that-must-not-be-forwarded" },
  };
  const provider = {
    name: "opay",
    mode: "TEST",
    verifySignature: () => true,
    parseWebhook: () => event,
  };
  let transition;
  let audit;
  const controller = new PaymentsWebhookController(
    { get: () => provider },
    {
      applyChargeSuccess: async (...args) => {
        transition = args;
        return { outcome: "CONFIRMED" };
      },
    },
    {
      record: async (entry) => {
        audit = entry;
      },
    },
  );

  await controller.opayWebhook({ rawBody: Buffer.from("{}"), headers: {} });

  assert.deepEqual(transition[2], {
    provider: "opay",
    mode: "TEST",
    reference: "stx_binding_1",
    providerReference: "opay-transaction-1",
  });
  assert.equal(audit.provider, "opay");
  assert.equal(audit.mode, "TEST");
  assert.equal(audit.providerReference, "opay-transaction-1");
  assert.equal("authorization" in audit.payload, false);
});

test("a webhook from the wrong provider mode cannot mutate payment state", async () => {
  const harness = transitionHarness();
  const result = await withTransaction(harness.tx, () =>
    harness.service.applyChargeFailure(
      harness.payment.reference,
      evidence(harness.payment, { mode: "LIVE" }),
    ),
  );

  assert.equal(result.outcome, "MODE_MISMATCH");
  assertNoMoneyWrites(harness.calls);
});

test("provider-reference and response-reference mismatches are rejected", async () => {
  for (const [override, expected] of [
    [{ providerReference: "provider-other" }, "PROVIDER_REFERENCE_MISMATCH"],
    [{ reference: "stx_other" }, "REFERENCE_MISMATCH"],
  ]) {
    const harness = transitionHarness();
    const result = await withTransaction(harness.tx, () =>
      harness.service.applyRefund(
        harness.payment.reference,
        "provider webhook",
        evidence(harness.payment, override),
      ),
    );
    assert.equal(result.outcome, expected);
    assertNoMoneyWrites(harness.calls);
  }
});

test("duplicate success and repeated refund deliveries stay idempotent", async () => {
  const success = transitionHarness({ status: "SUCCESS" });
  const duplicateSuccess = await withTransaction(success.tx, () =>
    success.service.applyChargeSuccess(
      success.payment.reference,
      { amountKobo: 100_000, currency: "NGN" },
      evidence(success.payment),
    ),
  );
  assert.equal(duplicateSuccess.outcome, "DUPLICATE");
  assertNoMoneyWrites(success.calls);

  const refund = transitionHarness({ status: "REFUNDED" });
  refund.payment.payout = null;
  const duplicateRefund = await withTransaction(refund.tx, () =>
    refund.service.applyRefund(
      refund.payment.reference,
      "provider webhook",
      evidence(refund.payment),
    ),
  );
  assert.equal(duplicateRefund.outcome, "DUPLICATE");
  assertNoMoneyWrites(refund.calls);
});

test("amount and currency mismatches never confirm or create payouts", async () => {
  for (const [paid, expected] of [
    [{ amountKobo: 100_001, currency: "NGN" }, "AMOUNT_MISMATCH"],
    [{ amountKobo: 100_000, currency: "USD" }, "CURRENCY_MISMATCH"],
  ]) {
    const harness = transitionHarness();
    const result = await withTransaction(harness.tx, () =>
      harness.service.applyChargeSuccess(
        harness.payment.reference,
        paid,
        evidence(harness.payment),
      ),
    );
    assert.equal(result.outcome, expected);
    assert.equal(harness.calls.payouts.length, 0);
    assert.equal(
      harness.calls.availability.some((call) => call.data.bookedUnits),
      false,
    );
    assert.equal(harness.calls.payment.at(-1).data.status, "REQUIRES_REFUND");
  }
});

test("payment audit writes fail closed and require provider mode", async () => {
  const service = new PaymentEventsService({
    onPaymentException: async () => {},
  });
  const original = prisma.paymentEvent.create;
  prisma.paymentEvent.create = async () => {
    throw new Error("audit unavailable");
  };
  try {
    await assert.rejects(
      () =>
        service.record({
          eventType: "charge.success",
          provider: "paystack",
          mode: "TEST",
          providerReference: "provider-1",
          reference: "stx_binding_1",
          outcome: "CONFIRMED",
        }),
      /audit unavailable/,
    );
    await assert.rejects(
      () =>
        service.record({
          eventType: "charge.success",
          provider: "paystack",
          reference: "stx_binding_1",
          outcome: "CONFIRMED",
        }),
      /payment audit mode/i,
    );
  } finally {
    prisma.paymentEvent.create = original;
  }
});

test("audit payload persistence keeps normalized evidence and drops secrets", async () => {
  const service = new PaymentEventsService({
    onPaymentException: async () => {},
  });
  const original = prisma.paymentEvent.create;
  let created;
  prisma.paymentEvent.create = async (args) => {
    created = args.data;
    return args.data;
  };
  try {
    await service.record({
      eventType: "charge.success",
      provider: "paystack",
      mode: "TEST",
      providerReference: "provider-1",
      reference: "stx_binding_1",
      outcome: "CONFIRMED",
      payload: {
        kind: "charge.success",
        reference: "stx_binding_1",
        providerReference: "provider-1",
        amountKobo: 100_000,
        currency: "NGN",
        authorization: "must-not-persist",
        customer: { email: "must-not-persist@example.com" },
      },
    });
  } finally {
    prisma.paymentEvent.create = original;
  }

  assert.equal(created.mode, "TEST");
  assert.equal(created.providerReference, "provider-1");
  assert.deepEqual(created.payload, {
    kind: "charge.success",
    reference: "stx_binding_1",
    providerReference: "provider-1",
    amountKobo: 100_000,
    currency: "NGN",
  });
});

test("payment-event migration preserves structured provider evidence", () => {
  const schema = readFileSync(
    new URL("../prisma/schema.prisma", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL(
      "../prisma/migrations/20260821100000_payment_event_provider_evidence/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(schema, /model PaymentEvent[\s\S]*mode\s+PaymentMode/);
  assert.match(schema, /model PaymentEvent[\s\S]*providerReference\s+String\?/);
  assert.match(
    migration,
    /ADD COLUMN "mode" "PaymentMode" NOT NULL DEFAULT 'TEST'/,
  );
  assert.match(migration, /ADD COLUMN "providerReference" STRING/);
  assert.doesNotMatch(
    migration,
    /DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i,
  );
});
