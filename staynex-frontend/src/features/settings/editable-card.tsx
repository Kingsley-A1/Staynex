"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { Button } from "@/ui";
import { apiErrorMessage } from "@/lib/api";

// Editable settings card: shows a read-only summary with an Edit button. Editing
// reveals the form; Save persists and closes on success, Cancel discards. Each
// card opens/saves/closes independently — settings are never one giant form.
export function EditableCard({
  title,
  description,
  summary,
  form,
  onSave,
  onEdit,
  onCancel,
  editLabel = "Edit",
  saveLabel = "Save changes",
  canSave = true,
  disabled = false,
  initialEditing = false,
}: {
  title: string;
  description?: string;
  summary: ReactNode;
  form: ReactNode;
  onSave: () => Promise<void>;
  onEdit?: () => void;
  onCancel?: () => void;
  editLabel?: string;
  saveLabel?: string;
  canSave?: boolean;
  disabled?: boolean;
  initialEditing?: boolean;
}) {
  const [editing, setEditing] = useState(initialEditing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setError(null);
    onEdit?.();
    setEditing(true);
  }

  function cancel() {
    setError(null);
    onCancel?.();
    setEditing(false);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave();
      setEditing(false);
    } catch (err) {
      setError(
        apiErrorMessage(err, "Couldn't save your changes. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-title-sm text-ink">{title}</h3>
          {description && (
            <p className="mt-0.5 text-body-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {!editing && !disabled && (
          <Button variant="secondary" size="sm" onClick={startEdit}>
            {editLabel}
          </Button>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-4 space-y-4">
          {form}
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !canSave}>
              {busy ? "Saving…" : saveLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={cancel}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4">{summary}</div>
      )}
    </section>
  );
}
