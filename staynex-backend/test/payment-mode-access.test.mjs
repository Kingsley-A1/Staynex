import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { loadEnv } from "../dist/config/env.js";
import { BookingsController } from "../dist/src/modules/bookings/bookings.controller.js";
import { resolvePaymentRuntime } from "../dist/src/modules/payments/payment-config.service.js";

function runtimeConfig({ enabled }) {
  const runtime = resolvePaymentRuntime(
    loadEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:password@localhost:26257/staynex?schema=public",
      PAYMENT_ENABLED: enabled ? "true" : "false",
      PAYSTACK_TEST_SECRET_KEY: "sk_test_access",
      PAYSTACK_LIVE_SECRET_KEY: "sk_live_access",
    }),
  );
  return { current: () => runtime };
}

function user(capabilities) {
  return {
    id: "user-1",
    email: "manager@example.com",
    name: "Manager",
    role: capabilities.includes("ADMIN_MANAGER") ? "ADMIN_MANAGER" : "GUEST",
    capabilities,
  };
}

function controller(enabled) {
  const calls = [];
  const bookings = {
    checkout: async (input, userId) => {
      calls.push({ input, userId });
      return { bookingId: "booking-1" };
    },
  };
  return {
    calls,
    controller: new BookingsController(
      bookings,
      {},
      runtimeConfig({ enabled }),
    ),
  };
}

test("production TEST checkout rejects a non-manager before creating payment state", async () => {
  const harness = controller(false);

  await assert.rejects(
    () =>
      harness.controller.checkout(user(["GUEST"]), {
        holdId: "hold-1",
        email: "guest@example.com",
      }),
    (error) =>
      error instanceof ForbiddenException &&
      /restricted to authorised Staynex managers/.test(error.message),
  );
  assert.equal(harness.calls.length, 0);
});

test("production TEST checkout permits ADMIN_MANAGER for sandbox acceptance", async () => {
  const harness = controller(false);

  await harness.controller.checkout(user(["ADMIN_MANAGER"]), {
    holdId: "hold-1",
    email: "manager@example.com",
  });

  assert.equal(harness.calls.length, 1);
});

test("production LIVE checkout remains available to an authenticated guest", async () => {
  const harness = controller(true);

  await harness.controller.checkout(user(["GUEST"]), {
    holdId: "hold-1",
    email: "guest@example.com",
  });

  assert.equal(harness.calls.length, 1);
});
