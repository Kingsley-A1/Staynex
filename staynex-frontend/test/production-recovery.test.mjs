import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("production catalog and host loaders never import fixture data", async () => {
  for (const file of ["server-catalog.ts", "server-host.ts"]) {
    const code = await source(`../src/lib/${file}`);
    assert.doesNotMatch(code, /features\/properties\/fixtures/);
    assert.match(code, /status: "unavailable"/);
  }
});

test("catalog pages distinguish empty results from an unavailable service", async () => {
  const [search, stay] = await Promise.all([
    source("../src/app/(public)/search/page.tsx"),
    source("../src/app/(public)/stays/[slug]/page.tsx"),
  ]);

  assert.match(search, /result\.status === "unavailable"/);
  assert.match(search, /<RecoveryNotice/);
  assert.doesNotMatch(search, /Showing sample data/);
  assert.match(stay, /result\.status === "unavailable"/);
  assert.match(stay, /<RecoveryNotice/);
  assert.match(stay, /result\.status === "not_found"/);
  assert.ok(
    stay.indexOf('result.status === "data"') < stay.indexOf("<BookingWidget"),
    "booking controls must be downstream of authoritative property data",
  );
});

test("payment and property recovery gives a reason and retry or return action", async () => {
  const [recovery, propertyForm, checkout, paymentStatus] = await Promise.all([
    source("../src/components/recovery-notice.tsx"),
    source("../src/features/properties/property-form.tsx"),
    source("../src/features/booking/checkout-client.tsx"),
    source("../src/features/booking/payment-status-client.tsx"),
  ]);

  assert.match(recovery, /reason/);
  assert.match(recovery, /retryLabel/);
  assert.match(recovery, /onRetry/);
  assert.match(recovery, /secondaryAction/);
  assert.match(propertyForm, /citiesAvailable/);
  assert.match(propertyForm, /disabled=\{pending \|\| !citiesAvailable\}/);
  assert.match(checkout, /<RecoveryNotice/);
  assert.match(paymentStatus, /<RecoveryNotice/);
});

test("host dashboards do not turn unavailable data into fixtures or empty state", async () => {
  const [dashboard, properties, newProperty] = await Promise.all([
    source("../src/app/(host)/host/dashboard/page.tsx"),
    source("../src/app/(host)/host/properties/page.tsx"),
    source("../src/app/(host)/host/properties/new/page.tsx"),
  ]);

  assert.doesNotMatch(dashboard, /getOwnerKpis|fallback/);
  assert.match(dashboard, /propertiesResult\.status === "unavailable"/);
  assert.match(properties, /result\.status === "unavailable"/);
  assert.match(newProperty, /citiesAvailable=\{result\.status === "data"\}/);
});

test("touched auth, property, and payment paths contain no generic failure copy", async () => {
  const sources = await Promise.all([
    source("../src/features/auth/auth-form.tsx"),
    source("../src/features/properties/property-form.tsx"),
    source("../src/features/booking/checkout-client.tsx"),
    source("../src/features/booking/payment-status-client.tsx"),
  ]);
  assert.doesNotMatch(sources.join("\n"), /Something went wrong/i);
});
