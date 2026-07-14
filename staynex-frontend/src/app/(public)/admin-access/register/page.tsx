import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata: Metadata = {
  title: "Admin account setup — Staynex",
  robots: { index: false },
};

export default function AdminRegistrationPage() {
  if (process.env.ENABLE_ADMIN_ACCESS_PAGE !== "true") notFound();

  return (
    <main className="layout-container py-12">
      <div className="mx-auto max-w-md space-y-6">
        <header className="text-center">
          <p className="text-overline text-primary">Restricted setup</p>
          <h1 className="mt-2 text-title-lg text-ink">
            Create a staff account
          </h1>
          <p className="mt-2 text-muted-foreground">
            A six-digit access code is required. Account permissions are
            determined by that code and enforced by the backend.
          </p>
        </header>
        <AuthForm mode="admin" next="/admin" />
      </div>
    </main>
  );
}
