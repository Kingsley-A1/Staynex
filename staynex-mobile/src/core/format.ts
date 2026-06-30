// Render-layer formatting helpers (presentation only — no business logic).
// Money formatting lives in `@staynex/shared` (`formatKoboToNGN`).

/** Format an ISO/`YYYY-MM-DD` date as a short, locale-friendly label. */
export function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** `Date` -> `YYYY-MM-DD` (local). Used to send picker dates to the API. */
export function toDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}
