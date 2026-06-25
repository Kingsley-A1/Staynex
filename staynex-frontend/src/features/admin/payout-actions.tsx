"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui";
import { adminApi } from "@/lib/api";

/**
 * Manual settlement action. Marking a payout paid is an admin override and is
 * audited on the backend; the actual transfer happens out-of-band in Phase A.
 */
export function MarkPaidButton({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function markPaid() {
    setBusy(true);
    setError(false);
    try {
      await adminApi.markPayoutPaid(payoutId);
      router.refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" onClick={markPaid} disabled={busy}>
        {busy ? "Saving…" : "Mark paid"}
      </Button>
      {error && (
        <span className="text-caption text-error" role="alert">
          Couldn&apos;t update
        </span>
      )}
    </div>
  );
}
