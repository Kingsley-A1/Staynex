import { Stars } from "./stars";
import type { PublicTestimonial } from "@/lib/types";

export function TestimonialCard({ review }: { review: PublicTestimonial }) {
  return (
    <figure className="surface-card flex h-full flex-col gap-3 p-5">
      <Stars rating={review.rating} />
      {review.title && <figcaption className="font-semibold text-ink">{review.title}</figcaption>}
      <blockquote className="text-body-sm text-muted-foreground">“{review.body}”</blockquote>
      <div className="mt-auto border-t border-border pt-3 text-caption">
        <span className="font-medium text-ink">{review.guestName ?? "Verified guest"}</span> ·{" "}
        {review.propertyName}, {review.cityName}
      </div>
    </figure>
  );
}
