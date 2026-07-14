"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Input, PasswordInput } from "@/ui";
import { authApi } from "@/lib/api";

export function ResetPasswordForm({ email: initialEmail }: { email: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setConfirmError(null);
    if (password !== confirm) {
      setConfirmError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword({ email: email.trim(), code: code.trim(), password });
      setDone(true);
      setTimeout(() => {
        router.push("/sign-in");
        router.refresh();
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg.includes("401")
          ? "That code is invalid or has expired. Request a new one."
          : "Couldn't reset your password. Please try again.",
      );
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="surface-card space-y-2 p-6 text-center">
        <h2 className="text-title-sm text-ink">Password updated</h2>
        <p className="text-muted-foreground">Redirecting you to sign in…</p>
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
      <Field
        label="6-digit code"
        htmlFor="code"
        required
        hint="Check your email — the code expires in 15 minutes"
      >
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="tracking-[0.4em]"
        />
      </Field>
      <Field label="New password" htmlFor="password" required hint="At least 8 characters">
        <PasswordInput
          id="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" required error={confirmError ?? undefined}>
        <PasswordInput
          id="confirm"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          invalid={Boolean(confirmError)}
        />
      </Field>
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Updating…" : "Update password"}
      </Button>
      <p className="text-center text-caption">
        Didn&apos;t get a code?{" "}
        <Link href="/forgot-password" className="font-semibold text-primary">
          Request another
        </Link>
      </p>
    </form>
  );
}
