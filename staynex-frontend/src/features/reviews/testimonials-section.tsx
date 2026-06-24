import Link from "next/link";
import { getApprovedTestimonials } from "@/lib/server-catalog";
import { TestimonialCard } from "./testimonial-card";

// Async server component. Renders only APPROVED testimonials; if there are none
// (or the API is unreachable) it renders nothing rather than fabricating reviews.
export async function TestimonialsSection() {
  const reviews = await getApprovedTestimonials(undefined, 6);
  if (reviews.length === 0) return null;

  return (
    <section className="bg-surface-sunken py-14 sm:py-16">
      <div className="layout-container">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-title-lg text-ink">What guests say</h2>
            <p className="mt-1 text-muted-foreground">Real, verified stays from real guests.</p>
          </div>
          <Link
            href="/reviews"
            className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:gap-2 sm:inline-flex"
          >
            Read all reviews
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <TestimonialCard key={r.id} review={r} />
          ))}
        </div>
      </div>
    </section>
  );
}
