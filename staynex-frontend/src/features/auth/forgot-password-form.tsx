"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Input } from "@/ui";
import { authApi } from "@/lib/api";

// Always continues to the code-entry page whether or not the email is
// registered — the backend never reveals account existence (no enumeration).
export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const trimmed = email.trim();
    await authApi.forgotPassword(trimmed).catch(() => {});
    router.push(`/reset-password?email=${encodeURIComponent(trimmed)}`);
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
        {busy ? "Sending…" : "Send reset code"}
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
