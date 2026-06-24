import type { ReactNode } from "react";

// Shared chrome for static/legal pages. Concise, readable, mobile-first.
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <main className="layout-container py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-title-lg text-ink">{title}</h1>
        {intro && <p className="mt-2 text-muted-foreground">{intro}</p>}
        <div className="mt-8 space-y-6 text-body-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
        <p className="mt-10 border-t border-border pt-6 text-caption">
          This is a proof-of-concept. Content here is illustrative and not a binding legal agreement.
        </p>
      </div>
    </main>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-title-sm text-ink">{heading}</h2>
      {children}
    </section>
  );
}
