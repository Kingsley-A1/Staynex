/** Format integer minor units (kobo) as Naira. */
export function formatNairaFromKobo(kobo: number | null): string {
  if (kobo == null) return "—";
  return `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}

/** Human label for a booking's occupancy split (e.g. "2 adults · 1 child"). */
export function formatOccupancy(o: {
  adults: number;
  children: number;
  infants: number;
}): string {
  const parts = [`${o.adults} adult${o.adults === 1 ? "" : "s"}`];
  if (o.children > 0) parts.push(`${o.children} child${o.children === 1 ? "" : "ren"}`);
  if (o.infants > 0) parts.push(`${o.infants} infant${o.infants === 1 ? "" : "s"}`);
  return parts.join(" · ");
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
