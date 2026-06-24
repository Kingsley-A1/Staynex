/** Format integer minor units (kobo) as Naira. */
export function formatNairaFromKobo(kobo: number | null): string {
  if (kobo == null) return "—";
  return `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}

/** Format an ISO date as a short, locale-friendly label. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
