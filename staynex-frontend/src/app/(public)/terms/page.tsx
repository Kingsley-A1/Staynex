import type { Metadata } from "next";
import {
  GradientText,
  LegalPage,
  LegalSection,
} from "@/features/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Use | Staynex",
  description:
    "Read Staynex terms for accounts, bookings, payments, guest responsibilities, owner responsibilities, cancellations, and acceptable use.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Use | Staynex",
    description:
      "The rules for using Staynex as a guest, property owner, or platform user.",
    url: "/terms",
  },
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="The rules for"
      gradientText="using Staynex"
      intro="These terms explain the practical agreement between Staynex, guests, property owners, and other users of the platform."
    >
      <LegalSection heading="Accepting these terms">
        <p>
          By creating an account, listing a property, making a booking,
          submitting a review, or using Staynex, you agree to use the platform
          lawfully and in line with these terms and any booking-specific policy
          shown during checkout.
        </p>
      </LegalSection>

      <LegalSection heading="Accounts">
        <p>
          You are responsible for the accuracy of your account information and
          for keeping your sign-in access secure. Staynex may restrict or
          suspend accounts involved in fraud, abuse, misleading activity,
          unauthorized access, or repeated policy violations.
        </p>
      </LegalSection>

      <LegalSection heading="Bookings and payments">
        <p>
          Prices, availability, fees, and booking terms are shown before
          checkout. A booking is not confirmed until payment is completed and
          verified. Staynex may cancel, reverse, or review transactions affected
          by payment failure, suspected fraud, duplicate bookings, or inventory
          conflicts.
        </p>
        <p>
          Payment processing is handled through{" "}
          <GradientText>secure third-party providers</GradientText>.
        </p>
      </LegalSection>

      <LegalSection heading="Guest responsibilities">
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide accurate guest, contact, and payment information.</li>
          <li>
            Follow property rules, occupancy limits, check-in instructions, and
            local laws.
          </li>
          <li>
            Report booking or stay issues promptly with relevant evidence.
          </li>
          <li>Use reviews honestly and respectfully.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Owner responsibilities">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Keep listings, prices, amenities, rooms, and availability accurate.
          </li>
          <li>
            Honor confirmed bookings and communicate operational issues quickly.
          </li>
          <li>Maintain safe, clean, and lawful accommodation standards.</li>
          <li>
            Provide payout and business information that is accurate and
            authorized.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Changes, limits, and contact">
        <p>
          Staynex may update these terms as the product, laws, payment flows, or
          operating model evolve. For questions about these terms, contact{" "}
          <a
            className="font-semibold text-primary"
            href="mailto:legal@staynexbookings.ng"
          >
            legal@staynexbookings.ng
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
