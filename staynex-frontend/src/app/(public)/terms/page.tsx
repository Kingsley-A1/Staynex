import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/features/legal/legal-page";

export const metadata: Metadata = { title: "Terms — Staynex" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      intro="A plain-language summary of how Staynex works during this proof-of-concept."
    >
      <LegalSection heading="Using Staynex">
        <p>
          You may search stays without an account. An account is required at checkout, just before
          payment, so we can attach your booking and send your confirmation.
        </p>
      </LegalSection>
      <LegalSection heading="Bookings and payments">
        <p>
          A booking is held briefly while you pay and is only confirmed after your payment is verified.
          Holds expire if payment isn't completed in time.
        </p>
      </LegalSection>
      <LegalSection heading="Reviews">
        <p>
          You can review a stay only from a confirmed booking. Reviews are checked before they appear
          publicly.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
