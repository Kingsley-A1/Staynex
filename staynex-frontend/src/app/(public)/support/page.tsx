import type { Metadata } from "next";
import { SupportPanel } from "@/features/support/support-panel";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Contact Staynex support for account, booking, payment, property, and platform help.",
};

export default function SupportPage() {
  return (
    <main className="layout-container py-8 sm:py-12 lg:py-16">
      <div className="mx-auto max-w-3xl">
        <SupportPanel />
      </div>
    </main>
  );
}
