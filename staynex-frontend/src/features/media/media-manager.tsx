"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OptimizedFillImage } from "@/ui";
import { apiErrorMessage, hostApi, uploadToTarget } from "@/lib/api";
import { prepareImageForUpload } from "@/lib/image-downscale";
import type { MediaItem } from "@/lib/types";

export type MediaTarget =
  | { kind: "property"; id: string }
  | { kind: "room"; id: string };

interface UploadJob {
  id: number;
  name: string;
  phase: "preparing" | "uploading" | "attaching" | "error";
  /** 0..1 while uploading. */
  progress: number;
  error?: string;
}

let nextJobId = 1;

/**
 * Full gallery management for a property or room type: multi-file upload with
 * client-side downscaling and real progress, plus delete, reorder, cover
 * selection, and alt text. The first photo is the cover everywhere the listing
 * renders. Server state is the source of truth — every mutation ends in
 * router.refresh(); local order is only an optimistic mirror.
 */
export function MediaManager({
  target,
  media,
  heading = "Photos",
  description,
}: {
  target: MediaTarget;
  media: MediaItem[];
  heading?: string;
  description?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaItem[]>(media);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [altEditingId, setAltEditingId] = useState<string | null>(null);
  const [altDraft, setAltDraft] = useState("");
  const [pending, setPending] = useState(false);

  // Server refresh delivers the authoritative gallery; mirror it.
  useEffect(() => setItems(media), [media]);

  const api =
    target.kind === "property"
      ? {
          scope: "property" as const,
          attach: (key: string) => hostApi.attachPropertyMedia(target.id, { key }),
          remove: (mediaId: string) => hostApi.deletePropertyMedia(mediaId),
          saveAlt: (mediaId: string, alt: string | null) =>
            hostApi.updatePropertyMediaAlt(mediaId, alt),
          reorder: (ids: string[]) => hostApi.reorderPropertyMedia(target.id, ids),
        }
      : {
          scope: "room" as const,
          attach: (key: string) => hostApi.attachRoomMedia(target.id, { key }),
          remove: (mediaId: string) => hostApi.deleteRoomMedia(mediaId),
          saveAlt: (mediaId: string, alt: string | null) =>
            hostApi.updateRoomMediaAlt(mediaId, alt),
          reorder: (ids: string[]) => hostApi.reorderRoomMedia(target.id, ids),
        };

  function updateJob(id: number, patch: Partial<UploadJob>) {
    setJobs((all) => all.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }

  async function onFilesPicked(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setActionError(null);

    // Sequential: keeps per-file progress honest and stays well inside the
    // upload-url rate limit.
    for (const file of files) {
      const job: UploadJob = { id: nextJobId++, name: file.name, phase: "preparing", progress: 0 };
      setJobs((all) => [...all, job]);
      try {
        const prepared = await prepareImageForUpload(file);
        const uploadTarget = await hostApi.requestUpload({
          scope: api.scope,
          filename: prepared.filename,
          contentType: prepared.contentType,
        });
        updateJob(job.id, { phase: "uploading" });
        await uploadToTarget(uploadTarget, prepared.blob, (fraction) =>
          updateJob(job.id, { progress: fraction }),
        );
        updateJob(job.id, { phase: "attaching", progress: 1 });
        await api.attach(uploadTarget.key);
        setJobs((all) => all.filter((j) => j.id !== job.id));
      } catch (err) {
        updateJob(job.id, {
          phase: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    }
    router.refresh();
  }

  async function applyOrder(nextOrder: MediaItem[]) {
    const previous = items;
    setItems(nextOrder);
    setPending(true);
    setActionError(null);
    try {
      await api.reorder(nextOrder.map((m) => m.id));
      router.refresh();
    } catch (err) {
      setItems(previous);
      setActionError(apiErrorMessage(err, "Couldn't save the new photo order."));
    } finally {
      setPending(false);
    }
  }

  function move(index: number, delta: -1 | 1) {
    const to = index + delta;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to], next[index]];
    void applyOrder(next);
  }

  function makeCover(index: number) {
    if (index === 0) return;
    const next = [items[index], ...items.filter((_, i) => i !== index)];
    void applyOrder(next);
  }

  async function remove(mediaId: string) {
    setConfirmDeleteId(null);
    setPending(true);
    setActionError(null);
    try {
      await api.remove(mediaId);
      setItems((all) => all.filter((m) => m.id !== mediaId));
      router.refresh();
    } catch (err) {
      setActionError(apiErrorMessage(err, "Couldn't delete this photo."));
    } finally {
      setPending(false);
    }
  }

  async function saveAlt(mediaId: string) {
    const value = altDraft.trim();
    setAltEditingId(null);
    setPending(true);
    setActionError(null);
    try {
      await api.saveAlt(mediaId, value || null);
      setItems((all) =>
        all.map((m) => (m.id === mediaId ? { ...m, altText: value || null } : m)),
      );
      router.refresh();
    } catch (err) {
      setActionError(apiErrorMessage(err, "Couldn't save the photo description."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="surface-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-label text-ink">{heading}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Add photos
        </button>
      </div>
      {description && <p className="text-caption">{description}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onFilesPicked}
        className="sr-only"
        aria-label="Choose photos to upload"
      />

      {items.length === 0 && jobs.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-caption">
          No photos yet. Large photos are resized automatically — add your best shots.
        </p>
      )}

      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((m, index) => (
            <li key={m.id} className="space-y-1.5">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-secondary">
                <OptimizedFillImage
                  src={m.url}
                  alt={m.altText ?? `Photo ${index + 1}`}
                  sizes="(min-width: 640px) 200px, 45vw"
                  quality={75}
                  className="absolute inset-0 size-full object-cover"
                />
                {index === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-ink/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    Cover
                  </span>
                )}
              </div>

              {confirmDeleteId === m.id ? (
                <div className="flex items-center justify-between gap-1">
                  <span className="text-caption font-medium text-error">Delete photo?</span>
                  <span className="flex gap-1">
                    <TileButton label="Confirm delete" onClick={() => void remove(m.id)}>
                      Yes
                    </TileButton>
                    <TileButton label="Keep photo" onClick={() => setConfirmDeleteId(null)}>
                      No
                    </TileButton>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <TileButton
                    label="Move earlier"
                    onClick={() => move(index, -1)}
                    disabled={pending || index === 0}
                  >
                    ←
                  </TileButton>
                  <TileButton
                    label="Move later"
                    onClick={() => move(index, 1)}
                    disabled={pending || index === items.length - 1}
                  >
                    →
                  </TileButton>
                  {index > 0 && (
                    <TileButton
                      label="Make cover photo"
                      onClick={() => makeCover(index)}
                      disabled={pending}
                    >
                      Cover
                    </TileButton>
                  )}
                  <TileButton
                    label="Edit photo description"
                    onClick={() => {
                      setAltEditingId(m.id);
                      setAltDraft(m.altText ?? "");
                    }}
                    disabled={pending}
                  >
                    Alt
                  </TileButton>
                  <TileButton
                    label="Delete photo"
                    onClick={() => setConfirmDeleteId(m.id)}
                    disabled={pending}
                    tone="danger"
                  >
                    ✕
                  </TileButton>
                </div>
              )}

              {altEditingId === m.id && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveAlt(m.id);
                  }}
                  className="flex gap-1"
                >
                  <input
                    autoFocus
                    value={altDraft}
                    onChange={(e) => setAltDraft(e.target.value)}
                    maxLength={200}
                    placeholder="Describe this photo"
                    aria-label="Photo description"
                    className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm"
                  />
                  <TileButton label="Save description" type="submit">
                    Save
                  </TileButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {jobs.length > 0 && (
        <ul className="space-y-1.5">
          {jobs.map((job) => (
            <li key={job.id} className="space-y-1 rounded-lg border border-border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-caption text-ink">{job.name}</span>
                {job.phase === "error" ? (
                  <button
                    type="button"
                    onClick={() => setJobs((all) => all.filter((j) => j.id !== job.id))}
                    className="text-caption font-medium text-muted-foreground hover:text-ink"
                  >
                    Dismiss
                  </button>
                ) : (
                  <span className="shrink-0 text-caption text-muted-foreground">
                    {job.phase === "preparing" && "Preparing…"}
                    {job.phase === "uploading" && `${Math.round(job.progress * 100)}%`}
                    {job.phase === "attaching" && "Saving…"}
                  </span>
                )}
              </div>
              {job.phase === "error" ? (
                <p className="text-caption text-error" role="alert">
                  {job.error}
                </p>
              ) : (
                <div className="h-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200"
                    style={{
                      width: `${job.phase === "preparing" ? 5 : Math.max(8, Math.round(job.progress * 100))}%`,
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {actionError && (
        <p className="text-sm text-error" role="alert">
          {actionError}
        </p>
      )}
    </div>
  );
}

function TileButton({
  label,
  onClick,
  type = "button",
  disabled,
  tone,
  children,
}: {
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === "danger"
          ? "text-error hover:border-error/40 hover:bg-error-surface"
          : "text-muted-foreground hover:bg-secondary hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
