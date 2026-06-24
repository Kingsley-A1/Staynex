/** Date-only ISO (YYYY-MM-DD) in UTC. */
export function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The nights of a stay: [checkIn, checkOut) at UTC midnight. The checkout day is
 * not a night, so a 2-night stay returns 2 dates.
 */
export function nightsOf(checkIn: string, checkOut: string): Date[] {
  const start = new Date(`${checkIn}T00:00:00.000Z`);
  const end = new Date(`${checkOut}T00:00:00.000Z`);
  const nights: Date[] = [];
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    nights.push(new Date(d));
  }
  return nights;
}
