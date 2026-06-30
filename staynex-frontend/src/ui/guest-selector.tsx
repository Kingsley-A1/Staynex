"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface GuestCounts {
  adults: number;
  children: number;
  infants: number;
}

export function guestSummary({ adults, children, infants }: GuestCounts): string {
  const guests = adults + children;
  const parts = [`${guests} guest${guests === 1 ? "" : "s"}`];
  if (infants > 0) parts.push(`${infants} infant${infants === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/**
 * Airbnb-style occupancy selector. Adults + children count toward `maxGuests`;
 * infants are free. Controlled via `value` / `onChange`.
 */
export function GuestSelector({
  id,
  value,
  onChange,
  maxGuests = 16,
  maxInfants = 5,
  buttonClassName,
}: {
  id?: string;
  value: GuestCounts;
  onChange: (next: GuestCounts) => void;
  maxGuests?: number;
  maxInfants?: number;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const occupants = value.adults + value.children;
  const set = (patch: Partial<GuestCounts>) => onChange({ ...value, ...patch });

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-md border border-input bg-surface-raised px-3 text-left text-sm text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          buttonClassName,
        )}
      >
        <span className="truncate">{guestSummary(value)}</span>
        <svg
          viewBox="0 0 24 24"
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Select guests"
          className="absolute left-0 right-0 z-[var(--z-popover)] mt-2 space-y-1 rounded-lg border border-border bg-surface-overlay p-2 shadow-lg"
        >
          <Row
            label="Adults"
            hint="Ages 13 or above"
            value={value.adults}
            onDec={() => set({ adults: value.adults - 1 })}
            onInc={() => set({ adults: value.adults + 1 })}
            decDisabled={value.adults <= 1}
            incDisabled={occupants >= maxGuests}
          />
          <Row
            label="Children"
            hint="Ages 2–12"
            value={value.children}
            onDec={() => set({ children: value.children - 1 })}
            onInc={() => set({ children: value.children + 1 })}
            decDisabled={value.children <= 0}
            incDisabled={occupants >= maxGuests}
          />
          <Row
            label="Infants"
            hint="Under 2"
            value={value.infants}
            onDec={() => set({ infants: value.infants - 1 })}
            onInc={() => set({ infants: value.infants + 1 })}
            decDisabled={value.infants <= 0}
            incDisabled={value.infants >= maxInfants}
          />
          <p className="px-2 pb-1 pt-2 text-caption">
            This room allows up to {maxGuests} guest{maxGuests === 1 ? "" : "s"}. Infants don&apos;t
            count toward the limit.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  hint,
  value,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
}: {
  label: string;
  hint: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  decDisabled: boolean;
  incDisabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md px-2 py-2.5">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-caption">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <StepButton label={`Decrease ${label.toLowerCase()}`} onClick={onDec} disabled={decDisabled} symbol="minus" />
        <span className="w-5 text-center text-sm font-semibold text-ink tabular-nums" aria-live="polite">
          {value}
        </span>
        <StepButton label={`Increase ${label.toLowerCase()}`} onClick={onInc} disabled={incDisabled} symbol="plus" />
      </div>
    </div>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  symbol,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  symbol: "plus" | "minus";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-8 place-items-center rounded-full border border-input text-foreground transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
        <path d="M5 12h14" />
        {symbol === "plus" && <path d="M12 5v14" />}
      </svg>
    </button>
  );
}
