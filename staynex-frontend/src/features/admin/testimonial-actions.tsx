"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui";
import { adminApi } from "@/lib/api";

type Decision = "APPROVE" | "REJECT" | "PENDING";

export function TestimonialActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: Decision) {
    setPending(decision);
    setError(null);
    try {
      await adminApi.moderateTestimonial(id, decision);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {status !== "APPROVED" && (
          <Button size="sm" onClick={() => decide("APPROVE")} disabled={pending !== null}>
            {pending === "APPROVE" ? "…" : "Approve"}
          </Button>
        )}
        {status !== "REJECTED" && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => decide("REJECT")}
            disabled={pending !== null}
          >
            {pending === "REJECT" ? "…" : "Reject"}
          </Button>
        )}
        {status !== "PENDING_REVIEW" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => decide("PENDING")}
            disabled={pending !== null}
          >
            {pending === "PENDING" ? "…" : "Reset"}
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
