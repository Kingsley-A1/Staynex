import type { ReactNode } from "react";

type Tone = "neutral" | "error";

const TONES: Record<Tone, string> = {
  neutral: "bg-secondary text-muted-foreground",
  error: "bg-error-surface text-error",
};

// Reusable, clean empty/error/offline state. Presentational only so it works in
// server and client components alike; pass actions as children.
export function ErrorState({
  title,
  message,
  icon = "!",
  tone = "neutral",
  children,
}: {
  title: string;
  message: string;
  icon?: ReactNode;
  tone?: Tone;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <div
        className={`mx-auto mb-4 grid size-14 place-items-center rounded-full text-2xl font-bold ${TONES[tone]}`}
        aria-hidden
      >
        {icon}
      </div>
      <h1 className="text-title-md text-ink">{title}</h1>
      <p className="mt-2 text-muted-foreground">{message}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
