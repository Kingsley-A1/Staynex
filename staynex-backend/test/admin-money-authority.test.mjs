import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { prisma } from "../dist/db/client.js";
import { AdminController } from "../dist/src/modules/admin/admin.controller.js";
import { AdminService } from "../dist/src/modules/admin/admin.service.js";
import { markPayoutPaidSchema } from "../dist/src/modules/admin/dto.js";
import { AuthController } from "../dist/src/modules/auth/auth.controller.js";

const REQUIRED_CAPABILITIES_KEY = "staynex:required-capabilities";

function requiredCapabilities(method) {
  return (
    Reflect.getMetadata(
      REQUIRED_CAPABILITIES_KEY,
      AdminController.prototype[method],
    ) ?? []
  );
}

test("refund and payout mutations require ADMIN_MANAGER while re-verification stays reviewable", () => {
  assert.deepEqual(requiredCapabilities("refundPayment"), ["ADMIN_MANAGER"]);
  assert.deepEqual(requiredCapabilities("markPayoutPaid"), ["ADMIN_MANAGER"]);
  assert.deepEqual(requiredCapabilities("markPayoutFailed"), ["ADMIN_MANAGER"]);
  assert.deepEqual(requiredCapabilities("reverifyPayment"), []);
});

test("admin registration is closed before credentials are parsed when disabled", async () => {
  const priorDatabaseUrl = process.env.DATABASE_URL;
  const priorFlag = process.env.ADMIN_REGISTRATION_ENABLED;
  process.env.DATABASE_URL =
    "postgresql://user:password@localhost:26257/staynex?schema=public";
  process.env.ADMIN_REGISTRATION_ENABLED = "false";
  let calls = 0;
  try {
    const controller = new AuthController({
      adminRegister: async () => {
        calls += 1;
      },
    });

    await assert.rejects(
      () => controller.adminRegister({}, "127.0.0.1", {}),
      (error) =>
        error instanceof ForbiddenException &&
        /admin registration is closed/i.test(error.message),
    );
    assert.equal(calls, 0);
  } finally {
    if (priorDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = priorDatabaseUrl;
    if (priorFlag === undefined) delete process.env.ADMIN_REGISTRATION_ENABLED;
    else process.env.ADMIN_REGISTRATION_ENABLED = priorFlag;
  }
});

test("marking a payout paid requires a structured settlement reference", () => {
  assert.equal(markPayoutPaidSchema.safeParse({}).success, false);
  assert.equal(
    markPayoutPaidSchema.safeParse({ settlementReference: "  " }).success,
    false,
  );
  assert.equal(
    markPayoutPaidSchema.safeParse({
      settlementReference: "BANK-TRANSFER-20260822-001",
    }).success,
    true,
  );
});

test("paid payout persistence keeps the external settlement reference separate from notes", async () => {
  const service = new AdminService(
    { record: async () => {} },
    { onPayoutSettled: async () => {} },
    {},
    {},
    {},
    {},
  );
  const originalFind = prisma.payout.findUnique;
  const originalTransaction = prisma.$transaction;
  let updateData;
  const now = new Date("2026-08-22T12:00:00.000Z");
  const row = {
    id: "payout-1",
    bookingId: "booking-1",
    paymentId: "payment-1",
    ownerId: "owner-1",
    propertyId: "property-1",
    amount: 90_000,
    currency: "NGN",
    status: "PAID",
    eligibleAt: new Date("2026-08-20T12:00:00.000Z"),
    approvedAt: now,
    paidAt: now,
    failedAt: null,
    settlementReference: "BANK-TRANSFER-20260822-001",
    note: "Checked against bank portal",
    processedByUserId: "manager-1",
    createdAt: now,
    updatedAt: now,
    payment: {
      reference: "stx_money_1",
      grossAmountKobo: 100_000,
      platformFeeKobo: 10_000,
    },
    property: { name: "Harbour Stay", city: { name: "Lagos" } },
    owner: { name: "Host", email: "host@example.com", payoutMethod: null },
  };

  prisma.payout.findUnique = async () => ({
    id: "payout-1",
    status: "PENDING",
    propertyId: "property-1",
    eligibleAt: new Date("2026-08-20T12:00:00.000Z"),
  });
  prisma.$transaction = async (callback) =>
    callback({
      payout: {
        update: async (args) => {
          updateData = args.data;
          return row;
        },
      },
    });

  try {
    const result = await service.markPayoutPaid(
      {
        id: "manager-1",
        email: "manager@example.com",
        name: "Manager",
        role: "ADMIN_MANAGER",
        capabilities: ["ADMIN_MANAGER"],
      },
      "payout-1",
      {
        settlementReference: "BANK-TRANSFER-20260822-001",
        note: "Checked against bank portal",
      },
    );

    assert.equal(updateData.settlementReference, "BANK-TRANSFER-20260822-001");
    assert.equal(updateData.note, "Checked against bank portal");
    assert.equal(result.settlementReference, "BANK-TRANSFER-20260822-001");
  } finally {
    prisma.payout.findUnique = originalFind;
    prisma.$transaction = originalTransaction;
  }
});

test("payout settlement evidence migration is additive", () => {
  const schema = readFileSync(
    new URL("../prisma/schema.prisma", import.meta.url),
    "utf8",
  );
  let migration = "";
  try {
    migration = readFileSync(
      new URL(
        "../prisma/migrations/20260821110000_payout_settlement_reference/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
  } catch {
    // The assertions below retain the intended RED state until implemented.
  }

  assert.match(schema, /model Payout[\s\S]*settlementReference\s+String\?/);
  assert.match(
    migration,
    /ALTER TABLE "Payout" ADD COLUMN "settlementReference" STRING/,
  );
  assert.doesNotMatch(
    migration,
    /DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i,
  );
});
