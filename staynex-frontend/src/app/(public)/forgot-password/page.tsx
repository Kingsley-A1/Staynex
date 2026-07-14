import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password — Staynex" };

export default function ForgotPasswordPage() {
  return (
    <main className="layout-container py-12">
      <div className="mx-auto max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-title-lg text-ink">Reset your password</h1>
          <p className="mt-1 text-muted-foreground">
            Enter your email and we'll send a 6-digit code to set a new one.
          </p>
        </header>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
