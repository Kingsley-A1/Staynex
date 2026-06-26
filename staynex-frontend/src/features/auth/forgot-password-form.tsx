"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { Button, Field, Input } from "@/ui";
import { authApi } from "@/lib/api";

// Always shows the same confirmation whether or not the email is registered —
// the backend never reveals account existence (no enumeration).
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    await authApi.forgotPassword(email.trim()).catch(() => {});
    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <h2 className="text-title-sm text-ink">Check your email</h2>
        <p className="text-muted-foreground">
          If an account exists for <span className="font-medium text-ink">{email}</span>, we've sent a
          link to reset your password. It expires in 1 hour.
        </p>
        <Link href="/sign-in" className="inline-block font-semibold text-primary">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="surface-card space-y-4 p-6">
      <Field label="Email" htmlFor="email" required>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </Field>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-caption">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-semibold text-primary">
          Sign in
        </Link>
      </p>
    </form>
  );
}
