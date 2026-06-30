import { LinkButton, PropertyCard } from "@/ui";
import { getOwnerProperties } from "@/lib/server-owner";

export const dynamic = "force-dynamic";

export default async function OwnerPropertiesPage() {
  const properties = (await getOwnerProperties()) ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title-lg text-ink">Properties</h1>
          <p className="text-muted-foreground">Create and manage your listings.</p>
        </div>
        <LinkButton href="/owner/properties/new">New property</LinkButton>
      </header>

      {properties.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <p className="text-muted-foreground">No properties yet.</p>
          <LinkButton href="/owner/properties/new" className="mt-4">
            Create your first property
          </LinkButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <PropertyCard key={p.id} property={p} href={`/owner/properties/${p.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
