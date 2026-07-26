"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui";
import { adminApi, apiErrorMessage } from "@/lib/api";
import {
  PAYMENT_PROVIDER_LABELS,
  type PaymentProviderName,
  type PaymentState,
} from "@/lib/types";

/** Label the provider that actually captured this payment; never assume one. */
function providerLabel(provider: string | null): string {
  if (provider && provider in PAYMENT_PROVIDER_LABELS) {
    return PAYMENT_PROVIDER_LABELS[provider as PaymentProviderName];
  }
  return "the payment provider";
}

/**
 * Audited money actions for one payment. Re-verify forces a fresh provider
 * check (support cases); refund calls the provider first and only then
 * transitions local state (payment REFUNDED, booking cancelled, unsettled
 * payout clawed back).
 */
export function PaymentActions({
  reference,
  status,
  provider = null,
}: {
  reference: string;
  status: PaymentState;
  /** Provider persisted on the payment row — drives the confirmation copy. */
  provider?: string | null;
}) {
  const router = useRouter();
  const [confirmingRefund, setConfirmingRefund] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"reverify" | "refund" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refundable = status === "SUCCESS" || status === "REQUIRES_REFUND";
  const reverifiable = status === "PENDING" || status === "INITIATED";

  async function reverify() {
    setBusy("reverify");
    setError(null);
    try {
      await adminApi.reverifyPayment(reference);
      router.refresh();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't re-verify this payment."));
    } finally {
      setBusy(null);
    }
  }

  async function refund(event: FormEvent) {
    event.preventDefault();
    setBusy("refund");
    setError(null);
    try {
      await adminApi.refundPayment(reference, note.trim() || undefined);
      setConfirmingRefund(false);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(apiErrorMessage(err, "Refund was not accepted."));
    } finally {
      setBusy(null);
    }
  }

  if (!refundable && !reverifiable) {
    return <span className="text-caption text-muted-foreground">—</span>;
  }

  if (confirmingRefund) {
    return (
      <form onSubmit={refund} className="flex w-56 flex-col items-stretch gap-1.5">
        <p className="text-caption font-medium text-error">
          Refund the full amount via {providerLabel(provider)}? The booking is
          cancelled and any unsettled payout is clawed back.
        </p>
        <input
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Reason (optional)"
          aria-label="Refund reason"
          className="h-8 rounded-md border border-border bg-background px-2 text-sm"
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmingRefund(false)}
            disabled={busy === "refund"}
          >
            Cancel
          </Button>
          <Button type="submit" variant="danger" size="sm" disabled={busy === "refund"}>
            {busy === "refund" ? "Refunding…" : "Confirm refund"}
          </Button>
        </div>
        {error && (
          <p className="text-caption text-error" role="alert">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {reverifiable && (
          <Button variant="secondary" size="sm" onClick={reverify} disabled={busy !== null}>
            {busy === "reverify" ? "Checking…" : "Re-verify"}
          </Button>
        )}
        {refundable && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmingRefund(true)}>
            Refund…
          </Button>
        )}
      </div>
      {error && (
        <p className="text-caption text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
