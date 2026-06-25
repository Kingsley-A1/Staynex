"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, LinkButton } from "@/ui";
import { authApi } from "@/lib/api";
import type { AppRole, AuthUser } from "@/lib/types";

const ROLE_LABELS: Record<AppRole, string> = {
  GUEST: "Guest",
  OWNER: "Property owner",
  ADMIN_REVIEWER: "Admin",
  ADMIN_MANAGER: "Super Admin",
};

export function ProfileView() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    authApi
      .me()
      .then((u) => {
        if (!active) return;
        setUser(u);
        setName(u?.name ?? "");
        setEmail(u?.email ?? "");
        setPhone(u?.phone ?? "");
      })
      .catch(() => active && setUser(null));
    return () => {
      active = false;
    };
  }, []);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await authApi.updateProfile({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
      });
      setUser(updated);
      setSaved(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg.includes("409")
          ? "That email is already in use."
          : "Couldn't save your profile. Please check your details and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    setDeleteError(null);
    try {
      await authApi.deleteAccount();
      router.push("/");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setDeleteError(
        msg.includes("409")
          ? "This account has linked records (such as properties) and can't be deleted yet."
          : "Couldn't delete your account. Please try again.",
      );
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  async function signOut() {
    await authApi.logout().catch(() => {});
    router.push("/");
    router.refresh();
  }

  if (user === undefined) {
    return <div className="surface-card p-6 text-muted-foreground">Loading your profile…</div>;
  }
  if (user === null) {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <p className="text-muted-foreground">You're not signed in.</p>
        <LinkButton href="/sign-in?next=/profile">Sign in</LinkButton>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="surface-card flex items-center justify-between gap-4 px-5 py-4 text-sm">
        <div>
          <p className="text-muted-foreground">Role</p>
          <p className="font-medium text-ink">{ROLE_LABELS[user.role]}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success-border bg-success-surface px-2.5 py-0.5 text-xs font-semibold text-success">
          <span className="size-1.5 rounded-full bg-success" />
          Active
        </span>
      </div>

      <form onSubmit={save} className="surface-card space-y-4 p-5">
        <h2 className="text-title-sm text-ink">Edit profile</h2>
        <Field label="Display name" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>
        <Field label="Phone" htmlFor="phone" hint="Optional">
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+234…"
            autoComplete="tel"
          />
        </Field>
        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}
        {saved && <p className="text-sm text-success">Profile updated.</p>}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </form>

      <Button variant="secondary" onClick={signOut} disabled={busy}>
        Sign out
      </Button>

      <div className="surface-card space-y-3 border-error-border p-5">
        <div>
          <h2 className="text-title-sm text-error">Delete account</h2>
          <p className="text-caption">
            Permanently delete your account and sign-in. This can't be undone.
          </p>
        </div>
        {deleteError && (
          <p className="text-sm text-error" role="alert">
            {deleteError}
          </p>
        )}
        {confirmingDelete ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={deleteAccount} disabled={busy}>
              {busy ? "Deleting…" : "Yes, delete my account"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
            Delete account
          </Button>
        )}
      </div>
    </div>
  );
}
