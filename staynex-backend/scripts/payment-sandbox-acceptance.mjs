import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { inspectPreflight } from "./payment-sandbox-preflight.mjs";

const EXPECTED_STATES = {
  success: {
    payment: "SUCCESS",
    booking: "CONFIRMED",
    outcome: ["CONFIRMED", "REVIVED"],
  },
  failed: {
    payment: "FAILED",
    booking: "CANCELLED",
    outcome: ["MARKED_FAILED"],
  },
  refunded: {
    payment: "REFUNDED",
    booking: "CANCELLED",
    outcome: ["REFUNDED"],
  },
};

function fingerprint(reference) {
  return createHash("sha256").update(reference).digest("hex").slice(0, 12);
}

function sameVerification(left, right) {
  return (
    left.status === right.status &&
    left.reference === right.reference &&
    left.providerReference === right.providerReference &&
    left.amountKobo === right.amountKobo &&
    left.currency === right.currency
  );
}

export function evaluateAcceptance({
  provider,
  reference,
  expected,
  verified,
  evidence,
  timestamp = new Date().toISOString(),
}) {
  const checks = [];
  const add = (name, pass, success, failure) => {
    checks.push({
      name,
      pass: Boolean(pass),
      detail: pass ? success : failure,
    });
  };
  const target = EXPECTED_STATES[expected];
  const payment = evidence?.payment;
  const events = evidence?.events ?? [];
  const inventory = evidence?.inventory ?? [];
  const first = verified?.[0];
  const second = verified?.[1];

  add(
    "provider_binding",
    payment?.provider === provider &&
      events.every((event) => event.provider === provider),
    "Local payment and audit evidence use the selected provider.",
    "Local payment or audit evidence is bound to a different provider.",
  );
  add(
    "test_mode",
    payment?.mode === "TEST" && events.every((event) => event.mode === "TEST"),
    "Payment and audit evidence are TEST-only.",
    "Live or missing mode evidence was found.",
  );
  add(
    "provider_verification",
    Boolean(
      first &&
      second &&
      sameVerification(first, second) &&
      first.reference === reference &&
      first.amountKobo === payment?.grossAmountKobo &&
      first.currency === payment?.currency &&
      (payment?.providerReference === null ||
        first.providerReference === payment?.providerReference) &&
      (expected !== "success" || first.status === "success") &&
      (expected !== "failed" || ["failed", "abandoned"].includes(first.status)),
    ),
    "Two provider checks returned stable, amount-exact evidence.",
    "Provider checks were unstable or did not match the local payment evidence.",
  );
  add(
    "local_state",
    Boolean(
      target &&
      payment?.status === target.payment &&
      payment?.bookingStatus === target.booking,
    ),
    `Local ${expected} payment and booking states are consistent.`,
    `Local payment or booking state does not match the ${expected} expectation.`,
  );

  const transitionEvents = target
    ? events.filter((event) => target.outcome.includes(event.outcome))
    : [];
  add(
    "one_time_transition",
    transitionEvents.length === 1,
    "Exactly one state-changing provider outcome was recorded.",
    "The state-changing provider outcome is missing or occurred more than once.",
  );
  const hasReplayEvidence =
    events.length >= 2 &&
    transitionEvents.length === 1 &&
    events.some((event) => event.outcome === "DUPLICATE");
  add(
    "replay_idempotency",
    hasReplayEvidence,
    "Repeated provider delivery left one state transition and replay evidence.",
    "Replay evidence is missing; resend the signed provider callback and retry.",
  );
  add(
    "signed_webhook_evidence",
    Boolean(
      target &&
      events.some(
        (event) =>
          event.eventType !== "sync.verify" &&
          event.eventType !== "admin.refund" &&
          event.provider === provider &&
          target.outcome.includes(event.outcome),
      ),
    ),
    "A provider-specific callback produced the expected signed transition.",
    "No provider-specific signed callback produced the expected transition.",
  );
  add(
    "zero_payout",
    payment?.payoutCount === 0,
    "The TEST transaction created no host payout.",
    "A TEST transaction created a payout and must not be accepted.",
  );
  add(
    "inventory_neutrality",
    inventory.length > 0 &&
      inventory.every((row) => row.bookedUnits === row.expectedLiveBookedUnits),
    "Live booked-unit counters equal LIVE confirmed booking truth.",
    "Live booked-unit counters changed or could not be proven neutral.",
  );

  const ok = checks.every((check) => check.pass);
  const lines = [
    "Staynex payment sandbox acceptance",
    `timestamp: ${timestamp}`,
    `provider: ${provider}`,
    `expected: ${expected}`,
    `reference_fingerprint: ${fingerprint(reference)}`,
    ...checks.map(
      (check) =>
        `${check.pass ? "PASS" : "FAIL"}: ${check.name} - ${check.detail}`,
    ),
    `RESULT: ${ok ? "PASS" : "FAIL"}`,
  ];
  return { ok, checks, output: lines.join("\n") };
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;
    values[key.slice(2)] = argv[index + 1];
    index += 1;
  }
  const provider = values.provider;
  const reference = values.reference;
  const expected = values.expect ?? "success";
  if (!["paystack", "opay"].includes(provider)) {
    throw new Error("--provider must be paystack or opay");
  }
  if (!reference || !reference.startsWith("stx_")) {
    throw new Error("--reference must be a Staynex transaction reference");
  }
  if (!Object.hasOwn(EXPECTED_STATES, expected)) {
    throw new Error("--expect must be success, failed, or refunded");
  }
  return { provider, reference, expected };
}

async function providerAdapter(provider) {
  const [configModule, paystackModule, paystackProviderModule, opayModule] =
    await Promise.all([
      import("../dist/src/modules/payments/payment-config.service.js"),
      import("../dist/src/modules/payments/paystack.service.js"),
      import("../dist/src/modules/payments/paystack.provider.js"),
      import("../dist/src/modules/payments/opay.provider.js"),
    ]);
  const config = new configModule.PaymentConfigService();
  return provider === "paystack"
    ? new paystackProviderModule.PaystackProvider(
        new paystackModule.PaystackService(config),
      )
    : new opayModule.OpayProvider(config);
}

async function loadEvidence(reference) {
  const { prisma } = await import("../dist/db/client.js");
  const payment = await prisma.payment.findUnique({
    where: { reference },
    select: {
      provider: true,
      mode: true,
      status: true,
      grossAmountKobo: true,
      currency: true,
      providerReference: true,
      payout: { select: { id: true } },
      booking: {
        select: {
          status: true,
          checkIn: true,
          checkOut: true,
          roomUnit: { select: { roomTypeId: true } },
        },
      },
    },
  });
  if (!payment) return { prisma, evidence: null };

  const [events, calendar] = await Promise.all([
    prisma.paymentEvent.findMany({
      where: { reference },
      orderBy: { createdAt: "asc" },
      select: {
        provider: true,
        mode: true,
        eventType: true,
        outcome: true,
      },
    }),
    prisma.availabilityCalendar.findMany({
      where: {
        roomTypeId: payment.booking.roomUnit.roomTypeId,
        date: { gte: payment.booking.checkIn, lt: payment.booking.checkOut },
      },
      orderBy: { date: "asc" },
      select: { date: true, bookedUnits: true },
    }),
  ]);
  const inventory = await Promise.all(
    calendar.map(async (row) => ({
      bookedUnits: row.bookedUnits,
      expectedLiveBookedUnits: await prisma.booking.count({
        where: {
          status: "CONFIRMED",
          checkIn: { lte: row.date },
          checkOut: { gt: row.date },
          roomUnit: { roomTypeId: payment.booking.roomUnit.roomTypeId },
          payment: { is: { mode: "LIVE", status: "SUCCESS" } },
        },
      }),
    })),
  );

  return {
    prisma,
    evidence: {
      payment: {
        provider: payment.provider,
        mode: payment.mode,
        status: payment.status,
        grossAmountKobo: payment.grossAmountKobo,
        currency: payment.currency,
        providerReference: payment.providerReference,
        bookingStatus: payment.booking.status,
        payoutCount: payment.payout ? 1 : 0,
      },
      events,
      inventory,
    },
  };
}

async function main() {
  let prisma;
  try {
    const args = parseArguments(process.argv.slice(2));
    const preflight = inspectPreflight(process.env, {
      requiredProviders: [args.provider],
    });
    if (!preflight.ok) {
      process.stdout.write(`${preflight.output}\n`);
      process.exitCode = 1;
      return;
    }
    const adapter = await providerAdapter(args.provider);
    const verified = await Promise.all([
      adapter.verifyTransaction(args.reference),
      adapter.verifyTransaction(args.reference),
    ]);
    const loaded = await loadEvidence(args.reference);
    prisma = loaded.prisma;
    if (!loaded.evidence) {
      process.stdout.write(
        "RESULT: FAIL\nFAIL: local_evidence - No local payment record matched the supplied reference.\n",
      );
      process.exitCode = 1;
      return;
    }
    const result = evaluateAcceptance({
      ...args,
      verified,
      evidence: loaded.evidence,
    });
    process.stdout.write(`${result.output}\n`);
    if (!result.ok) process.exitCode = 1;
  } catch {
    process.stdout.write(
      "RESULT: FAIL\nFAIL: acceptance_runtime - Provider verification or local evidence inspection failed. Check provider and API logs, then retry.\n",
    );
    process.exitCode = 1;
  } finally {
    await prisma?.$disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
