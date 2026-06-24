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
    guests?: string;
  }>;
}) {
  const sp = await searchParams;
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
    <main className="layout-container space-y-6 py-8">
      <SearchPanel defaults={sp} />

      <header>
        <h1 className="text-title-lg text-ink">{city ? `Stays in ${city}` : "Search stays"}</h1>
        <p className="text-muted-foreground">
          {city
            ? `${items.length} result${items.length === 1 ? "" : "s"}`
            : "Choose a city and dates to begin."}
        </p>
      </header>

      {city && items.length === 0 && (
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

      {city && !live && (
        <p className="text-caption">
          Showing sample data — live results appear when the API is connected.
        </p>
      )}
    </main>
  );
}
