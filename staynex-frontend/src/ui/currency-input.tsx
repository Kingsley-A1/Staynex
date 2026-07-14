import { type ChangeEvent, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const control =
  "h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-ink transition-colors focus-visible:border-primary disabled:opacity-60";

interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Raw digits only, e.g. "48000" — never a formatted string. */
  value: string;
  /** Receives raw digits only; format for display, not for state. */
  onValueChange: (digitsOnly: string) => void;
}

/** Naira amount input that comma-separates thousands as the owner types. */
export function CurrencyInput({ value, onValueChange, className, ...props }: CurrencyInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onValueChange(event.target.value.replace(/[^\d]/g, ""));
  }

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={formatThousands(value)}
      onChange={handleChange}
      className={cn(control, className)}
    />
  );
}

function formatThousands(digits: string): string {
  if (!digits) return "";
  return Number(digits).toLocaleString("en-NG");
}
