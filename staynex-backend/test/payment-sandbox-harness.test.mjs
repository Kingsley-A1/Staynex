import assert from "node:assert/strict";
import test from "node:test";

let preflightModule;
let acceptanceModule;

try {
  preflightModule = await import("../scripts/payment-sandbox-preflight.mjs");
  acceptanceModule = await import("../scripts/payment-sandbox-acceptance.mjs");
} catch {
  // Assertions retain the intended RED state until the harness exists.
}

function safeTestEnv(overrides = {}) {
  return {
    PAYMENT_ENABLED: "false",
    PAYMENT_DEFAULT_PROVIDER: "paystack",
    PAYMENT_OPAY_ROLLOUT_PERCENT: "0",
    PAYSTACK_TEST_SECRET_KEY: "sk_test_sensitive",
    NEXT_PUBLIC_APP_URL: "https://sandbox-callback.example.com",
    DATABASE_URL:
      "postgresql://user:password@localhost:26257/staynex?schema=public",
    ...overrides,
  };
}

test("sandbox preflight reports variable presence without values", () => {
  assert.ok(preflightModule, "sandbox preflight module must exist");
  const output = preflightModule.runPreflight(safeTestEnv());
  assert.match(output, /PAYSTACK_TEST_SECRET_KEY: present/);
  assert.doesNotMatch(output, /sk_test_sensitive/);
  assert.doesNotMatch(output, /postgresql:\/\//);
});

test("sandbox preflight refuses live mode and live credentials in test slots", () => {
  for (const env of [
    safeTestEnv({ PAYMENT_ENABLED: "true" }),
    safeTestEnv({ PAYSTACK_TEST_SECRET_KEY: "sk_live_wrong_slot" }),
  ]) {
    const result = preflightModule.inspectPreflight(env, {
      requiredProviders: ["paystack"],
    });
    assert.equal(result.ok, false);
  }
});

test("sandbox preflight requires an explicit false payment mode", () => {
  const env = safeTestEnv();
  delete env.PAYMENT_ENABLED;
  const result = preflightModule.inspectPreflight(env, {
    requiredProviders: ["paystack"],
  });
  assert.equal(result.ok, false);
  assert.match(result.output, /PAYMENT_ENABLED: must be explicitly false/);
});

test("sandbox preflight explains how to migrate a legacy Paystack test slot", () => {
  const result = preflightModule.inspectPreflight(
    safeTestEnv({
      PAYSTACK_TEST_SECRET_KEY: undefined,
      PAYSTACK_SECRET_KEY: "sk_test_legacy_sensitive",
    }),
    { requiredProviders: ["paystack"] },
  );
  assert.equal(result.ok, false);
  assert.match(result.output, /legacy PAYSTACK_SECRET_KEY is present/);
  assert.doesNotMatch(result.output, /sk_test_legacy_sensitive/);
});

test("sandbox preflight rejects incomplete OPay contract inputs", () => {
  const result = preflightModule.inspectPreflight(
    safeTestEnv({
      OPAY_ENABLED: "true",
      OPAY_TEST_MERCHANT_ID: "merchant-present",
      OPAY_TEST_PUBLIC_KEY: "public-present",
    }),
    { requiredProviders: ["paystack", "opay"] },
  );
  assert.equal(result.ok, false);
  assert.match(result.output, /OPAY_TEST_SECRET_KEY: missing/);
  assert.doesNotMatch(result.output, /merchant-present|public-present/);
});

test("acceptance evaluation proves test binding, one transition, replay, zero payout, and inventory neutrality", () => {
  assert.ok(acceptanceModule, "sandbox acceptance module must exist");
  const reference = "stx_sandbox_sensitive_reference";
  const result = acceptanceModule.evaluateAcceptance({
    provider: "paystack",
    reference,
    expected: "success",
    verified: [
      {
        status: "success",
        reference,
        providerReference: null,
        amountKobo: 100_000,
        currency: "NGN",
      },
      {
        status: "success",
        reference,
        providerReference: null,
        amountKobo: 100_000,
        currency: "NGN",
      },
    ],
    evidence: {
      payment: {
        provider: "paystack",
        mode: "TEST",
        status: "SUCCESS",
        grossAmountKobo: 100_000,
        currency: "NGN",
        providerReference: null,
        bookingStatus: "CONFIRMED",
        payoutCount: 0,
      },
      events: [
        {
          provider: "paystack",
          mode: "TEST",
          eventType: "charge.success",
          outcome: "CONFIRMED",
        },
        {
          provider: "paystack",
          mode: "TEST",
          eventType: "charge.success",
          outcome: "DUPLICATE",
        },
      ],
      inventory: [
        { bookedUnits: 2, expectedLiveBookedUnits: 2 },
        { bookedUnits: 1, expectedLiveBookedUnits: 1 },
      ],
    },
  });

  assert.equal(result.ok, true);
  assert.match(result.output, /PASS: provider_binding/);
  assert.match(result.output, /PASS: replay_idempotency/);
  assert.match(result.output, /PASS: zero_payout/);
  assert.match(result.output, /PASS: inventory_neutrality/);
  assert.doesNotMatch(result.output, new RegExp(reference));
});

test("acceptance fails when a test transaction creates a payout or changes live inventory", () => {
  const reference = "stx_sandbox_failure_reference";
  const result = acceptanceModule.evaluateAcceptance({
    provider: "opay",
    reference,
    expected: "success",
    verified: [
      {
        status: "success",
        reference,
        providerReference: "provider-1",
        amountKobo: 50_000,
        currency: "NGN",
      },
      {
        status: "success",
        reference,
        providerReference: "provider-1",
        amountKobo: 50_000,
        currency: "NGN",
      },
    ],
    evidence: {
      payment: {
        provider: "opay",
        mode: "TEST",
        status: "SUCCESS",
        grossAmountKobo: 50_000,
        currency: "NGN",
        providerReference: "provider-1",
        bookingStatus: "CONFIRMED",
        payoutCount: 1,
      },
      events: [
        {
          provider: "opay",
          mode: "TEST",
          eventType: "SUCCESS",
          outcome: "CONFIRMED",
        },
        {
          provider: "opay",
          mode: "TEST",
          eventType: "SUCCESS",
          outcome: "DUPLICATE",
        },
      ],
      inventory: [{ bookedUnits: 1, expectedLiveBookedUnits: 0 }],
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.output, /FAIL: zero_payout/);
  assert.match(result.output, /FAIL: inventory_neutrality/);
});

test("refund acceptance requires a replayed signed refund transition, not an admin update", () => {
  const reference = "stx_sandbox_refund_reference";
  const result = acceptanceModule.evaluateAcceptance({
    provider: "paystack",
    reference,
    expected: "refunded",
    verified: [
      {
        status: "success",
        reference,
        providerReference: "provider-2",
        amountKobo: 75_000,
        currency: "NGN",
      },
      {
        status: "success",
        reference,
        providerReference: "provider-2",
        amountKobo: 75_000,
        currency: "NGN",
      },
    ],
    evidence: {
      payment: {
        provider: "paystack",
        mode: "TEST",
        status: "REFUNDED",
        grossAmountKobo: 75_000,
        currency: "NGN",
        providerReference: "provider-2",
        bookingStatus: "CANCELLED",
        payoutCount: 0,
      },
      events: [
        {
          provider: "paystack",
          mode: "TEST",
          eventType: "charge.success",
          outcome: "CONFIRMED",
        },
        {
          provider: "paystack",
          mode: "TEST",
          eventType: "admin.refund",
          outcome: "REFUNDED",
        },
      ],
      inventory: [{ bookedUnits: 0, expectedLiveBookedUnits: 0 }],
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.output, /FAIL: replay_idempotency/);
  assert.match(result.output, /FAIL: signed_webhook_evidence/);
});
