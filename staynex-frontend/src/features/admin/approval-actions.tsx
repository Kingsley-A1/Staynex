"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Textarea } from "@/ui";
import { adminApi } from "@/lib/api";
import type { ApprovalDecision } from "@/lib/types";

export function ApprovalActions({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<ApprovalDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function decide(decision: ApprovalDecision) {
    setPending(decision);
    setError(null);
    try {
      const result = await adminApi.decide(propertyId, {
        decision,
        note: note || undefined,
      });
      setDone(result.status);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPending(null);
    }
  }

  if (done) {
    return (
      <p className="rounded-md border border-success-border bg-success-surface px-3 py-2 text-sm text-success">
        Decision recorded · new status: {done}
      </p>
    );
  }

  return (
    <div className="surface-card space-y-3 p-4">
      <h3 className="text-title-sm">Review decision</h3>
      <Textarea
        aria-label="Reviewer note"
        placeholder="Optional note for the owner (recommended for rejections / change requests)…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => decide("APPROVE")} disabled={pending !== null}>
          {pending === "APPROVE" ? "Approving…" : "Approve"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => decide("REQUEST_CHANGES")}
          disabled={pending !== null}
        >
          {pending === "REQUEST_CHANGES" ? "Sending…" : "Request changes"}
        </Button>
        <Button variant="danger" onClick={() => decide("REJECT")} disabled={pending !== null}>
          {pending === "REJECT" ? "Rejecting…" : "Reject"}
        </Button>
      </div>
      <p className="text-caption">Every decision writes an audit log entry on the backend.</p>
    </div>
  );
}
