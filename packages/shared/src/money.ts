// Money formatting for the Staynex clients.
//
// The API returns every amount as an integer in minor units (kobo, NGN x 100).
// This is the ONLY place currency conversion and the currency symbol live, so
// callers never divide by 100 or hardcode a symbol at the render layer.

const NGN_FORMATTER = new Intl.NumberFormat("en-NG", {
  maximumFractionDigits: 0,
});

/**
 * Format integer minor units (kobo) as a Naira string, e.g. `4500000` -> `₦45,000`.
 * `null`/`undefined` (e.g. a property with no priced rooms yet) renders as `—`.
 *
 * Matches `staynex-frontend/src/lib/format.ts` so web and mobile agree.
 */
export function formatKoboToNGN(kobo: number | null | undefined): string {
  if (kobo == null) return "—";
  return `₦${NGN_FORMATTER.format(Math.round(kobo / 100))}`;
}
