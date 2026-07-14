import type { Metadata } from "next";
import { SupportPanel } from "@/features/support/support-panel";

export const metadata: Metadata = { title: "Admin support" };

export default function AdminSupportPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-title-lg text-ink">Support</h1>
        <p className="mt-1 text-muted-foreground">
          Get help with staff access or platform operations.
        </p>
      </header>
      <div className="surface-card p-6 sm:p-8">
        <SupportPanel compact />
      </div>
    </div>
  );
}
