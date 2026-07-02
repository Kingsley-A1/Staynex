import type { ReactNode } from "react";

// Presentational settings primitives (no client state) shared by guest/host/
// admin settings and the host onboarding flow. Settings are composed of small
// cards — never one giant form.

export function SettingsShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-title-lg text-ink">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </header>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function SettingsCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-title-sm text-ink">{title}</h3>
          {description && <p className="mt-0.5 text-body-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

/** A label/value row for the read view of a settings card. */
export function SettingsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-border py-2.5 first:border-t-0 first:pt-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-body-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium text-ink sm:text-right">{children}</dd>
    </div>
  );
}
