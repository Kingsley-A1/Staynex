import type { ReactNode } from "react";

export function PagesHero({
  eyebrow,
  title,
  gradientText,
  intro,
  meta,
}: {
  eyebrow: string;
  title: string;
  gradientText?: string;
  intro: string;
  meta?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-[linear-gradient(135deg,#f7f7ff_0%,#eef8ff_34%,#eefcf8_68%,#fff7ed_100%)]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(120deg,rgba(39,24,125,0.13),transparent_42%),linear-gradient(300deg,rgba(20,184,166,0.16),transparent_56%),linear-gradient(0deg,rgba(245,158,11,0.12),transparent_66%)]"
      />
      <div className="layout-container relative py-14 sm:py-16 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-overline mb-4">{eyebrow}</p>
          <h1 className="font-display text-3xl font-bold tracking-normal text-ink sm:text-4xl lg:text-5xl">
            {title}
            {gradientText ? (
              <>
                {" "}
                <span className="bg-gradient-to-r from-primary via-teal-600 to-amber-600 bg-clip-text text-transparent">
                  {gradientText}
                </span>
              </>
            ) : null}
          </h1>
          <p className="mt-5 max-w-2xl text-body-lg text-muted-foreground">
            {intro}
          </p>
          {meta ? <div className="mt-6">{meta}</div> : null}
        </div>
      </div>
    </section>
  );
}
