import { cn } from "@/lib/cn";

/**
 * AnimatedGradient — a reusable, decorative brand gradient field.
 *
 * Two crisp conic layers (the same indigo / cyan / teal / amber mix as
 * `.attention-border`) revolve very slowly in opposite directions, so the
 * colour shifts subtly rather than sweeping — calm and professional, never
 * loud. A soft white veil keeps the reading area clean while colour lives
 * toward the edges. Sharp by design: no blur, so it never looks cloudy.
 *
 * Purely presentational: `aria-hidden` and non-interactive. Motion is frozen
 * under `prefers-reduced-motion` (see motion.css) leaving a static gradient.
 *
 * Drop it into any `relative` surface as a full-bleed backdrop:
 *   <section className="relative overflow-hidden">
 *     <AnimatedGradient />
 *     <div className="relative z-10">…</div>
 *   </section>
 */
export function AnimatedGradient({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("animated-gradient", className)}>
      <span className="animated-gradient__layer animated-gradient__layer--a" />
      <span className="animated-gradient__layer animated-gradient__layer--b" />
      <span className="animated-gradient__veil" />
    </div>
  );
}
