import { PropertyForm } from "@/features/properties/property-form";
import { getCities } from "@/lib/server-host";

export const dynamic = "force-dynamic";

export default async function NewPropertyPage() {
  const result = await getCities();
  const unavailableReason =
    result.status === "unavailable"
      ? result.reason
      : result.status === "empty"
        ? "No live destinations are configured yet. A platform manager must add one before a property can be created."
        : undefined;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-title-lg text-ink">New property</h1>
        <p className="text-muted-foreground">
          Start with a draft. You can add room types and photos next.
        </p>
      </header>
      <PropertyForm
        cities={result.data ?? []}
        citiesAvailable={result.status === "data"}
        citiesUnavailableReason={unavailableReason}
        citiesRetryHref="/host/properties/new?retry=cities"
      />
    </div>
  );
}
