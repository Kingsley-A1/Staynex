const test = require("node:test");
const assert = require("node:assert/strict");
const { appOrigin, cases } = require("./email-template-fixtures.cjs");

const expectedPrimaryTemplates = [
  "welcome", "password-reset", "admin-mfa", "booking-confirmed",
  "booking-refunded", "check-in-reminder", "payout-settled", "payout-failed",
  "property-auto-review-scheduled", "property-review-needs-changes",
  "property-published", "property-approved", "property-changes-requested",
  "property-rejected",
];

test("preview inventory includes every transactional template", () => {
  const names = new Set(cases.map((entry) => entry.name));
  assert.deepEqual(expectedPrimaryTemplates.filter((name) => !names.has(name)), []);
});

for (const preview of cases) {
  test(`${preview.name} returns a complete, branded, safe multipart email`, () => {
    const output = preview.render();
    assert.ok(output.subject.trim());
    assert.match(output.html, /^<!doctype html>/i);
    assert.match(output.html, /<div style="display:none;/);
    assert.match(output.html, /<h1\b/);
    assert.match(output.html, /Staynex Bookings/);
    assert.match(output.html, /max-width:680px/);
    assert.match(output.html, /border-radius:6px/);
    assert.doesNotMatch(output.html, /max-width:600px|border-radius:12px/);
    assert.match(output.html, /Book trusted stays, confidently\./);
    assert.ok(output.text.trim());
    assert.match(output.text, /Staynex Bookings/);
    assert.match(output.text, /Book trusted stays, confidently\./);
    assert.doesNotMatch(`${output.subject}${output.html}${output.text}`, /\b(?:undefined|null)\b/);
    assert.doesNotMatch(output.text, /<\/?[a-z][^>]*>/i);
    assert.doesNotMatch(output.html, /<script|onerror\s*=/i);
    for (const match of output.html.matchAll(/href="([^"]+)"/g)) {
      if (match[1].startsWith("mailto:")) continue;
      const url = new URL(match[1].replace(/&amp;/g, "&"));
      assert.equal(url.origin, appOrigin);
    }
  });
}

test("security code templates use supplied code and exact expiry", () => {
  const reset = cases.find((entry) => entry.name === "password-reset").render();
  const mfa = cases.find((entry) => entry.name === "admin-mfa").render();
  assert.match(reset.html, /042731/);
  assert.match(reset.text, /15 minutes/);
  assert.match(mfa.html, /981204/);
  assert.match(mfa.text, /10 minutes/);
});

test("database-controlled strings and attempted markup are HTML-escaped", () => {
  for (const name of ["booking-confirmed", "booking-refunded", "check-in-reminder", "payout-settled", "payout-failed", "property-review-needs-changes", "property-approved", "property-changes-requested", "property-rejected"]) {
    const output = cases.find((entry) => entry.name === name).render();
    assert.match(output.html, /&lt;/);
    assert.match(output.html, /&amp;/);
    assert.doesNotMatch(output.html, /<script/i);
  }
});

test("booking confirmation renders verified details and conditional voucher copy", () => {
  const complete = cases.find((entry) => entry.name === "booking-confirmed").render();
  const noVoucher = cases.find((entry) => entry.name === "booking-confirmed-no-voucher").render();
  for (const value of ["Calabar", "Suite", "20 August 2026", "23 August 2026", "3 nights", "PAY"])
    assert.match(complete.text, new RegExp(value));
  assert.match(complete.text, /Amount paid:/);
  assert.match(complete.text, /PDF is attached/);
  assert.doesNotMatch(noVoucher.text, /attached|voucher|QR code/i);
});

test("optional notes and rows are omitted cleanly", () => {
  assert.doesNotMatch(cases.find((entry) => entry.name === "payout-settled-minimal").render().html, /Settlement note|Destination/);
  assert.doesNotMatch(cases.find((entry) => entry.name === "payout-failed-no-reason").render().html, />Reason</);
  assert.doesNotMatch(cases.find((entry) => entry.name === "property-approved-no-note").render().html, /Reviewer note/);
  assert.doesNotMatch(cases.find((entry) => entry.name === "booking-refunded-no-reference").render().html, /View payment status|>Reference</);
});

test("refund and payout copy makes no unsupported timing promise", () => {
  for (const name of ["booking-refunded", "payout-settled", "payout-failed"]) {
    const output = cases.find((entry) => entry.name === name).render();
    assert.doesNotMatch(`${output.html}${output.text}`, /within \d+|business days|definitely|guaranteed|today/i);
  }
});
