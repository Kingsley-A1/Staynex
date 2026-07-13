import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
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
