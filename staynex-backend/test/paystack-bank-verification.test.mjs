import assert from "node:assert/strict";
import test from "node:test";
import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { prisma } from "../dist/db/client.js";
import { BankDirectoryService } from "../dist/src/modules/payments/bank-directory.service.js";
import { PaystackService } from "../dist/src/modules/payments/paystack.service.js";

process.env.PAYSTACK_SECRET_KEY = "test-secret";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("bank directory follows Paystack cursors, filters inactive banks, and sorts names", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("next=page-2")) {
      return jsonResponse({
        status: true,
        message: "Banks retrieved",
        data: [
          { name: "Alpha Bank", code: "001", active: true, currency: "NGN" },
        ],
        meta: { next: null },
      });
    }
    return jsonResponse({
      status: true,
      message: "Banks retrieved",
      data: [
        { name: "Zulu Bank", code: "999", active: true, currency: "NGN" },
        { name: "Old Bank", code: "000", active: false, currency: "NGN" },
      ],
      meta: { next: "page-2" },
    });
  };

  try {
    const banks = await new PaystackService().listBanks();
    assert.deepEqual(
      banks.map((bank) => bank.name),
      ["Alpha Bank", "Zulu Bank"],
    );
    assert.equal(requests.length, 2);
    assert.match(requests[1], /next=page-2/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("account resolution returns the provider name and surfaces invalid details as a client error", async () => {
  const originalFetch = globalThis.fetch;
  const service = new PaystackService();
  globalThis.fetch = async () =>
    jsonResponse({
      status: true,
      message: "Account number resolved",
      data: { account_number: "0123456789", account_name: "STAYNEX HOST" },
    });
  try {
    assert.deepEqual(await service.resolveBankAccount("0123456789", "058"), {
      accountNumber: "0123456789",
      accountName: "STAYNEX HOST",
    });

    globalThis.fetch = async () =>
      jsonResponse(
        { status: false, message: "Could not resolve account name" },
        422,
      );
    await assert.rejects(
      () => service.resolveBankAccount("0000000000", "058"),
      (error) => error instanceof BadRequestException,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function mockBankDirectoryPrisma(overrides = {}) {
  const originals = {
    findMany: prisma.bankDirectoryEntry.findMany,
    deleteMany: prisma.bankDirectoryEntry.deleteMany,
    createMany: prisma.bankDirectoryEntry.createMany,
    transaction: prisma.$transaction,
  };
  const calls = { transactions: [], createdRows: [] };

  prisma.bankDirectoryEntry.findMany = overrides.findMany ?? (async () => []);
  prisma.bankDirectoryEntry.deleteMany = async () => ({ count: 0 });
  prisma.bankDirectoryEntry.createMany = async (args) => {
    calls.createdRows.push(...args.data);
    return { count: args.data.length };
  };
  prisma.$transaction = async (operations) => {
    calls.transactions.push(operations);
    if (overrides.transactionError) throw overrides.transactionError;
    assert.ok(
      Array.isArray(operations),
      "cache sync must use a sequential transaction",
    );
    return Promise.all(operations);
  };

  return {
    calls,
    restore() {
      prisma.bankDirectoryEntry.findMany = originals.findMany;
      prisma.bankDirectoryEntry.deleteMany = originals.deleteMany;
      prisma.bankDirectoryEntry.createMany = originals.createMany;
      prisma.$transaction = originals.transaction;
    },
  };
}

const providerBanks = [
  { code: "001", name: "Alpha Bank", currency: "NGN", type: "nuban" },
  { code: "999", name: "Zulu Bank", currency: "NGN", type: "nuban" },
];

test("bank cache sync uses a non-interactive bulk snapshot transaction", async () => {
  const database = mockBankDirectoryPrisma();
  const service = new BankDirectoryService({
    listBanks: async () => providerBanks,
  });

  try {
    const result = await service.list();
    assert.equal(result.source, "paystack");
    assert.deepEqual(
      result.banks.map((bank) => bank.code),
      ["001", "999"],
    );
    assert.equal(database.calls.transactions.length, 1);
    assert.equal(database.calls.transactions[0].length, 2);
    assert.deepEqual(
      database.calls.createdRows.map((bank) => bank.code),
      ["001", "999"],
    );
  } finally {
    database.restore();
  }
});

test("concurrent cold-cache requests share one Paystack refresh", async () => {
  const database = mockBankDirectoryPrisma();
  let providerCalls = 0;
  let releaseProvider;
  const providerResponse = new Promise((resolve) => {
    releaseProvider = resolve;
  });
  const service = new BankDirectoryService({
    listBanks: async () => {
      providerCalls += 1;
      return providerResponse;
    },
  });

  try {
    const first = service.list();
    const second = service.list();
    await new Promise((resolve) => setImmediate(resolve));

    const callsBeforeRelease = providerCalls;
    releaseProvider(providerBanks);
    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.equal(callsBeforeRelease, 1);
    assert.deepEqual(firstResult, secondResult);
    assert.equal(database.calls.transactions.length, 1);
  } finally {
    database.restore();
  }
});

test("valid Paystack data remains available when the fallback cache cannot be written", async () => {
  const database = mockBankDirectoryPrisma({
    findMany: async () => {
      throw new Error("database unavailable");
    },
    transactionError: new Error("cache write failed"),
  });
  const service = new BankDirectoryService({
    listBanks: async () => providerBanks,
  });

  try {
    const result = await service.list();
    assert.equal(result.source, "paystack");
    assert.equal(result.banks.length, 2);
  } finally {
    database.restore();
  }
});

test("stale cache remains available when Paystack cannot refresh", async () => {
  const lastSyncedAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const database = mockBankDirectoryPrisma({
    findMany: async () => [{ code: "001", name: "Alpha Bank", lastSyncedAt }],
  });
  const service = new BankDirectoryService({
    listBanks: async () => {
      throw new ServiceUnavailableException("provider unavailable");
    },
  });

  try {
    const result = await service.list();
    assert.equal(result.source, "cache");
    assert.equal(result.refreshedAt, lastSyncedAt.toISOString());
    assert.deepEqual(result.banks, [
      { code: "001", name: "Alpha Bank", provider: "paystack" },
    ]);
  } finally {
    database.restore();
  }
});
