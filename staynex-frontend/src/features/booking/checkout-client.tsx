"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button, Field, Input, LinkButton } from "@/ui";
import { AuthForm } from "@/features/auth/auth-form";
import { RecoveryNotice } from "@/components/recovery-notice";
import { ApiError, apiErrorMessage, guestApi, authApi } from "@/lib/api";
import { formatNairaFromKobo } from "@/lib/format";
import type { AuthUser, HoldSummary } from "@/lib/types";

export function CheckoutClient({ holdId }: { holdId: string }) {
  const paymentFormRef = useRef<HTMLFormElement>(null);
  const [hold, setHold] = useState<HoldSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRun, setLoadRun] = useState(0);
  // The hold no longer exists server-side — it was consumed when a payment
  // attempt started, or released after expiry. Common when a guest navigates
  // back to checkout after a failed/abandoned payment attempt.
  const [holdGone, setHoldGone] = useState(false);
  // undefined = still checking session; null = signed out.
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    setHoldGone(false);
    guestApi
      .getHold(holdId)
      .then((h) => active && setHold(h))
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) setHoldGone(true);
        else {
          setLoadError(
            apiErrorMessage(
              err,
              "Staynex could not load this reservation because the booking service did not respond.",
            ),
          );
        }
      });
    authApi
      .me()
      .then((u) => {
        if (!active) return;
        setUser(u);
        if (u?.email) setEmail(u.email);
      })
      .catch(() => active && setUser(null));
    return () => {
      active = false;
    };
  }, [holdId, loadRun]);

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setPayError(null);
    try {
      const result = await guestApi.checkout({ holdId, email });
      window.location.href = result.authorizationUrl;
    } catch (err) {
      setPayError(
        apiErrorMessage(
          err,
          "Payment could not start because the payment service did not accept the request. Check the receipt email and try again.",
        ),
      );
      setBusy(false);
    }
  }

  if (holdGone) {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <div
          className="mx-auto grid size-12 place-items-center rounded-full bg-warning-surface text-lg font-bold text-warning"
          aria-hidden
        >
          ⏳
        </div>
        <h2 className="text-title-md text-ink">
          This checkout session has ended
        </h2>
        <p className="text-muted-foreground">
          Your reservation hold is no longer active. This happens after a
          payment attempt finishes or a hold expires — rooms are only held
          briefly so availability stays accurate for everyone.
        </p>
        <p className="text-caption">
          If your payment didn&apos;t go through, nothing was booked and you
          haven&apos;t been charged for a stay. You can pick your dates again in
          seconds.
        </p>
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <LinkButton href="/search">Search stays again</LinkButton>
          <LinkButton href="/" variant="secondary">
            Back to home
          </LinkButton>
        </div>
      </div>
    );
  }
  if (loadError) {
    return (
      <RecoveryNotice
        title="This reservation could not be loaded"
        reason={`${loadError} Your hold has not been presented as confirmed or payable.`}
        onRetry={() => setLoadRun((run) => run + 1)}
        secondaryAction={{ label: "Back to search", href: "/search" }}
      />
    );
  }
  if (!hold) {
    return (
      <div className="surface-card p-5 text-muted-foreground">
        Loading reservation…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="surface-card space-y-2 p-5">
        <h2 className="text-title-sm">{hold.propertyName}</h2>
        <p className="text-caption">
          {hold.roomName} · {hold.checkIn} → {hold.checkOut} · {hold.nights}{" "}
          night
          {hold.nights === 1 ? "" : "s"}
        </p>
        <div className="flex justify-between border-t border-border pt-2 text-sm">
          <span className="text-muted-foreground">
            {formatNairaFromKobo(hold.nightlyPriceKobo)} × {hold.nights}
          </span>
          <span className="font-bold text-ink">
            {formatNairaFromKobo(hold.totalKobo)}
          </span>
        </div>
        {hold.expired ? (
          <p className="text-sm text-error">
            This reservation has expired — please search again.
          </p>
        ) : (
          <p className="text-caption">
            Hold expires at {new Date(hold.expiresAt).toLocaleTimeString()}.
          </p>
        )}
      </div>

      {!hold.expired && user === undefined && (
        <div className="surface-card p-5 text-muted-foreground">
          Checking your account…
        </div>
      )}

      {/* Registration/sign-in is required immediately before payment. */}
      {!hold.expired && user === null && (
        <div className="surface-card space-y-4 p-5">
          <div>
            <h3 className="text-title-sm text-ink">
              {authMode === "register"
                ? "Create an account to pay"
                : "Sign in to pay"}
            </h3>
            <p className="text-caption">
              Your booking is attached to your account so you get confirmation
              and can review your stay.
            </p>
          </div>
          <AuthForm
            mode={authMode}
            compact
            onSuccess={(u) => {
              setUser(u);
              if (u.email) setEmail(u.email);
            }}
          />
          <button
            type="button"
            onClick={() =>
              setAuthMode((m) => (m === "register" ? "login" : "register"))
            }
            className="text-caption font-semibold text-primary"
          >
            {authMode === "register"
              ? "I already have an account"
              : "Create a new account instead"}
          </button>
        </div>
      )}

      {!hold.expired && user && (
        <form
          ref={paymentFormRef}
          onSubmit={pay}
          className="surface-card space-y-4 p-5"
        >
          <Field label="Email for your receipt" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          {payError && (
            <RecoveryNotice
              compact
              title="Payment did not start"
              reason={payError}
              retryLabel="Try payment again"
              onRetry={() => paymentFormRef.current?.requestSubmit()}
              secondaryAction={{ label: "Back to search", href: "/search" }}
            />
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy
              ? "Starting payment…"
              : payError
                ? "Try starting payment again"
                : `Pay ${formatNairaFromKobo(hold.totalKobo)}`}
          </Button>
          {/* The provider is chosen server-side at checkout, so naming one here
              would eventually be wrong. Describe the guarantee, not the vendor. */}
          <p className="text-caption">
            You&apos;ll be redirected to our payment partner&apos;s secure
            checkout to complete this payment.
          </p>
        </form>
      )}
    </div>
  );
}
