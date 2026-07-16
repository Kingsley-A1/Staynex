"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, adminApi, apiErrorMessage, hostApi } from "@/lib/api";
import { Button, Input } from "@/ui";

export function PropertyDeleteAction({
  propertyId,
  propertyName,
  scope,
  returnHref,
}: {
  propertyId: string;
  propertyName: string;
  scope: "host" | "admin";
  returnHref: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      if (scope === "admin") await adminApi.deleteProperty(propertyId);
      else await hostApi.deleteProperty(propertyId);
      router.push(returnHref);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? apiErrorMessage(
              caught,
              "This property could not be deleted. Review its active bookings and try again.",
            )
          : "This property could not be deleted. Check your connection and try again.",
      );
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="danger"
        onClick={() => setConfirming(true)}
      >
        Delete property
      </Button>
    );
  }

  return (
    <section
      className="rounded-lg border border-error-border bg-error-surface p-4"
      aria-labelledby="delete-property-title"
    >
      <h2 id="delete-property-title" className="text-title-sm text-error">
        Delete {propertyName}?
      </h2>
      <p className="mt-2 text-sm text-ink">
        This removes the property from guest discovery and active management.
        Booking, payment, and audit history remains protected.
      </p>
      <label
        htmlFor={`delete-property-${propertyId}`}
        className="mt-4 block text-sm font-semibold text-ink"
      >
        Type <span className="font-mono">{propertyName}</span> to confirm
      </label>
      <Input
        id={`delete-property-${propertyId}`}
        className="mt-2 bg-surface-raised"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        autoComplete="off"
      />
      {error && (
        <p className="mt-3 text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="danger"
          disabled={busy || confirmation.trim() !== propertyName}
          onClick={() => void remove()}
        >
          {busy ? "Deleting…" : "Delete from listings"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setConfirming(false);
            setConfirmation("");
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </section>
  );
}
