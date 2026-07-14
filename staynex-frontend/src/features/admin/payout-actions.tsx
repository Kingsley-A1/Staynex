"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui";
import { adminApi, apiErrorMessage } from "@/lib/api";

/**
 * Manual settlement actions (Phase A: transfers happen out-of-band). Both
 * transitions are audited on the backend. Settling before eligibility requires
 * an explicit override + note; failing a payout requires a reason.
 */
export function PayoutActions({
  payoutId,
  eligible,
}: {
  payoutId: string;
  eligible: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "paid" | "failed">("idle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode("idle");
    setNote("");
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "paid") {
        await adminApi.markPayoutPaid(payoutId, {
          note: note.trim() || undefined,
          // The backend enforces eligibility; sending the override only for
          // early settlements keeps the audit trail honest.
          ...(eligible ? {} : { overrideEligibility: true }),
        });
      } else {
        await adminApi.markPayoutFailed(payoutId, note.trim());
      }
      reset();
      router.refresh();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't update this payout."));
      setBusy(false);
    }
  }

  if (mode === "idle") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setMode("paid")}>
            {eligible ? "Mark paid" : "Settle early…"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMode("failed")}>
            Mark failed…
          </Button>
        </div>
      </div>
    );
  }

  const failing = mode === "failed";
  const requiresNote = failing || !eligible;
  return (
    <form onSubmit={submit} className="flex w-56 flex-col items-stretch gap-1.5">
      {!eligible && !failing && (
        <p className="text-caption font-medium text-warning">
          Not yet eligible — this records an early-settlement override.
        </p>
      )}
      <input
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        required={requiresNote}
        minLength={failing ? 3 : undefined}
        maxLength={500}
        placeholder={failing ? "Reason (required)" : "Transfer reference / note"}
        aria-label={failing ? "Failure reason" : "Settlement note"}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : failing ? "Confirm failed" : "Confirm paid"}
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
