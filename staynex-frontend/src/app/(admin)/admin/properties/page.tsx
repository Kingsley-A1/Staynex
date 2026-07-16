import { PropertyCard } from "@/ui";
import { getAdminProperties } from "@/lib/server-reports";

export const dynamic = "force-dynamic";

export default async function AdminPropertiesPage() {
  const { data: properties, offline } = await getAdminProperties();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-title-lg text-ink">Properties</h1>
        <p className="text-muted-foreground">
          Review listing state, availability, and protected deletion controls.
        </p>
      </header>

      {!properties ? (
        <div
          className="surface-card p-8 text-center text-muted-foreground"
          role="status"
        >
          {offline
            ? "We couldn't reach property management. Check the API connection and try again."
            : "Property management is unavailable."}
        </div>
      ) : properties.length === 0 ? (
        <div className="surface-card p-8 text-center text-muted-foreground">
          No active properties.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              href={`/admin/approvals/${property.id}`}
              actionLabel="Review"
            />
          ))}
        </div>
      )}
    </div>
  );
}
