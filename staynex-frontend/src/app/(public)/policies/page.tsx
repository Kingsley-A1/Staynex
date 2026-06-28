import type { Metadata } from "next";
import {
  GradientText,
  LegalPage,
  LegalSection,
} from "@/features/legal/legal-page";

export const metadata: Metadata = {
  title: "Booking Policies | Staynex",
  description:
    "Review Staynex booking, availability, cancellation, refund, review, support, and property-owner policies.",
  alternates: { canonical: "/policies" },
  openGraph: {
    title: "Booking Policies | Staynex",
    description:
      "Availability, cancellations, refunds, property standards, support, and review rules for Staynex bookings.",
    url: "/policies",
  },
};

export default function PoliciesPage() {
  return (
    <LegalPage
      eyebrow="Policies"
      title="Booking standards"
      gradientText="that protect both sides"
      intro="Staynex policies are designed to reduce uncertainty for guests while giving property owners clear operating expectations."
    >
      <LegalSection heading="Availability and booking holds">
        <p>
          Availability should reflect the rooms and dates a property can
          actually honor. A booking hold is temporary and becomes confirmed only
          after the backend verifies payment and availability. Expired holds may
          be released automatically.
        </p>
      </LegalSection>

      <LegalSection heading="Cancellations and refunds">
        <p>
          Cancellation terms may vary by property, rate, stay length, season,
          and payment status. Refund requests are reviewed against the displayed
          booking terms, payment provider status, property policy, and any
          operational issue reported by the guest or owner.
        </p>
        <p>
          Where a refund is approved, timing can depend on{" "}
          <GradientText>Paystack and bank processing windows</GradientText>.
        </p>
      </LegalSection>

      <LegalSection heading="Property standards">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Listings should use accurate names, locations, photos, prices, and
            amenity details.
          </li>
          <li>Owners should keep availability and room capacity up to date.</li>
          <li>
            Properties may be reviewed, paused, or removed if information is
            misleading.
          </li>
          <li>
            Owners are expected to honor confirmed bookings unless a safety
            issue prevents it.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Reviews">
        <p>
          Reviews should reflect real guest experience and may be moderated
          before publication. Staynex may remove reviews that are abusive,
          fraudulent, irrelevant, discriminatory, or tied to a booking that
          cannot be verified.
        </p>
      </LegalSection>

      <LegalSection heading="Support">
        <p>
          For booking help, payment questions, or stay issues, contact{" "}
          <a
            className="font-semibold text-primary"
            href="mailto:support@staynexbookings.ng"
          >
            support@staynexbookings.ng
          </a>
          . Include your booking reference, property name, stay dates, and a
          clear description of the issue so support can respond faster.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
