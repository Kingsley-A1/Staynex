"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, PasswordInput } from "@/ui";
import { authApi } from "@/lib/api";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
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
      await authApi.resetPassword({ token, password });
      setDone(true);
      setTimeout(() => {
        router.push("/sign-in");
        router.refresh();
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg.includes("401")
          ? "This reset link is invalid or has expired. Request a new one."
          : "Couldn't reset your password. Please try again.",
      );
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <p className="text-muted-foreground">This reset link is missing or invalid.</p>
        <Link href="/forgot-password" className="inline-block font-semibold text-primary">
          Request a new link
        </Link>
      </div>
    );
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
    </form>
  );
}
