import type { ReactNode } from "react";
import { PagesHero } from "@/components/pages-hero";

export function LegalPage({
  eyebrow,
  title,
  gradientText,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  gradientText?: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main>
      <PagesHero
        eyebrow={eyebrow}
        title={title}
        gradientText={gradientText}
        intro={intro}
      />
      <section className="layout-container py-12 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-8">{children}</div>
      </section>
    </main>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="scroll-mt-24 border-b border-border pb-8 last:border-b-0">
      <h2 className="text-title-md tracking-normal text-ink">{heading}</h2>
      <div className="mt-3 space-y-3 text-body-md leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export function GradientText({ children }: { children: ReactNode }) {
  return (
    <strong className="bg-gradient-to-r from-primary via-teal-600 to-amber-600 bg-clip-text font-semibold text-transparent">
      {children}
    </strong>
  );
}
