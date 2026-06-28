import type { Metadata } from "next";
import {
  GradientText,
  LegalPage,
  LegalSection,
} from "@/features/legal/legal-page";

export const metadata: Metadata = {
  title: "About Staynex | Verified stays in Nigeria",
  description:
    "Learn how Staynex helps guests book verified stays and gives property owners a reliable digital channel for availability, payments, and growth.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Staynex",
    description:
      "A trusted booking layer for verified stays, secure payments, and reliable property operations in Nigeria.",
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <LegalPage
      eyebrow="Company"
      title="A trusted booking layer"
      gradientText="for modern stays"
      intro="Staynex connects guests to verified hotels, apartments, resorts, and short-let spaces while giving property owners a cleaner way to manage visibility, availability, bookings, and revenue."
    >
      <LegalSection heading="What Staynex does">
        <p>
          Staynex is built around one job: help guests book trusted stays
          without guesswork. We combine reviewed property listings, real-time
          availability, secure checkout, and booking confirmation flows so the
          stay a guest sees is the stay they can actually reserve.
        </p>
        <p>
          The platform starts with Nigeria, with a practical focus on launch
          cities such as{" "}
          <GradientText>
            Calabar, Uyo, Port Harcourt, Lagos, and Abuja
          </GradientText>
          .
        </p>
      </LegalSection>

      <LegalSection heading="How we build trust">
        <ul className="list-disc space-y-2 pl-5">
          <li>Properties are reviewed before they appear publicly.</li>
          <li>Bookings are confirmed only after payment is verified.</li>
          <li>
            Payments are processed through Paystack, not stored directly by
            Staynex.
          </li>
          <li>
            Guest reviews are tied to real booking activity before publication.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="For property owners">
        <p>
          Staynex gives owners a focused operating surface for listings, rooms,
          availability, bookings, payout visibility, and guest communication.
          The goal is not just more traffic; it is a more reliable booking
          channel that reduces manual coordination.
        </p>
      </LegalSection>

      <LegalSection heading="Our operating standard">
        <p>
          We prioritize clarity, payment integrity, accurate availability, and
          fast support. As the platform grows, Staynex will keep investing in
          verification, owner tooling, guest protection, and operational
          discipline.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
