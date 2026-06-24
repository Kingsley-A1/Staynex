/** Accessible 5-star rating display. */
export function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={`Rated ${rounded} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 24 24"
          aria-hidden
          className={`size-4 ${n <= rounded ? "text-warning" : "text-border"}`}
          fill="currentColor"
        >
          <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 17.77l-5.2 2.73.99-5.78-4.21-4.1 5.82-.85L12 3.5Z" />
        </svg>
      ))}
    </span>
  );
}
