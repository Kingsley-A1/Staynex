import { cn } from "@/lib/cn";

// Pulse placeholder that mirrors PropertyCard's layout 1:1 (aspect-[16/10] media,
// title, city, and the price/action footer row) so the swap to real cards reads
// as the same surface filling in — not a layout shift. Uses the shared `.skeleton`
// shimmer token; honours prefers-reduced-motion via motion.css.

export function PropertyCardSkeleton() {
  return (
    <div className="surface-card flex h-full flex-col overflow-hidden" aria-hidden>
      {/* Visual area ≈ 60% of the card height — matches PropertyCard */}
      <div className="skeleton aspect-[16/10] rounded-none" />
      <div className="flex flex-1 flex-col p-4">
        <div className="skeleton h-5 w-3/4 rounded-md" />
        <div className="skeleton mt-2 h-3.5 w-2/5 rounded-md" />
        <div className="mt-auto flex items-end justify-between border-t border-border pt-3">
          <div className="space-y-1.5">
            <div className="skeleton h-5 w-24 rounded-md" />
            <div className="skeleton h-3 w-16 rounded-md" />
          </div>
          <div className="skeleton h-4 w-14 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** A responsive grid of skeleton cards, matching the property grids. */
export function PropertyCardSkeletonGrid({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}
