/**
 * Guards the two critical risks in the multi-provider payin design
 * (see `Opay-Integration.md` §3):
 *
 *  R1 — cross-provider verification. An operation on an existing payment must
 *       resolve its adapter from the persisted `Payment.provider` and must
 *       THROW on an unknown/unconfigured provider. A silent fallback would ask
 *       Paystack about an Opay reference, get "not found", and let the sync
 *       path cancel a booking the guest actually paid for.
 *
 *  R2 — minor-unit mismatch. Staynex is kobo-integer end to end; a 100x slip in
 *       the provider conversion silently flags real payments UNDERPAID or lets
 *       overpayments through.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";
import { PaymentProviderRegistry } from "../dist/src/modules/payments/payment-provider.registry.js";
import { PaystackProvider } from "../dist/src/modules/payments/paystack.provider.js";
import { PaystackService } from "../dist/src/modules/payments/paystack.service.js";
import {
  OpayProvider,
  fromProviderAmount,
  toProviderAmount,
} from "../dist/src/modules/payments/opay.provider.js";
import { isProviderName } from "../dist/src/modules/payments/payment-provider.port.js";

function buildRegistry() {
  return new PaymentProviderRegistry(
    new PaystackProvider(new PaystackService()),
    new OpayProvider(),
  );
}

/** Run `fn` with a temporary env, restoring whatever was there before. */
function withEnv(vars, fn) {
  const saved = new Map();
  for (const [key, value] of Object.entries(vars)) {
    saved.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const PAYSTACK_ONLY = {
  PAYSTACK_SECRET_KEY: "sk_test_paystack",
  OPAY_ENABLED: undefined,
  OPAY_MERCHANT_ID: undefined,
  OPAY_PUBLIC_KEY: undefined,
  OPAY_SECRET_KEY: undefined,
  PAYMENT_DEFAULT_PROVIDER: undefined,
  PAYMENT_OPAY_ROLLOUT_PERCENT: undefined,
};

const BOTH_ENABLED = {
  ...PAYSTACK_ONLY,
  OPAY_ENABLED: "true",
  OPAY_MERCHANT_ID: "merchant-1",
  OPAY_PUBLIC_KEY: "pk_test_opay",
  OPAY_SECRET_KEY: "sk_test_opay",
};

// --- R1: no silent fallback ------------------------------------------------

test("R1: an Opay payment is never verified against Paystack when Opay is unconfigured", () => {
  withEnv(PAYSTACK_ONLY, () => {
    const registry = buildRegistry();
    // This is the exact scenario that would cancel a paid booking.
    assert.throws(
      () => registry.get("opay"),
      ServiceUnavailableException,
      "resolving an unconfigured provider must throw, never fall back to Paystack",
    );
  });
});

test("R1: an unknown provider string throws instead of defaulting", () => {
  withEnv(PAYSTACK_ONLY, () => {
    const registry = buildRegistry();
    for (const value of ["stripe", "", "PAYSTACK", "flutterwave"]) {
      assert.throws(
        () => registry.get(value),
        ServiceUnavailableException,
        `provider '${value}' must not resolve`,
      );
    }
  });
});

test("R1: a null/undefined provider throws (legacy rows are not assumed Paystack)", () => {
  withEnv(PAYSTACK_ONLY, () => {
    const registry = buildRegistry();
    assert.throws(() => registry.get(null), ServiceUnavailableException);
    assert.throws(() => registry.get(undefined), ServiceUnavailableException);
  });
});

test("R1: a configured provider resolves to its own adapter, not the default", () => {
  withEnv(BOTH_ENABLED, () => {
    const registry = buildRegistry();
    assert.equal(registry.get("paystack").name, "paystack");
    assert.equal(registry.get("opay").name, "opay");
  });
});

// --- Registry / rollout behaviour ------------------------------------------

test("checkout defaults to Paystack and never selects a disabled Opay", () => {
  withEnv(
    { ...PAYSTACK_ONLY, PAYMENT_OPAY_ROLLOUT_PERCENT: "100" },
    () => {
      const registry = buildRegistry();
      assert.equal(registry.isEnabled("opay"), false);
      // Even at 100% rollout, an unconfigured Opay must never be selected.
      for (let i = 0; i < 200; i += 1) {
        assert.equal(registry.selectForCheckout(`stx_${i}`).name, "paystack");
      }
    },
  );
});

test("rollout at 0 keeps every new payment on Paystack even when Opay is live", () => {
  withEnv({ ...BOTH_ENABLED, PAYMENT_OPAY_ROLLOUT_PERCENT: "0" }, () => {
    const registry = buildRegistry();
    assert.equal(registry.isEnabled("opay"), true);
    for (let i = 0; i < 200; i += 1) {
      assert.equal(registry.selectForCheckout(`stx_${i}`).name, "paystack");
    }
  });
});

test("rollout selection is deterministic per reference", () => {
  withEnv({ ...BOTH_ENABLED, PAYMENT_OPAY_ROLLOUT_PERCENT: "50" }, () => {
    const registry = buildRegistry();
    const reference = "stx_deterministic_check";
    const first = registry.selectForCheckout(reference).name;
    for (let i = 0; i < 20; i += 1) {
      assert.equal(registry.selectForCheckout(reference).name, first);
    }
  });
});

test("rollout at 100 sends new payments to Opay once it is configured", () => {
  withEnv({ ...BOTH_ENABLED, PAYMENT_OPAY_ROLLOUT_PERCENT: "100" }, () => {
    const registry = buildRegistry();
    assert.equal(registry.selectForCheckout("stx_anything").name, "opay");
  });
});

test("with no provider configured, checkout fails loudly rather than silently", () => {
  withEnv(
    { ...PAYSTACK_ONLY, PAYSTACK_SECRET_KEY: undefined },
    () => {
      const registry = buildRegistry();
      assert.deepEqual(registry.configured(), []);
      assert.throws(() => registry.default(), ServiceUnavailableException);
    },
  );
});

// --- R2: kobo conversion ---------------------------------------------------

test("R2: kobo survives a provider round trip exactly, across realistic prices", () => {
  // ₦100 to ₦10,000,000 in kobo, plus awkward non-round values.
  const cases = [10_000, 49_999, 100_000, 750_050, 5_000_000, 1_000_000_000];
  for (const kobo of cases) {
    assert.equal(
      fromProviderAmount(toProviderAmount(kobo)),
      kobo,
      `round trip must be exact for ${kobo} kobo`,
    );
  }
  // Exhaustive sweep over a smaller range catches off-by-100 scaling.
  for (let kobo = 0; kobo <= 20_000; kobo += 1) {
    assert.equal(fromProviderAmount(toProviderAmount(kobo)), kobo);
  }
});

test("R2: a non-integer kobo amount is refused rather than rounded", () => {
  assert.throws(() => toProviderAmount(1234.5), /non-integer/);
  assert.throws(() => toProviderAmount(-1), /non-integer/);
});

// --- Port helpers ----------------------------------------------------------

test("isProviderName accepts only the known providers", () => {
  assert.equal(isProviderName("paystack"), true);
  assert.equal(isProviderName("opay"), true);
  assert.equal(isProviderName("stripe"), false);
  assert.equal(isProviderName(null), false);
  assert.equal(isProviderName(undefined), false);
  assert.equal(isProviderName(42), false);
});

// --- Webhook authenticity (R3) ---------------------------------------------

test("R3: Opay webhook signature verification rejects tampering and bad keys", () => {
  withEnv(BOTH_ENABLED, () => {
    const opay = new OpayProvider();
    const body = Buffer.from(
      JSON.stringify({ payload: { reference: "stx_1", status: "SUCCESS" } }),
    );
    const valid = createHmac("sha512", "sk_test_opay")
      .update(body)
      .digest("hex");

    assert.equal(
      opay.verifySignature(body, { authorization: `Bearer ${valid}` }),
      true,
      "a correctly signed body must verify",
    );
    // Tampered body
    const tampered = Buffer.from(
      JSON.stringify({ payload: { reference: "stx_1", status: "FAILED" } }),
    );
    assert.equal(
      opay.verifySignature(tampered, { authorization: `Bearer ${valid}` }),
      false,
    );
    // Missing / empty signature
    assert.equal(opay.verifySignature(body, {}), false);
    assert.equal(opay.verifySignature(body, { authorization: "" }), false);
    assert.equal(opay.verifySignature(body, { authorization: "Bearer " }), false);
    // Wrong key
    const wrong = createHmac("sha512", "sk_wrong").update(body).digest("hex");
    assert.equal(
      opay.verifySignature(body, { authorization: `Bearer ${wrong}` }),
      false,
    );
  });
});

test("Opay maps unknown transaction statuses to pending, never to a terminal state", () => {
  withEnv(BOTH_ENABLED, () => {
    const opay = new OpayProvider();
    const parse = (status) =>
      opay.parseWebhook(
        Buffer.from(JSON.stringify({ payload: { reference: "stx_1", status } })),
      );

    assert.equal(parse("SUCCESS").kind, "charge.success");
    assert.equal(parse("FAILED").kind, "charge.failed");
    // An unrecognized status must NOT become charge.failed — that would
    // release the guest's held capacity on a payment we don't understand.
    assert.equal(parse("SOMETHING_NEW").kind, "other");
    assert.equal(parse("PENDING").kind, "other");
  });
});
