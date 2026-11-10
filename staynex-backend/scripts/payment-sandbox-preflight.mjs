import { pathToFileURL } from "node:url";

const REPORTED_VARIABLES = [
  "PAYMENT_ENABLED",
  "PAYMENT_DEFAULT_PROVIDER",
  "PAYMENT_OPAY_ROLLOUT_PERCENT",
  "PAYSTACK_TEST_SECRET_KEY",
  "PAYSTACK_TEST_PUBLIC_KEY",
  "OPAY_ENABLED",
  "OPAY_TEST_MERCHANT_ID",
  "OPAY_TEST_PUBLIC_KEY",
  "OPAY_TEST_SECRET_KEY",
  "OPAY_TEST_BASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "DATABASE_URL",
];

function present(source, name) {
  return typeof source[name] === "string" && source[name].trim().length > 0;
}

function strictBoolean(source, name, fallback) {
  if (!present(source, name)) return { valid: true, value: fallback };
  const value = source[name].trim();
  if (value === "true") return { valid: true, value: true };
  if (value === "false") return { valid: true, value: false };
  return { valid: false, value: fallback };
}

function issue(issues, variable, message) {
  issues.push(`${variable}: ${message}`);
}

export function inspectPreflight(
  source = process.env,
  { requiredProviders = ["paystack"] } = {},
) {
  const issues = [];
  const paymentEnabled = strictBoolean(source, "PAYMENT_ENABLED", false);
  const opayEnabled = strictBoolean(source, "OPAY_ENABLED", false);

  if (!present(source, "PAYMENT_ENABLED")) {
    issue(
      issues,
      "PAYMENT_ENABLED",
      "must be explicitly false for sandbox acceptance",
    );
  } else if (!paymentEnabled.valid) {
    issue(issues, "PAYMENT_ENABLED", "must be exactly true or false");
  } else if (paymentEnabled.value) {
    issue(
      issues,
      "PAYMENT_ENABLED",
      "must be false; sandbox acceptance refuses live payment mode",
    );
  }
  if (!opayEnabled.valid) {
    issue(issues, "OPAY_ENABLED", "must be exactly true or false");
  }

  if (!present(source, "DATABASE_URL")) {
    issue(
      issues,
      "DATABASE_URL",
      "is required to inspect sanitized local payment evidence",
    );
  }
  if (!present(source, "NEXT_PUBLIC_APP_URL")) {
    issue(
      issues,
      "NEXT_PUBLIC_APP_URL",
      "is required for the provider callback and webhook journey",
    );
  } else {
    try {
      const url = new URL(source.NEXT_PUBLIC_APP_URL);
      if (
        url.protocol !== "https:" ||
        /^(localhost|127\.0\.0\.1)$/i.test(url.hostname)
      ) {
        issue(
          issues,
          "NEXT_PUBLIC_APP_URL",
          "must be a provider-reachable HTTPS callback URL",
        );
      }
    } catch {
      issue(issues, "NEXT_PUBLIC_APP_URL", "must be a valid HTTPS URL");
    }
  }

  if (requiredProviders.includes("paystack")) {
    if (!present(source, "PAYSTACK_TEST_SECRET_KEY")) {
      issue(
        issues,
        "PAYSTACK_TEST_SECRET_KEY",
        present(source, "PAYSTACK_SECRET_KEY")
          ? "is required; legacy PAYSTACK_SECRET_KEY is present, so confirm it is a test credential and copy it into this mode-specific slot"
          : "is required for Paystack sandbox acceptance",
      );
    } else if (!source.PAYSTACK_TEST_SECRET_KEY.startsWith("sk_test_")) {
      issue(
        issues,
        "PAYSTACK_TEST_SECRET_KEY",
        "must be a test credential; live-looking credentials are refused",
      );
    }
    if (
      present(source, "PAYSTACK_TEST_PUBLIC_KEY") &&
      !source.PAYSTACK_TEST_PUBLIC_KEY.startsWith("pk_test_")
    ) {
      issue(
        issues,
        "PAYSTACK_TEST_PUBLIC_KEY",
        "must be a test credential; live-looking credentials are refused",
      );
    }
  }

  if (requiredProviders.includes("opay")) {
    if (!opayEnabled.value) {
      issue(
        issues,
        "OPAY_ENABLED",
        "must be true for explicit OPay sandbox acceptance",
      );
    }
    for (const name of [
      "OPAY_TEST_MERCHANT_ID",
      "OPAY_TEST_PUBLIC_KEY",
      "OPAY_TEST_SECRET_KEY",
      "OPAY_TEST_BASE_URL",
    ]) {
      if (!present(source, name)) {
        issue(issues, name, "is required for OPay sandbox acceptance");
      }
    }
    if (present(source, "OPAY_TEST_BASE_URL")) {
      try {
        const url = new URL(source.OPAY_TEST_BASE_URL);
        if (
          url.protocol !== "https:" ||
          /liveapi|production|prod\./i.test(url.hostname)
        ) {
          issue(
            issues,
            "OPAY_TEST_BASE_URL",
            "must identify an HTTPS sandbox endpoint, never a live endpoint",
          );
        }
      } catch {
        issue(issues, "OPAY_TEST_BASE_URL", "must be a valid HTTPS URL");
      }
    }
  }

  const rollout = Number(source.PAYMENT_OPAY_ROLLOUT_PERCENT ?? "0");
  if (!Number.isInteger(rollout) || rollout !== 0) {
    issue(
      issues,
      "PAYMENT_OPAY_ROLLOUT_PERCENT",
      "must remain 0 while sandbox acceptance is running",
    );
  }

  const presenceLines = REPORTED_VARIABLES.map(
    (name) => `${name}: ${present(source, name) ? "present" : "missing"}`,
  );
  const lines = [
    "Staynex payment sandbox preflight",
    "mode: TEST only",
    ...presenceLines,
    ...issues.map((entry) => `BLOCKED: ${entry}`),
    `RESULT: ${issues.length === 0 ? "PASS" : "FAIL"}`,
  ];

  return {
    ok: issues.length === 0,
    issues,
    output: lines.join("\n"),
  };
}

export function runPreflight(source = process.env, options) {
  return inspectPreflight(source, options).output;
}

async function main() {
  const result = inspectPreflight(process.env, {
    requiredProviders: ["paystack", "opay"],
  });
  process.stdout.write(`${result.output}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
