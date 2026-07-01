"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Input, PasswordInput, Select } from "@/ui";
import { GoogleAuthButton } from "@/features/auth/google-auth-button";
import { authApi } from "@/lib/api";
import {
  type AuthMfaChallenge,
  type AuthUser,
  capabilityHome,
  isAdminCapable,
  isAuthMfaChallenge,
  isOwnerCapable,
} from "@/lib/types";

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
  const [mfaCode, setMfaCode] = useState("");
  const [mfaChallenge, setMfaChallenge] = useState<AuthMfaChallenge | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<AuthUser | null>(null);

  function clearErrors() {
    setError(null);
    setEmailError(null);
    setPasswordError(null);
  }

  function resetMfa() {
    setMfaChallenge(null);
    setMfaCode("");
  }

  function goHome(user: AuthUser) {
    // router.refresh() re-renders server components (e.g. the auth-aware header)
    // so the now-signed-in state is reflected immediately.
    router.push(next || capabilityHome(user));
    router.refresh();
  }

  function handleSuccess(user: AuthUser) {
    if (onSuccess) {
      onSuccess(user);
    } else if (mode === "register") {
      // Confirm the account was created before sending the guest onward —
      // otherwise a guest (whose home is the welcome page) gets no signal that
      // registration worked.
      setRegistered(user);
    } else {
      goHome(user);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    clearErrors();
    try {
      let user: AuthUser;
      if (mode === "login") {
        const result = await authApi.login({ email, password });
        if (isAuthMfaChallenge(result)) {
          setMfaChallenge(result);
          setBusy(false);
          return;
        }
        user = result;
      } else if (mode === "admin") {
        const result = await authApi.adminRegister({
          email,
          password,
          name: name || undefined,
          accessCode,
        });
        if (isAuthMfaChallenge(result)) {
          setMfaChallenge(result);
          setBusy(false);
          return;
        }
        user = result;
      } else if (ownerIntent) {
        user = await authApi.registerOwner({
          email,
          password,
          name: name || undefined,
        });
      } else {
        user = await authApi.register({
          email,
          password,
          name: name || undefined,
          role,
        });
      }
      handleSuccess(user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("401")) {
        // Wrong credentials: flag the password field rather than a generic banner.
        setPasswordError(
          "Incorrect email or password. Check your password or reset it.",
        );
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

  async function submitMfa(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mfaChallenge) return;
    setBusy(true);
    clearErrors();
    try {
      const user = await authApi.completeMfa({
        challengeId: mfaChallenge.challengeId,
        code: mfaCode,
      });
      handleSuccess(user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("401")) {
        setError("That verification code wasn't accepted.");
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

  if (registered) {
    const goesToWorkspace =
      isOwnerCapable(registered) || isAdminCapable(registered);
    return (
      <RegistrationSuccess
        user={registered}
        busy={busy}
        continueLabel={
          goesToWorkspace ? "Go to your dashboard" : "Start exploring stays"
        }
        onContinue={() => {
          setBusy(true);
          goHome(registered);
        }}
      />
    );
  }

  if (mfaChallenge) {
    return (
      <form
        onSubmit={submitMfa}
        className={compact ? "space-y-4" : "surface-card space-y-4 p-6"}
      >
        <div className="space-y-1">
          <h2 className="text-title-sm text-ink">Verify admin sign in</h2>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to {mfaChallenge.email}.
          </p>
        </div>
        <Field label="Verification code" htmlFor="mfaCode" required>
          <Input
            id="mfaCode"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
            autoComplete="one-time-code"
            placeholder="••••••"
          />
        </Field>
        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={busy || mfaCode.length !== 6}
          className="w-full"
        >
          {busy ? "Please wait…" : "Verify and continue"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          className="w-full"
          onClick={resetMfa}
        >
          Use a different account
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={compact ? "space-y-4" : "surface-card space-y-4 p-6"}
    >
      {mode !== "admin" && (
        <GoogleAuthButton
          next={next}
          onSuccess={onSuccess}
          intent={ownerIntent ? "OWNER" : undefined}
        />
      )}
      {(mode === "register" || mode === "admin") && (
        <Field label="Name" htmlFor="name">
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </Field>
      )}
      <Field
        label="Email"
        htmlFor="email"
        required
        error={emailError ?? undefined}
      >
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
          <Link
            href="/forgot-password"
            className="text-caption font-medium text-primary"
          >
            Forgot password?
          </Link>
        </div>
      )}

      {mode === "register" && !ownerIntent && (
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

/** Post-registration confirmation. Gives the guest an unambiguous success signal
 *  before they continue (a guest's destination is the public welcome page, which
 *  otherwise looks identical to a failed attempt). */
function RegistrationSuccess({
  user,
  busy,
  continueLabel,
  onContinue,
}: {
  user: AuthUser;
  busy: boolean;
  continueLabel: string;
  onContinue: () => void;
}) {
  const firstName = user.name?.trim().split(/\s+/)[0];
  return (
    <div
      className="surface-card space-y-5 p-6 text-center"
      role="status"
      aria-live="polite"
    >
      <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-success-surface text-success">
        <svg
          viewBox="0 0 24 24"
          className="size-7"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m20 6-11 11-5-5" />
        </svg>
      </span>
      <div className="space-y-1">
        <h2 className="text-title-sm text-ink">
          {firstName
            ? `Welcome to Staynex, ${firstName}!`
            : "Welcome to Staynex!"}
        </h2>
        <p className="text-muted-foreground">
          Your account is ready{user.email ? ` for ${user.email}` : ""}.
          You&apos;re now signed in.
        </p>
      </div>
      <Button
        type="button"
        onClick={onContinue}
        disabled={busy}
        className="w-full"
      >
        {busy ? "Please wait…" : continueLabel}
      </Button>
    </div>
  );
}
