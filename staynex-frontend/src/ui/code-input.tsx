"use client";

import type { ChangeEvent } from "react";
import { cn } from "@/lib/cn";

export function CodeInput({
  id,
  value,
  onChange,
  length = 6,
  label = "Verification code",
  disabled = false,
  required = false,
  invalid = false,
  describedBy,
  autoFocus = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  length?: number;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}) {
  function update(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value.replace(/\D/g, "").slice(0, length));
  }

  return (
    <div
      className={cn(
        "relative grid grid-cols-6 gap-2",
        disabled && "opacity-60",
      )}
    >
      {Array.from({ length }, (_, index) => (
        <span
          key={index}
          aria-hidden
          className={cn(
            "grid aspect-square min-w-0 place-items-center rounded-md border bg-surface-raised text-xl font-semibold text-ink transition-colors",
            value.length === index
              ? "border-primary"
              : "border-input",
            invalid && "border-error",
          )}
        >
          {value[index] ?? ""}
        </span>
      ))}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern={`[0-9]{${length}}`}
        maxLength={length}
        value={value}
        onChange={update}
        autoComplete="one-time-code"
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        className="absolute inset-0 z-10 size-full cursor-text border-0 bg-transparent text-transparent caret-transparent outline-none"
      />
    </div>
  );
}
