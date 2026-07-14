import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = { title: "Set a new password — Staynex", robots: { index: false } };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <main className="layout-container py-12">
      <div className="mx-auto max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-title-lg text-ink">Set a new password</h1>
          <p className="mt-1 text-muted-foreground">
            Enter the 6-digit code we emailed you, then choose a strong password.
          </p>
        </header>
        <ResetPasswordForm email={email ?? ""} />
      </div>
    </main>
  );
}
