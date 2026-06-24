import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/features/legal/legal-page";

export const metadata: Metadata = { title: "Legal — Staynex" };

export default function LegalPageRoute() {
  return (
    <LegalPage
      title="Legal"
      intro="Privacy, data, and payment handling at a glance."
    >
      <LegalSection heading="Your data">
        <p>
          We store the details needed to run your booking — your account, bookings, payments status,
          and any reviews you submit. We don't sell your data.
        </p>
      </LegalSection>
      <LegalSection heading="Payments">
        <p>
          Payments are processed by Paystack. Staynex never stores your raw card details. We record
          only the payment status and reference for your booking.
        </p>
      </LegalSection>
      <LegalSection heading="Contact">
        <p>
          For data or legal questions, email{" "}
          <a className="font-medium text-primary" href="mailto:legal@staynex.app">
            legal@staynex.app
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
