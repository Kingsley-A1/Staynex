import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/features/legal/legal-page";

export const metadata: Metadata = { title: "Policies — Staynex" };

export default function PoliciesPage() {
  return (
    <LegalPage
      title="Policies"
      intro="How availability, cancellations, and support work on Staynex today."
    >
      <LegalSection heading="Availability">
        <p>
          Availability is shown in real time from each property's calendar. We only mark a room as
          bookable when the backend verifies it — we never guarantee a date we can't confirm.
        </p>
      </LegalSection>
      <LegalSection heading="Cancellations and refunds">
        <p>
          Cancellation and refund terms vary by property. During this proof-of-concept, refund
          requests are handled by the Staynex support team rather than automatically.
        </p>
      </LegalSection>
      <LegalSection heading="Support">
        <p>
          Need help with a booking? Email{" "}
          <a className="font-medium text-primary" href="mailto:support@staynex.app">
            support@staynex.app
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
