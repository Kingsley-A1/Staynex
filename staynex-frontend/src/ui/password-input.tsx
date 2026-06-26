"use client";

import { type InputHTMLAttributes, useId, useState } from "react";
import { cn } from "@/lib/cn";

// Password field with an accessible show/hide toggle. `invalid` paints the red
// border used for wrong-password feedback (pair with a field-level error).
export function PasswordInput({
  className,
  invalid = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const [show, setShow] = useState(false);
  const fallbackId = useId();
  const id = props.id ?? fallbackId;

  return (
    <div className="relative">
      <input
        {...props}
        id={id}
        type={show ? "text" : "password"}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-11 w-full rounded-md border bg-surface-raised pl-3 pr-11 text-sm text-ink transition-colors focus-visible:border-primary disabled:opacity-60",
          invalid ? "border-error focus-visible:border-error" : "border-input",
          className,
        )}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        tabIndex={-1}
        className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function Eye() {
  return (
    <svg {...iconProps}>
      <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg {...iconProps}>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.4 5.2A9.5 9.5 0 0 1 12 5c6 0 9.5 7 9.5 7a16 16 0 0 1-2.3 3.1" />
      <path d="M6.2 6.8A16 16 0 0 0 2.5 12s3.5 7 9.5 7a9.3 9.3 0 0 0 3-.5" />
    </svg>
  );
}
