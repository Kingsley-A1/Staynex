import { PropertyForm } from "@/features/properties/property-form";
import { getCities } from "@/lib/server-owner";

export const dynamic = "force-dynamic";

export default async function NewPropertyPage() {
  const cities = await getCities();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-title-lg text-ink">New property</h1>
        <p className="text-muted-foreground">
          Start with a draft. You can add room types and photos next.
        </p>
      </header>
      <PropertyForm cities={cities} />
    </div>
  );
}
