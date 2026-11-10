import { PropertyCard } from "@/ui";
import { SearchPanel } from "@/features/booking/search-panel";
import { RecoveryNotice } from "@/components/recovery-notice";
import { searchProperties } from "@/lib/server-catalog";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    city?: string;
    area?: string;
    checkIn?: string;
    checkOut?: string;
    checkin?: string;
    checkout?: string;
    adults?: string;
    children?: string;
    infants?: string;
    guests?: string;
  }>;
}) {
  const raw = await searchParams;
  const sp = {
    city: raw.city,
    area: raw.area,
    checkIn: raw.checkIn ?? raw.checkin,
    checkOut: raw.checkOut ?? raw.checkout,
    // Legacy `guests` links map onto adults so older URLs keep working.
    adults: raw.adults ?? raw.guests,
    children: raw.children,
    infants: raw.infants,
  };
  const city = (sp.city ?? "").trim();
  const occupants =
    Math.max(1, Number(sp.adults) || 1) + Math.max(0, Number(sp.children) || 0);

  const detailQs = new URLSearchParams();
  if (sp.checkIn) detailQs.set("checkIn", sp.checkIn);
  if (sp.checkOut) detailQs.set("checkOut", sp.checkOut);
  if (sp.adults) detailQs.set("adults", sp.adults);
  if (sp.children) detailQs.set("children", sp.children);
  if (sp.infants) detailQs.set("infants", sp.infants);
  const qs = detailQs.toString();

  const result = city
    ? await searchProperties({
        city,
        area: sp.area,
        checkIn: sp.checkIn,
        checkOut: sp.checkOut,
        guests: occupants,
      })
    : null;
  const items = result?.data ?? [];
  const retryQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value) retryQuery.set(key, value);
  }
  const retryHref = `/search?${retryQuery.toString()}`;

  return (
    <main className="layout-container py-8">
      {!city ? (
        // Empty state: a focused, centered search box with the heading on top.
        <div className="mx-auto max-w-2xl space-y-6">
          <header className="text-center">
            <h1 className="text-title-lg text-ink">Search stays</h1>
            <p className="text-muted-foreground">
              Choose a city and dates to begin.
            </p>
          </header>
          <SearchPanel defaults={sp} />
        </div>
      ) : (
        <div className="space-y-6">
          <header>
            <h1 className="text-title-lg text-ink">Stays in {city}</h1>
            <p className="text-muted-foreground">
              {items.length} result{items.length === 1 ? "" : "s"}
            </p>
          </header>

          {result && result.status === "unavailable" && (
            <RecoveryNotice
              title="Live stays are temporarily unavailable"
              reason={`${result.reason} Results are withheld because availability and pricing must come from the live service.`}
              retryHref={retryHref}
              secondaryAction={{ label: "Change search", href: "/search" }}
            />
          )}

          {result && result.status === "empty" && (
            <div className="surface-card p-10 text-center text-muted-foreground">
              No approved stays found for {city}.
            </div>
          )}

          {result && result.status === "data" && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <PropertyCard
                  key={p.id}
                  property={p}
                  href={`/stays/${p.slug}${qs ? `?${qs}` : ""}`}
                  actionLabel="View"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
