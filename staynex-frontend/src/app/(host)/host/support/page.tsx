import type { Metadata } from "next";
import { SupportPanel } from "@/features/support/support-panel";

export const metadata: Metadata = { title: "Host support" };

export default function HostSupportPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-title-lg text-ink">Support</h1>
        <p className="mt-1 text-muted-foreground">
          Get help with property reviews, bookings, payouts, availability, or
          host account access.
        </p>
      </header>
      <div className="surface-card p-6 sm:p-8">
        <SupportPanel compact />
      </div>
    </div>
  );
}
