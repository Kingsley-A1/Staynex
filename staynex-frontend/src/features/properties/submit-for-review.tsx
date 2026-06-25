"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui";
import { ownerApi } from "@/lib/api";
import type { PropertyStatus } from "@/lib/types";

export function SubmitForReview({
  propertyId,
  status,
}: {
  propertyId: string;
  status: PropertyStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alreadySubmitted = status !== "DRAFT" && status !== "REJECTED";

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await ownerApi.submitProperty(propertyId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="surface-card space-y-2 p-4">
      <h3 className="text-title-sm">Submit for review</h3>
      <p className="text-caption">Admins review submitted properties before they go live.</p>
      <Button onClick={submit} disabled={pending || alreadySubmitted}>
        {pending ? "Submitting…" : alreadySubmitted ? "Already submitted" : "Submit for review"}
      </Button>
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
