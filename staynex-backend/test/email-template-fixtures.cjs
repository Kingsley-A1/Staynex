const templates = require("../dist/src/modules/notifications/templates/index.js");

const appOrigin = "https://preview.staynex.test";
const malicious = `Marina <script>alert("x")</script> & 'Harbour' >`;
const commonProperty = {
  appOrigin,
  propertyId: "property/preview & unsafe",
  ownerName: `Ada <Owner> & "Host"`,
  propertyName: malicious,
};

const cases = [
  { name: "welcome", render: () => templates.renderWelcomeEmail({ appOrigin, name: `Ada <Admin> & Co` }) },
  { name: "welcome-minimal", render: () => templates.renderWelcomeEmail({ appOrigin }) },
  { name: "password-reset", render: () => templates.renderPasswordResetEmail({ appOrigin, name: malicious, code: "042731", expiresInMinutes: 15 }) },
  { name: "admin-mfa", render: () => templates.renderAdminMfaEmail({ appOrigin, name: malicious, code: "981204", expiresInMinutes: 10 }) },
  { name: "booking-confirmed", render: () => templates.renderBookingConfirmedEmail({ appOrigin, confirmed: true, paymentVerified: true, bookingId: "booking/preview", guestName: malicious, propertyName: malicious, city: `Calabar & <Cross River>`, locationDetail: `Marina "District"`, roomType: `Suite <script>`, checkIn: "2026-08-20T00:00:00.000Z", checkOut: "2026-08-23T00:00:00.000Z", guestCount: 2, paidAmountMinor: 24500000, currency: "NGN", reference: `PAY<&\"'123`, voucherAttached: true }) },
  { name: "booking-confirmed-no-voucher", render: () => templates.renderBookingConfirmedEmail({ appOrigin, confirmed: true, paymentVerified: true, bookingId: "booking-minimal", propertyName: "Marina Crest Hotel", city: "Calabar", roomType: "Deluxe Room", checkIn: "2026-08-20", checkOut: "2026-08-21", paidAmountMinor: 8500000, currency: "NGN", voucherAttached: false }) },
  { name: "booking-refunded", render: () => templates.renderBookingRefundedEmail({ appOrigin, refunded: true, guestName: malicious, propertyName: malicious, refundedAmountMinor: 8500000, currency: "NGN", reference: `REF<&\"'123` }) },
  { name: "booking-refunded-no-reference", render: () => templates.renderBookingRefundedEmail({ appOrigin, refunded: true, propertyName: "Duke Town Suites", refundedAmountMinor: 5000000, currency: "NGN" }) },
  { name: "check-in-reminder", render: () => templates.renderCheckInReminderEmail({ appOrigin, bookingId: "booking/preview", guestName: malicious, propertyName: malicious, city: "Calabar & environs", roomType: `Room <Deluxe>`, checkIn: "2026-08-20", reference: `REF<&\"'123`, hasVoucher: true }) },
  { name: "check-in-reminder-minimal", render: () => templates.renderCheckInReminderEmail({ appOrigin, bookingId: "booking-minimal", propertyName: "Harbor Nest Apartments", city: "Calabar", checkIn: "2026-08-20", hasVoucher: false }) },
  { name: "payout-settled", render: () => templates.renderPayoutSettledEmail({ appOrigin, settled: true, ownerName: malicious, propertyName: malicious, amountMinor: 12500000, currency: "NGN", destination: { bankName: `Safe <Bank> & Co`, accountNumberLast4: `12<4` }, settlementNote: `Settled <script>bad</script> & "quoted"` }) },
  { name: "payout-settled-minimal", render: () => templates.renderPayoutSettledEmail({ appOrigin, settled: true, propertyName: "Marina Crest Hotel", amountMinor: 12500000, currency: "NGN" }) },
  { name: "payout-failed", render: () => templates.renderPayoutFailedEmail({ appOrigin, failed: true, ownerName: malicious, propertyName: malicious, amountMinor: 12500000, currency: "NGN", failureReason: `Provider <raw> & "unsafe"` }) },
  { name: "payout-failed-no-reason", render: () => templates.renderPayoutFailedEmail({ appOrigin, failed: true, propertyName: "Marina Crest Hotel", amountMinor: 12500000, currency: "NGN" }) },
  { name: "property-auto-review-scheduled", render: () => templates.renderPropertyAutoReviewScheduledEmail({ ...commonProperty, scheduled: true, scheduledAt: "2026-08-20T10:30:00.000Z" }) },
  { name: "property-review-needs-changes", render: () => templates.renderPropertyReviewNeedsChangesEmail({ ...commonProperty, needsChanges: true, failedLabels: [`Description <script>`, `Images & pricing`] }) },
  { name: "property-review-needs-changes-minimal", render: () => templates.renderPropertyReviewNeedsChangesEmail({ ...commonProperty, needsChanges: true }) },
  { name: "property-published", render: () => templates.renderPropertyPublishedEmail({ ...commonProperty, published: true }) },
  { name: "property-approved", render: () => templates.renderPropertyApprovedEmail({ ...commonProperty, approved: true, reviewerNote: `Approved <script> & "note"` }) },
  { name: "property-approved-no-note", render: () => templates.renderPropertyApprovedEmail({ ...commonProperty, approved: true }) },
  { name: "property-changes-requested", render: () => templates.renderPropertyChangesRequestedEmail({ ...commonProperty, changesRequested: true, reviewerNote: `Fix <details> & "copy"` }) },
  { name: "property-changes-requested-no-note", render: () => templates.renderPropertyChangesRequestedEmail({ ...commonProperty, changesRequested: true }) },
  { name: "property-rejected", render: () => templates.renderPropertyRejectedEmail({ ...commonProperty, rejected: true, reviewerNote: `Rejected <reason> & "copy"` }) },
  { name: "property-rejected-no-note", render: () => templates.renderPropertyRejectedEmail({ ...commonProperty, rejected: true }) },
];

module.exports = { appOrigin, cases, malicious };
