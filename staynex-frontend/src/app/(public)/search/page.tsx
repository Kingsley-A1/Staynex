import { PropertyCard } from "@/ui";
import { SearchPanel } from "@/features/booking/search-panel";
import { searchProperties } from "@/lib/server-catalog";
import type { PropertySummary } from "@/lib/types";

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
    guests?: string;
  }>;
}) {
  const raw = await searchParams;
  const sp = {
    city: raw.city,
    area: raw.area,
    checkIn: raw.checkIn ?? raw.checkin,
    checkOut: raw.checkOut ?? raw.checkout,
    guests: raw.guests,
  };
  const city = (sp.city ?? "").trim();

  const detailQs = new URLSearchParams();
  if (sp.checkIn) detailQs.set("checkIn", sp.checkIn);
  if (sp.checkOut) detailQs.set("checkOut", sp.checkOut);
  if (sp.guests) detailQs.set("guests", sp.guests);
  const qs = detailQs.toString();

  let items: PropertySummary[] = [];
  let live = true;
  if (city) {
    const res = await searchProperties({
      city,
      area: sp.area,
      checkIn: sp.checkIn,
      checkOut: sp.checkOut,
      guests: sp.guests ? Number(sp.guests) : undefined,
    });
    items = res.items;
    live = res.live;
  }

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

          {items.length === 0 && (
            <div className="surface-card p-10 text-center text-muted-foreground">
              No approved stays found for {city}.
            </div>
          )}

          {items.length > 0 && (
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

          {!live && (
            <p className="text-caption">
              Showing sample data — live results appear when the API is connected.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
