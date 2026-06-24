import { KpiCard, LinkButton, PropertyCard } from "@/ui";
import { getOwnerKpis, listOwnerProperties } from "@/features/properties/fixtures";
import { formatNairaFromKobo } from "@/lib/format";

export default function OwnerDashboardPage() {
  const kpis = getOwnerKpis();
  const properties = listOwnerProperties();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title-lg text-ink">Dashboard</h1>
          <p className="text-muted-foreground">Your supply at a glance.</p>
        </div>
        <LinkButton href="/owner/properties/new">New property</LinkButton>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Bookings" value={String(kpis.totalBookings)} hint="Live in Phase 3" />
        <KpiCard label="Available rooms" value={String(kpis.availableRooms)} />
        <KpiCard
          label="Pending actions"
          value={String(kpis.pendingActions)}
          hint="Drafts + in review"
        />
        <KpiCard
          label="Est. earnings"
          value={formatNairaFromKobo(kpis.estimatedEarningsKobo)}
          hint="Live in Phase 3"
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-title-sm text-ink">Your properties</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <PropertyCard key={p.id} property={p} href={`/owner/properties/${p.id}`} />
          ))}
        </div>
      </section>
    </div>
  );
}
