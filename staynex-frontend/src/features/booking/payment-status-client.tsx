"use client";

import { useEffect, useState } from "react";
import { Button, LinkButton } from "@/ui";
import { guestApi } from "@/lib/api";
import type { PaymentStatusView } from "@/lib/types";

const MAX_POLLS = 20; // ~60s of polling before the honest "still working" state
const TERMINAL_STATES = ["SUCCESS", "FAILED", "REQUIRES_REFUND", "REFUNDED"] as const;

export function PaymentStatusClient({ reference }: { reference: string }) {
  const [state, setState] = useState<PaymentStatusView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  // Bumped by "Check again" to restart the polling loop after a timeout.
  const [pollRun, setPollRun] = useState(0);

  useEffect(() => {
    let active = true;
    let tries = 0;

    async function poll() {
      try {
        const next = await guestApi.getPaymentStatus(reference);
        if (!active) return;
        setState(next);
        if ((TERMINAL_STATES as readonly string[]).includes(next.paymentStatus)) return;
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load payment status");
      }
      tries += 1;
      if (!active) return;
      if (tries < MAX_POLLS) setTimeout(poll, 3000);
      else setTimedOut(true); // never leave the guest on an infinite spinner
    }

    poll();
    return () => {
      active = false;
    };
  }, [reference, pollRun]);

  function checkAgain() {
    setTimedOut(false);
    setError(null);
    setPollRun((run) => run + 1);
  }

  if (error) {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
        <LinkButton href="/search" variant="secondary">
          Back to search
        </LinkButton>
      </div>
    );
  }

  if (state?.paymentStatus === "SUCCESS") {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-success-surface text-lg font-bold text-success">
          ✓
        </div>
        <h1 className="text-title-md text-ink">Payment confirmed</h1>
        <p className="text-muted-foreground">Your booking is confirmed.</p>
        <LinkButton href={`/booking/confirmed?booking=${state.bookingId}`}>
          View confirmation
        </LinkButton>
      </div>
    );
  }

  if (state?.paymentStatus === "FAILED") {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-error-surface text-lg font-bold text-error">
          ✕
        </div>
        <h1 className="text-title-md text-ink">Payment not completed</h1>
        <p className="text-muted-foreground">Your booking was not confirmed. No stay was reserved.</p>
        <LinkButton href="/search" variant="secondary">
          Try another stay
        </LinkButton>
      </div>
    );
  }

  if (state?.paymentStatus === "REQUIRES_REFUND" || state?.paymentStatus === "REFUNDED") {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-warning-surface text-lg font-bold text-warning">
          !
        </div>
        <h1 className="text-title-md text-ink">
          {state.paymentStatus === "REFUNDED" ? "Payment refunded" : "We're refunding this payment"}
        </h1>
        <p className="text-muted-foreground">
          Your payment went through, but the stay could no longer be confirmed for those dates.
          {state.paymentStatus === "REFUNDED"
            ? " Your refund has been issued to your payment method."
            : " Our team is processing your refund — you don't need to do anything."}
        </p>
        <p className="text-caption text-muted-foreground">
          Reference: <span className="font-mono">{reference}</span>
        </p>
        <LinkButton href="/search" variant="secondary">
          Find another stay
        </LinkButton>
      </div>
    );
  }

  if (timedOut) {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-warning-surface text-lg font-bold text-warning">
          ⏳
        </div>
        <h1 className="text-title-md text-ink">This is taking longer than expected</h1>
        <p className="text-muted-foreground">
          Some banks confirm slowly. If you completed payment, your booking will confirm
          automatically once the bank notifies us — check back shortly or contact support.
        </p>
        <p className="text-caption text-muted-foreground">
          Keep your payment reference: <span className="font-mono">{reference}</span>
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={checkAgain}>Check again</Button>
          <LinkButton href="/search" variant="secondary">
            Back to search
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-card space-y-3 p-6 text-center">
      <div className="mx-auto size-10 animate-spin rounded-full border-2 border-border border-t-primary" />
      <h1 className="text-title-md text-ink">Confirming your payment…</h1>
      <p className="text-muted-foreground">
        This can take a few seconds while we verify with Paystack.
      </p>
    </div>
  );
}
