"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Input, PasswordInput, Select } from "@/ui";
import { GoogleAuthButton } from "@/features/auth/google-auth-button";
import { authApi } from "@/lib/api";
import { type AuthUser, capabilityHome } from "@/lib/types";

type Mode = "login" | "register" | "admin";

// Reusable auth form. As a page it navigates on success; embedded (checkout gate)
// it calls `onSuccess` instead so the surrounding flow continues. `roleIntent`
// locks owner-intent registration (used by /owner/register).
export function AuthForm({
  mode,
  next,
  onSuccess,
  compact = false,
  roleIntent,
}: {
  mode: Mode;
  next?: string;
  onSuccess?: (user: AuthUser) => void;
  compact?: boolean;
  roleIntent?: "OWNER";
}) {
  const router = useRouter();
  const ownerIntent = mode === "register" && roleIntent === "OWNER";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"GUEST" | "OWNER">("GUEST");
  const [accessCode, setAccessCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function clearErrors() {
    setError(null);
    setEmailError(null);
    setPasswordError(null);
  }

  function handleSuccess(user: AuthUser) {
    if (onSuccess) onSuccess(user);
    else {
      router.push(next || capabilityHome(user));
      router.refresh();
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    clearErrors();
    try {
      let user: AuthUser;
      if (mode === "login") {
        user = await authApi.login({ email, password });
      } else if (mode === "admin") {
        user = await authApi.adminRegister({ email, password, name: name || undefined, accessCode });
      } else if (ownerIntent) {
        user = await authApi.registerOwner({ email, password, name: name || undefined });
      } else {
        user = await authApi.register({ email, password, name: name || undefined, role });
      }
      handleSuccess(user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("401")) {
        // Wrong credentials: flag the password field rather than a generic banner.
        setPasswordError("Incorrect email or password. Check your password or reset it.");
      } else if (msg.includes("409")) {
        setEmailError("An account with this email already exists.");
      } else if (msg.includes("403")) {
        setError("That admin access code wasn't accepted.");
      } else if (msg.includes("429")) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      setBusy(false);
    }
  }

  const submitLabel = busy
    ? "Please wait…"
    : mode === "login"
      ? "Sign in"
      : mode === "admin"
        ? "Create admin account"
        : ownerIntent
          ? "Create owner account"
          : "Create account";

  return (
    <form onSubmit={submit} className={compact ? "space-y-4" : "surface-card space-y-4 p-6"}>
      {mode !== "admin" && (
        <GoogleAuthButton next={next} onSuccess={onSuccess} intent={ownerIntent ? "OWNER" : undefined} />
      )}
      {(mode === "register" || mode === "admin") && (
        <Field label="Name" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
      )}
      <Field label="Email" htmlFor="email" required error={emailError ?? undefined}>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          aria-invalid={emailError ? true : undefined}
        />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        required
        hint={mode !== "login" ? "At least 8 characters" : undefined}
        error={passwordError ?? undefined}
      >
        <PasswordInput
          id="password"
          required
          minLength={mode === "login" ? undefined : 8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          invalid={Boolean(passwordError)}
        />
      </Field>

      {mode === "login" && (
        <div className="-mt-1 text-right">
          <Link href="/forgot-password" className="text-caption font-medium text-primary">
            Forgot password?
          </Link>
        </div>
      )}

      {mode === "register" && !ownerIntent && (
        <Field label="I'm registering as" htmlFor="role">
          <Select id="role" value={role} onChange={(e) => setRole(e.target.value as "GUEST" | "OWNER")}>
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
        {submitLabel}
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
