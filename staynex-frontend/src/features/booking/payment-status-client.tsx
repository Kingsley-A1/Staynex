"use client";

import { useEffect, useState } from "react";
import { Button, LinkButton } from "@/ui";
import { RecoveryNotice } from "@/components/recovery-notice";
import { apiErrorMessage, guestApi } from "@/lib/api";
import type { PaymentStatusView } from "@/lib/types";

const MAX_POLLS = 20; // ~60s of polling before the honest "still working" state
const TERMINAL_STATES = [
  "SUCCESS",
  "FAILED",
  "REQUIRES_REFUND",
  "REFUNDED",
] as const;

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
        setError(null);
        setState(next);
        if ((TERMINAL_STATES as readonly string[]).includes(next.paymentStatus))
          return;
      } catch (err) {
        if (active) {
          setError(
            apiErrorMessage(
              err,
              "Staynex could not reach the payment record or your booking session is no longer valid.",
            ),
          );
        }
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
      <RecoveryNotice
        title="Payment status is temporarily unavailable"
        reason={`${error} Retry after signing in with the booking account, or close this status page.`}
        onRetry={checkAgain}
        secondaryAction={{ label: "Close", href: "/search" }}
      />
    );
  }

  if (state?.paymentStatus === "SUCCESS") {
    const isTest = state.paymentMode === "TEST";
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <div
          className={`mx-auto grid size-12 place-items-center rounded-full text-lg font-bold ${
            isTest
              ? "bg-warning-surface text-warning"
              : "bg-success-surface text-success"
          }`}
        >
          {isTest ? "T" : "✓"}
        </div>
        <h1 className="text-title-md text-ink">
          {isTest ? "Test payment confirmed" : "Payment confirmed"}
        </h1>
        <p className="text-muted-foreground">
          {isTest
            ? "No money was charged. This test booking is not valid for check-in and does not reserve live inventory."
            : "Your booking is confirmed."}
        </p>
        <LinkButton href={`/booking/confirmed?booking=${state.bookingId}`}>
          View confirmation
        </LinkButton>
      </div>
    );
  }

  if (state?.paymentStatus === "FAILED") {
    const isTest = state.paymentMode === "TEST";
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-warning-surface text-lg font-bold text-warning">
          ✕
        </div>
        <h1 className="text-title-md text-ink">Payment not completed</h1>
        <p className="text-muted-foreground">
          {isTest
            ? "The sandbox payment did not complete. No money was charged and live inventory was unchanged."
            : "Your booking was not confirmed. No stay was reserved."}
        </p>
        <LinkButton href="/search" variant="secondary">
          Try another stay
        </LinkButton>
      </div>
    );
  }

  if (
    state?.paymentStatus === "REQUIRES_REFUND" ||
    state?.paymentStatus === "REFUNDED"
  ) {
    const isTest = state.paymentMode === "TEST";
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-warning-surface text-lg font-bold text-warning">
          !
        </div>
        <h1 className="text-title-md text-ink">
          {isTest
            ? "Test payment closed"
            : state.paymentStatus === "REFUNDED"
              ? "Payment refunded"
              : "We're refunding this payment"}
        </h1>
        <p className="text-muted-foreground">
          {isTest
            ? "No money moved. The test booking was closed and live inventory was unchanged."
            : `Your payment went through, but the stay could no longer be confirmed for those dates.${
                state.paymentStatus === "REFUNDED"
                  ? " Your refund has been issued to your payment method."
                  : " Our team is processing your refund — you don't need to do anything."
              }`}
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
        <h1 className="text-title-md text-ink">
          This is taking longer than expected
        </h1>
        <p className="text-muted-foreground">
          Some banks confirm slowly. If you completed payment, your booking will
          confirm automatically once the bank notifies us — check back shortly
          or contact support.
        </p>
        <p className="text-caption text-muted-foreground">
          Keep your payment reference:{" "}
          <span className="font-mono">{reference}</span>
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
      <h1 className="text-title-md text-ink">
        {state?.paymentMode === "TEST"
          ? "Confirming test payment…"
          : "Confirming your payment…"}
      </h1>
      <p className="text-muted-foreground">
        {state?.paymentMode === "TEST"
          ? "The provider sandbox is verifying this test. No money will be charged."
          : "This can take a few seconds while we verify with your payment provider."}
      </p>
    </div>
  );
}
