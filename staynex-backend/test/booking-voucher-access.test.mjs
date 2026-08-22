import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GUARDS_METADATA } from "@nestjs/common/constants.js";
import { prisma } from "../dist/db/client.js";
import { SessionGuard } from "../dist/src/modules/auth/access-control.js";
import { BookingsController } from "../dist/src/modules/bookings/bookings.controller.js";
import { BookingsService } from "../dist/src/modules/bookings/bookings.service.js";
import { PaymentsWebhookController } from "../dist/src/modules/bookings/webhook.controller.js";
import { VoucherController } from "../dist/src/modules/vouchers/voucher.controller.js";
import { VoucherService } from "../dist/src/modules/vouchers/voucher.service.js";

function guardsFor(controller, method) {
  return Reflect.getMetadata(GUARDS_METADATA, controller.prototype[method]) ?? [];
}

function hasSessionGuard(controller, method) {
  return guardsFor(controller, method).some(
    (guard) => guard === SessionGuard || guard?.name === SessionGuard.name,
  );
}

test("private booking, payment-status, PDF, and QR routes require a session", () => {
  assert.equal(hasSessionGuard(BookingsController, "getBooking"), true);
  assert.equal(hasSessionGuard(PaymentsWebhookController, "status"), true);
  assert.equal(hasSessionGuard(VoucherController, "pdf"), true);
  assert.equal(hasSessionGuard(VoucherController, "qr"), true);
  assert.equal(hasSessionGuard(VoucherController, "verify"), false);
});

test("a signed-in user cannot read another user's booking or payment status", async () => {
  const service = new BookingsService(
    { get: () => assert.fail("provider must not be called") },
    {},
    {},
  );
  const originalBooking = prisma.booking.findFirst;
  const originalPayment = prisma.payment.findFirst;
  prisma.booking.findFirst = async (args) => {
    assert.deepEqual(args.where, { id: "booking-a", userId: "user-b" });
    return null;
  };
  prisma.payment.findFirst = async (args) => {
    assert.equal(args.where.reference, "stx_owner_a");
    assert.deepEqual(args.where.booking, { userId: "user-b" });
    return null;
  };
  try {
    await assert.rejects(
      () => service.getBookingForUser("booking-a", "user-b"),
      /booking not found/i,
    );
    await assert.rejects(
      () => service.getPaymentStatusForUser("stx_owner_a", "user-b"),
      /payment not found/i,
    );
  } finally {
    prisma.booking.findFirst = originalBooking;
    prisma.payment.findFirst = originalPayment;
  }
});

test("a signed-in user cannot render another user's voucher PDF", async () => {
  const service = new VoucherService();
  const original = prisma.payment.findFirst;
  prisma.payment.findFirst = async (args) => {
    assert.equal(args.where.reference, "stx_owner_a");
    assert.deepEqual(args.where.booking, { userId: "user-b" });
    return null;
  };
  try {
    const result = await service.renderPdfForUser("stx_owner_a", "user-b");
    assert.equal(result, null);
  } finally {
    prisma.payment.findFirst = original;
  }
});

test("public verification is minimal and TEST vouchers are invalid for check-in", async () => {
  const service = new VoucherService();
  service.load = async () => ({
    reference: "stx_test_public",
    mode: "TEST",
    paidAndConfirmed: true,
    bookingStatus: "CONFIRMED",
    guestName: "Private Guest",
    guestEmail: "private@example.com",
    propertyName: "Test Property",
    cityName: "Lagos",
    areaName: "Ikoyi",
    addressLine: "Private address",
    roomTypeName: "Suite",
    unitCode: "PRIVATE-UNIT",
    checkIn: "2026-09-10",
    checkOut: "2026-09-12",
    nights: 2,
    adults: 2,
    children: 0,
    infants: 0,
    amountKobo: 100_000,
    currency: "NGN",
    provider: "paystack",
    paidAt: "2026-08-21T10:00:00.000Z",
    verifyUrl: "https://staynexbookings.ng/verify/stx_test_public",
  });

  const view = await service.getVerification("stx_test_public");

  assert.equal(view.mode, "TEST");
  assert.equal(view.status, "TEST");
  assert.equal(view.validForCheckIn, false);
  for (const privateField of [
    "guestName",
    "guestEmail",
    "guestEmailMasked",
    "unitCode",
    "guests",
    "confirmedAt",
  ]) {
    assert.equal(privateField in view, false, `${privateField} must stay private`);
  }
});

test("frontend private booking reads forward the request session", () => {
  const source = readFileSync(
    new URL("../../staynex-frontend/src/lib/server-catalog.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /import \{ cookies \} from "next\/headers"/);
  assert.match(
    source,
    /fetch\(`\$\{API_BASE\}\/bookings\/\$\{id\}`,[\s\S]*headers: await authHeaders\(\)/,
  );
});

test("authorized UI and PDF label TEST evidence without live-success claims", () => {
  const confirmedPage = readFileSync(
    new URL(
      "../../staynex-frontend/src/app/(public)/booking/confirmed/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const paymentStatus = readFileSync(
    new URL(
      "../../staynex-frontend/src/features/booking/payment-status-client.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const pdf = readFileSync(
    new URL("../src/modules/vouchers/voucher-document.tsx", import.meta.url),
    "utf8",
  );

  assert.match(confirmedPage, /Test payment — no money charged/);
  assert.match(paymentStatus, /not valid for check-in/);
  assert.match(pdf, /TEST BOOKING — NOT VALID FOR CHECK-IN/);
  assert.doesNotMatch(`${confirmedPage}\n${paymentStatus}`, /Something went wrong/);
});
