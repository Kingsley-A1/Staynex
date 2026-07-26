import type { Metadata } from "next";
import {
  GradientText,
  LegalPage,
  LegalSection,
} from "@/features/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy and Legal | Staynex",
  description:
    "Read how Staynex handles account data, booking records, payment references, service providers, and legal support requests.",
  alternates: { canonical: "/legal" },
  openGraph: {
    title: "Privacy and Legal | Staynex",
    description:
      "How Staynex handles guest data, payments, service providers, retention, and legal requests.",
    url: "/legal",
  },
};

export default function LegalPageRoute() {
  return (
    <LegalPage
      eyebrow="Privacy and legal"
      title="Clear rules for"
      gradientText="data and payments"
      intro="This page explains the core privacy, payment, and legal handling standards behind Staynex. It is written in plain language so guests and owners can understand how the platform operates."
    >
      <LegalSection heading="Information we collect">
        <p>
          We collect the information needed to run your account and booking
          activity, including your name, email address, phone number when
          provided, booking records, payment references, property information,
          uploaded media, support messages, and review submissions.
        </p>
      </LegalSection>

      <LegalSection heading="How we use information">
        <ul className="list-disc space-y-2 pl-5">
          <li>Create and secure guest, owner, and admin accounts.</li>
          <li>
            Process booking holds, confirmed bookings, reviews, and support
            requests.
          </li>
          <li>
            Help property owners manage rooms, availability, listings, and
            payouts.
          </li>
          <li>
            Protect the platform from fraud, abuse, unauthorized access, and
            operational errors.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Payments and card data">
        <p>
          Payments are processed by our{" "}
          <GradientText>licensed payment partners</GradientText> — currently
          Paystack, and Opay as it is enabled. You are told which partner is
          handling your payment before you are redirected to complete it.
          Staynex records payment status, references, booking amounts, platform
          fees, and settlement information, but does not store raw card numbers.
        </p>
      </LegalSection>

      <LegalSection heading="Service providers">
        <p>
          Staynex may use trusted infrastructure and product providers for
          hosting, database storage, media storage, email, payments, maps,
          analytics, and security monitoring. These providers are used only to
          operate and improve the service.
        </p>
      </LegalSection>

      <LegalSection heading="Retention and account rights">
        <p>
          We keep records while they are needed for bookings, support, financial
          reporting, dispute resolution, platform security, and legal
          compliance. You can request account support, correction, or deletion
          by contacting{" "}
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
