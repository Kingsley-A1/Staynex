"use client";

import { useEffect, useState } from "react";
import { LinkButton } from "@/ui";
import { guestApi } from "@/lib/api";
import type { PaymentStatusView } from "@/lib/types";

export function PaymentStatusClient({ reference }: { reference: string }) {
  const [state, setState] = useState<PaymentStatusView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let tries = 0;

    async function poll() {
      try {
        const next = await guestApi.getPaymentStatus(reference);
        if (!active) return;
        setState(next);
        if (next.paymentStatus === "SUCCESS" || next.paymentStatus === "FAILED") return;
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load payment status");
      }
      tries += 1;
      if (active && tries < 20) setTimeout(poll, 3000);
    }

    poll();
    return () => {
      active = false;
    };
  }, [reference]);

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
