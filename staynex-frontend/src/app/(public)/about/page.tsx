import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/features/legal/legal-page";

export const metadata: Metadata = {
  title: "About — Staynex",
  description: "Staynex helps guests book trusted stays, confidently.",
};

export default function AboutPage() {
  return (
    <LegalPage
      title="About Staynex"
      intro="Staynex helps guests book trusted stays clearly and gives property owners a reliable digital channel for visibility, availability, bookings, and growth."
    >
      <LegalSection heading="Our promise">
        <p>
          Book trusted stays. Every property is reviewed and approved before it goes live, payments
          run through Paystack, and a booking is only confirmed after payment is verified.
        </p>
      </LegalSection>
      <LegalSection heading="Launched in Calabar, scaling beyond">
        <p>
          We launched in Calabar and are designed to expand across Nigeria and beyond — starting with
          Calabar, Uyo, Port Harcourt, Lagos, and Abuja.
        </p>
      </LegalSection>
      <LegalSection heading="For property owners">
        <p>
          List your property, manage availability and rooms, and receive bookings and earnings from
          one dashboard.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
