import { cn } from "@/lib/cn";

export interface Step {
  id: string;
  title: string;
}

export function Stepper({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="Progress">
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "upcoming";
        return (
          <li key={step.id} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "grid size-7 place-items-center rounded-full text-xs font-semibold",
                  state === "done" && "bg-primary text-primary-foreground",
                  state === "current" && "border-2 border-primary text-primary",
                  state === "upcoming" && "border border-border text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "text-sm",
                  state === "upcoming" ? "text-muted-foreground" : "font-medium text-ink",
                )}
              >
                {step.title}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className="hidden h-px w-8 bg-border sm:block" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
