import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata: Metadata = { title: "Admin access — Staynex", robots: { index: false } };

export default function AdminAccessPage() {
  return (
    <main className="layout-container py-12">
      <div className="mx-auto max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-title-lg text-ink">Admin access</h1>
          <p className="mt-1 text-muted-foreground">
            Staff registration. You'll need your 6-digit access code.
          </p>
        </header>
        <AuthForm mode="admin" next="/admin/approvals" />
      </div>
    </main>
  );
}
