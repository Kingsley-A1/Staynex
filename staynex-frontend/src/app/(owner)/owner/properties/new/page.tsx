import { PropertyForm } from "@/features/properties/property-form";
import { CITIES } from "@/features/properties/fixtures";

export default function NewPropertyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-title-lg text-ink">New property</h1>
        <p className="text-muted-foreground">
          Start with a draft. You can add room types and photos next.
        </p>
      </header>
      <PropertyForm cities={CITIES} />
    </div>
  );
}
