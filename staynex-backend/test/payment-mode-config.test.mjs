import assert from "node:assert/strict";
import test from "node:test";
import { loadEnv } from "../dist/config/env.js";

const CONFIG_MODULE = "../dist/src/modules/payments/payment-config.service.js";

function baseEnv(overrides = {}) {
  return {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://user:password@localhost:26257/staynex?schema=public",
    PAYMENT_ENABLED: "false",
    PAYMENT_DEFAULT_PROVIDER: "paystack",
    PAYSTACK_TEST_SECRET_KEY: "sk_test_example",
    ...overrides,
  };
}

async function configModule() {
  try {
    return await import(CONFIG_MODULE);
  } catch {
    return null;
  }
}

test("PAYMENT_ENABLED=false selects provider TEST mode and test credentials", async () => {
  const module = await configModule();
  assert.ok(module, "payment configuration module must exist");
  const runtime = module.resolvePaymentRuntime(loadEnv(baseEnv()));

  assert.equal(runtime.enabled, false);
  assert.equal(runtime.mode, "TEST");
  assert.equal(runtime.defaultProvider, "paystack");
  assert.equal(runtime.providers.paystack.configured, true);
  assert.equal(runtime.providers.paystack.secretKey, "sk_test_example");
});

test("PAYMENT_ENABLED=true selects provider LIVE mode and live credentials", async () => {
  const module = await configModule();
  assert.ok(module, "payment configuration module must exist");
  const runtime = module.resolvePaymentRuntime(
    loadEnv(
      baseEnv({
        PAYMENT_ENABLED: "true",
        PAYSTACK_TEST_SECRET_KEY: undefined,
        PAYSTACK_LIVE_SECRET_KEY: "sk_live_example",
      }),
    ),
  );

  assert.equal(runtime.enabled, true);
  assert.equal(runtime.mode, "LIVE");
  assert.equal(runtime.providers.paystack.secretKey, "sk_live_example");
});

test("test mode rejects a live Paystack credential in the test slot", async () => {
  const module = await configModule();
  assert.ok(module, "payment configuration module must exist");

  assert.throws(
    () =>
      module.resolvePaymentRuntime(
        loadEnv(baseEnv({ PAYSTACK_TEST_SECRET_KEY: "sk_live_wrong_slot" })),
      ),
    /PAYSTACK_TEST_SECRET_KEY must be a test credential/,
  );
});

test("live mode rejects a test Paystack credential in the live slot", async () => {
  const module = await configModule();
  assert.ok(module, "payment configuration module must exist");

  assert.throws(
    () =>
      module.resolvePaymentRuntime(
        loadEnv(
          baseEnv({
            PAYMENT_ENABLED: "true",
            PAYSTACK_TEST_SECRET_KEY: undefined,
            PAYSTACK_LIVE_SECRET_KEY: "sk_test_wrong_slot",
          }),
        ),
      ),
    /PAYSTACK_LIVE_SECRET_KEY must be a live credential/,
  );
});

test("payment booleans are strict and reject ambiguous values", () => {
  for (const value of ["1", "yes", "on", "TRUE", "disabled"]) {
    assert.throws(
      () => loadEnv(baseEnv({ PAYMENT_ENABLED: value })),
      /PAYMENT_ENABLED/,
      `PAYMENT_ENABLED=${value} must not be coerced`,
    );
  }
});

test("enabled OPay rejects an incomplete selected-mode credential set", async () => {
  const module = await configModule();
  assert.ok(module, "payment configuration module must exist");

  assert.throws(
    () =>
      module.resolvePaymentRuntime(
        loadEnv(
          baseEnv({
            OPAY_ENABLED: "true",
            OPAY_TEST_MERCHANT_ID: "merchant-test",
            OPAY_TEST_PUBLIC_KEY: "public-test",
          }),
        ),
      ),
    /OPay TEST configuration is incomplete/,
  );
});

test("rollout percentage is an integer from zero through one hundred", () => {
  for (const value of ["-1", "12.5", "101", "not-a-number"]) {
    assert.throws(
      () => loadEnv(baseEnv({ PAYMENT_OPAY_ROLLOUT_PERCENT: value })),
      /PAYMENT_OPAY_ROLLOUT_PERCENT/,
    );
  }
});
