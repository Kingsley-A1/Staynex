"use client";

import { type ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ownerApi, uploadToTarget } from "@/lib/api";

export function MediaUploader({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setStatus("Requesting upload URL…");
    try {
      const target = await ownerApi.requestUpload({
        scope: "property",
        filename: file.name,
        contentType: file.type || "application/octet-stream",
      });
      setStatus("Uploading…");
      await uploadToTarget(target, file);
      setStatus("Attaching…");
      await ownerApi.attachPropertyMedia(propertyId, {
        publicUrl: target.publicUrl,
      });
      setStatus("Uploaded");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus(null);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return (
    <div className="surface-card space-y-2 p-4">
      <p className="text-label text-ink">Property photos</p>
      <p className="text-caption">
        Uploads go directly to storage via a signed target, then attach to this property.
      </p>
      <label className="block">
        <span className="sr-only">Choose an image to upload</span>
        <input
          type="file"
          accept="image/*"
          onChange={onChange}
          disabled={busy}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary-hover"
        />
      </label>
      {status && <p className="text-caption">{status}</p>}
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
