import { KpiCard, LinkButton, PropertyCard } from "@/ui";
import { RecoveryNotice } from "@/components/recovery-notice";
import { getHostBookings } from "@/lib/server-reports";
import { getHostProperties } from "@/lib/server-host";
import { formatNairaFromKobo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OwnerDashboardPage() {
  // Live booking KPIs + the owner's own listings for the signed-in owner.
  const [{ data: live }, propertiesResult] = await Promise.all([
    getHostBookings(),
    getHostProperties(),
  ]);

  const confirmed = live ? String(live.kpis.confirmedBookings) : "—";
  const pendingPayments = live ? String(live.kpis.pendingPayments) : "—";
  const availableRooms = live ? String(live.kpis.availableRooms) : "—";
  const earnings = live ? formatNairaFromKobo(live.kpis.netEarningsKobo) : "—";
  const properties = propertiesResult.data ?? [];
  const recoveryReasons = [
    !live ? "Live booking and earnings totals could not be reached." : null,
    propertiesResult.status === "unavailable" ? propertiesResult.reason : null,
  ].filter((reason): reason is string => Boolean(reason));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title-lg text-ink">Dashboard</h1>
          <p className="text-muted-foreground">Your supply at a glance.</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/host/bookings" variant="secondary">
            View bookings
          </LinkButton>
          <LinkButton href="/host/properties/new">New property</LinkButton>
        </div>
      </header>

      {recoveryReasons.length > 0 && (
        <RecoveryNotice
          title="Some live host data is temporarily unavailable"
          reason={`${recoveryReasons.join(" ")} Unavailable values are shown as dashes until live records are verified.`}
          retryHref="/host/dashboard?retry=live-data"
          secondaryAction={{ label: "View bookings", href: "/host/bookings" }}
        />
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Confirmed bookings"
          value={confirmed}
          href="/host/bookings"
          hint={live ? undefined : "Connect API for live data"}
        />
        <KpiCard
          label="Pending payments"
          value={pendingPayments}
          href="/host/bookings"
        />
        <KpiCard
          label="Available rooms"
          value={availableRooms}
          href="/host/properties"
        />
        <KpiCard
          label="Net earnings"
          value={earnings}
          href="/host/bookings"
          hint={live ? "After platform fee" : "Connect API for live data"}
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-title-sm text-ink">Your properties</h2>
        {propertiesResult.status === "unavailable" ? (
          <p className="surface-card p-6 text-sm text-muted-foreground">
            Property cards are hidden until Staynex can confirm your live
            records.
          </p>
        ) : properties.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                href={`/host/properties/${p.id}`}
              />
            ))}
          </div>
        ) : (
          <div className="surface-card p-8 text-center">
            <p className="text-muted-foreground">No properties yet.</p>
            <LinkButton href="/host/properties/new" className="mt-4">
              Create your first property
            </LinkButton>
          </div>
        )}
      </section>
    </div>
  );
}
