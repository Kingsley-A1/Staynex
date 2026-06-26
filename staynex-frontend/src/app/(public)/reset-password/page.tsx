import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = { title: "Set a new password — Staynex", robots: { index: false } };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="layout-container py-12">
      <div className="mx-auto max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-title-lg text-ink">Set a new password</h1>
          <p className="mt-1 text-muted-foreground">
            Choose a strong password you don't use elsewhere.
          </p>
        </header>
        <ResetPasswordForm token={token ?? ""} />
      </div>
    </main>
  );
}
