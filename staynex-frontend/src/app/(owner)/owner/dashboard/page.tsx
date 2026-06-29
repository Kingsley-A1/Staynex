import { KpiCard, LinkButton, PropertyCard } from "@/ui";
import { getOwnerKpis } from "@/features/properties/fixtures";
import { getOwnerBookings } from "@/lib/server-reports";
import { getOwnerProperties } from "@/lib/server-owner";
import { formatNairaFromKobo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OwnerDashboardPage() {
  const fallback = getOwnerKpis();
  // Live booking KPIs + the owner's own listings for the signed-in owner.
  const [{ data: live }, properties] = await Promise.all([
    getOwnerBookings(),
    getOwnerProperties(),
  ]);

  const confirmed = live ? String(live.kpis.confirmedBookings) : "—";
  const pendingPayments = live ? String(live.kpis.pendingPayments) : "—";
  const availableRooms = String(live?.kpis.availableRooms ?? fallback.availableRooms);
  const earnings = live ? formatNairaFromKobo(live.kpis.netEarningsKobo) : "—";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title-lg text-ink">Dashboard</h1>
          <p className="text-muted-foreground">Your supply at a glance.</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/owner/bookings" variant="secondary">
            View bookings
          </LinkButton>
          <LinkButton href="/owner/properties/new">New property</LinkButton>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Confirmed bookings"
          value={confirmed}
          href="/owner/bookings"
          hint={live ? undefined : "Connect API for live data"}
        />
        <KpiCard label="Pending payments" value={pendingPayments} href="/owner/bookings" />
        <KpiCard label="Available rooms" value={availableRooms} href="/owner/properties" />
        <KpiCard
          label="Net earnings"
          value={earnings}
          href="/owner/bookings"
          hint={live ? "After platform fee" : "Connect API for live data"}
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-title-sm text-ink">Your properties</h2>
        {properties && properties.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p} href={`/owner/properties/${p.id}`} />
            ))}
          </div>
        ) : (
          <div className="surface-card p-8 text-center">
            <p className="text-muted-foreground">
              {properties ? "No properties yet." : "Couldn't load your properties."}
            </p>
            <LinkButton href="/owner/properties/new" className="mt-4">
              {properties ? "Create your first property" : "Add a property"}
            </LinkButton>
          </div>
        )}
      </section>
    </div>
  );
}
