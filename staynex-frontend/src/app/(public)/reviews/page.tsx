import type { Metadata } from "next";
import { getApprovedTestimonials } from "@/lib/server-catalog";
import { TestimonialCard } from "@/features/reviews/testimonial-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Guest reviews — Staynex",
  description: "Real, verified testimonials from Staynex guests.",
};

export default async function ReviewsPage() {
  const reviews = await getApprovedTestimonials(undefined, 48);

  return (
    <main className="layout-container space-y-6 py-10">
      <header className="max-w-2xl">
        <h1 className="text-title-lg text-ink">Guest reviews</h1>
        <p className="mt-1 text-muted-foreground">
          Every review here comes from a real, confirmed booking and is approved before it appears.
        </p>
      </header>

      {reviews.length === 0 ? (
        <div className="surface-card p-10 text-center text-muted-foreground">
          No reviews published yet. Check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <TestimonialCard key={r.id} review={r} />
          ))}
        </div>
      )}
    </main>
  );
}
