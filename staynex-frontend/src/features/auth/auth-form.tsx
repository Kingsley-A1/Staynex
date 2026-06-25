"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Input, Select } from "@/ui";
import { GoogleAuthButton } from "@/features/auth/google-auth-button";
import { authApi } from "@/lib/api";
import type { AppRole, AuthUser } from "@/lib/types";

type Mode = "login" | "register" | "admin";

function roleHome(role: AppRole): string {
  if (role === "OWNER") return "/owner/dashboard";
  if (role === "ADMIN_REVIEWER" || role === "ADMIN_MANAGER") return "/admin/approvals";
  return "/";
}

// Reusable auth form. As a page it navigates on success; embedded (checkout gate)
// it calls `onSuccess` instead so the surrounding flow continues.
export function AuthForm({
  mode,
  next,
  onSuccess,
  compact = false,
}: {
  mode: Mode;
  next?: string;
  onSuccess?: (user: AuthUser) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"GUEST" | "OWNER">("GUEST");
  const [accessCode, setAccessCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let user: AuthUser;
      if (mode === "login") {
        user = await authApi.login({ email, password });
      } else if (mode === "admin") {
        user = await authApi.adminRegister({
          email,
          password,
          name: name || undefined,
          accessCode,
        });
      } else {
        user = await authApi.register({
          email,
          password,
          name: name || undefined,
          role,
        });
      }
      if (onSuccess) onSuccess(user);
      else {
        router.push(next || roleHome(user.role));
        router.refresh();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg.includes("401")
          ? "Invalid email or password."
          : msg.includes("403")
            ? "That admin access code wasn't accepted."
            : msg.includes("409")
              ? "An account with this email already exists."
              : msg.includes("429")
                ? "Too many attempts. Please try again later."
                : "Something went wrong. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={compact ? "space-y-4" : "surface-card space-y-4 p-6"}>
      {mode !== "admin" && <GoogleAuthButton next={next} onSuccess={onSuccess} />}
      {(mode === "register" || mode === "admin") && (
        <Field label="Name" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
      )}
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
      <Field label="Password" htmlFor="password" required hint={mode !== "login" ? "At least 8 characters" : undefined}>
        <Input
          id="password"
          type="password"
          required
          minLength={mode === "login" ? undefined : 8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </Field>

      {mode === "register" && (
        <Field label="I'm registering as" htmlFor="role">
          <Select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as "GUEST" | "OWNER")}
          >
            <option value="GUEST">A guest booking stays</option>
            <option value="OWNER">A property owner</option>
          </Select>
        </Field>
      )}
      {mode === "admin" && (
        <Field
          label="Admin access code"
          htmlFor="accessCode"
          required
          hint="Your code determines whether this account is Admin or Super Admin."
        >
          <Input
            id="accessCode"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, ""))}
            placeholder="••••••"
          />
        </Field>
      )}

      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="w-full">
        {busy
          ? "Please wait…"
          : mode === "login"
            ? "Sign in"
            : mode === "admin"
              ? "Create admin account"
              : "Create account"}
      </Button>

      {mode === "login" && (
        <p className="text-center text-caption">
          New to Staynex?{" "}
          <Link href="/register" className="font-semibold text-primary">
            Create an account
          </Link>
        </p>
      )}
      {mode === "register" && (
        <p className="text-center text-caption">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-primary">
            Sign in
          </Link>
        </p>
      )}
    </form>
  );
}
