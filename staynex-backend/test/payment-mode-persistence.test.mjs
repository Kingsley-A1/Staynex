import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../dist/db/client.js";
import { BookingsService } from "../dist/src/modules/bookings/bookings.service.js";
import { toPaymentRow } from "../dist/src/modules/bookings/report-mappers.js";

function paymentFixture(mode) {
  return {
    id: `payment-${mode.toLowerCase()}`,
    bookingId: `booking-${mode.toLowerCase()}`,
    amount: 100_000,
    grossAmountKobo: 100_000,
    platformFeeKobo: 10_000,
    ownerPayoutKobo: 90_000,
    commissionRateBps: 1_000,
    currency: "NGN",
    provider: "paystack",
    providerReference: null,
    reference: `stx_${mode.toLowerCase()}`,
    mode,
    status: "PENDING",
    paidAt: null,
    lastVerifiedAt: null,
    createdAt: new Date("2026-08-21T10:00:00.000Z"),
    updatedAt: new Date("2026-08-21T10:00:00.000Z"),
    booking: {
      id: `booking-${mode.toLowerCase()}`,
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
  };
}

function transitionHarness(mode) {
  const payment = paymentFixture(mode);
  const calls = {
    availability: [],
    booking: [],
    payment: [],
    payouts: [],
    notifications: [],
  };
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
    },
  };
  const service = new BookingsService(
    {},
    {
      onBookingConfirmed: async (id) => calls.notifications.push(id),
      onPaymentRefunded: async (id) => calls.notifications.push(id),
    },
    {},
  );
  return { payment, calls, tx, service };
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

test("TEST payment confirmation releases the hold without live inventory or payout", async () => {
  const harness = transitionHarness("TEST");
  const result = await withTransaction(harness.tx, () =>
    harness.service.applyChargeSuccess(harness.payment.reference, {
      amountKobo: 100_000,
      currency: "NGN",
    }),
  );

  assert.equal(result.outcome, "CONFIRMED");
  assert.equal(harness.calls.availability.length, 1);
  assert.deepEqual(harness.calls.availability[0].data, {
    heldUnits: { decrement: 1 },
  });
  assert.equal(harness.calls.payouts.length, 0);
  assert.equal(harness.calls.notifications.length, 1);
});

test("LIVE payment confirmation converts held inventory and creates one payout", async () => {
  const harness = transitionHarness("LIVE");
  const result = await withTransaction(harness.tx, () =>
    harness.service.applyChargeSuccess(harness.payment.reference, {
      amountKobo: 100_000,
      currency: "NGN",
    }),
  );

  assert.equal(result.outcome, "CONFIRMED");
  assert.deepEqual(harness.calls.availability[0].data, {
    heldUnits: { decrement: 1 },
    bookedUnits: { increment: 1 },
  });
  assert.equal(harness.calls.payouts.length, 1);
});

test("refunding a TEST booking does not decrement live booked inventory", async () => {
  const harness = transitionHarness("TEST");
  harness.payment.status = "SUCCESS";
  harness.payment.booking.status = "CONFIRMED";
  harness.payment.payout = null;
  harness.tx.payout.update = async (args) => {
    harness.calls.payouts.push(args);
    return args.data;
  };

  const result = await withTransaction(harness.tx, () =>
    harness.service.applyRefund(harness.payment.reference, "sandbox acceptance"),
  );

  assert.equal(result.outcome, "REFUNDED");
  assert.equal(harness.calls.availability.length, 0);
  assert.equal(harness.calls.booking.at(-1).data.status, "CANCELLED");
});

test("checkout snapshots the selected provider mode on the payment row", async () => {
  const original = prisma.$transaction;
  let paymentCreate;
  const provider = {
    name: "paystack",
    mode: "TEST",
    initializeTransaction: async (input) => ({
      authorizationUrl: "https://sandbox.example/checkout",
      reference: input.reference,
      providerReference: null,
    }),
  };
  const hold = {
    id: "hold-1",
    roomUnitId: "unit-1",
    userId: "guest-1",
    checkIn: new Date("2026-09-10T00:00:00.000Z"),
    checkOut: new Date("2026-09-12T00:00:00.000Z"),
    adults: 2,
    children: 0,
    infants: 0,
    nightlyPriceKobo: 50_000,
    totalKobo: 100_000,
    expiresAt: new Date(Date.now() + 60_000),
    roomUnit: {
      roomType: {
        id: "room-type-1",
        basePriceKobo: 50_000,
        property: { status: "APPROVED" },
      },
    },
  };
  const tx = {
    bookingHold: {
      findUnique: async () => hold,
      delete: async () => hold,
    },
    booking: {
      create: async () => ({ id: "booking-1" }),
    },
    payment: {
      create: async (args) => {
        paymentCreate = args.data;
        return args.data;
      },
    },
  };
  prisma.$transaction = async (callback) => callback(tx);
  const service = new BookingsService(
    { selectForCheckout: () => provider },
    {},
    {},
  );

  try {
    const result = await service.checkout(
      { holdId: "hold-1", email: "manager@example.com" },
      "guest-1",
    );
    assert.equal(result.provider, "paystack");
    assert.equal(result.mode, "TEST");
    assert.equal(paymentCreate.provider, "paystack");
    assert.equal(paymentCreate.mode, "TEST");
  } finally {
    prisma.$transaction = original;
  }
});

test("admin payment rows expose provider reference and payment mode", () => {
  const payment = paymentFixture("TEST");
  payment.providerReference = "sandbox-provider-42";
  payment.payout = null;
  payment.booking.guestEmail = "manager@example.com";
  payment.booking.roomUnit.roomType.property.name = "Sandbox Stay";

  const row = toPaymentRow(payment);

  assert.equal(row.provider, "paystack");
  assert.equal(row.providerReference, "sandbox-provider-42");
  assert.equal(row.mode, "TEST");
});
