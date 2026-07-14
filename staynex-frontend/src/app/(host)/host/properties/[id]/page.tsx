import { notFound } from "next/navigation";
import { LinkButton, StatusBadge } from "@/ui";
import { PropertyForm } from "@/features/properties/property-form";
import { ReviewStatusPanel } from "@/features/properties/review-status-panel";
import { RoomManager } from "@/features/properties/room-manager";
import { AvailabilityEditor } from "@/features/properties/availability-editor";
import { SubmitForReview } from "@/features/properties/submit-for-review";
import { MediaManager } from "@/features/media/media-manager";
import { getCities, getHostProperty } from "@/lib/server-host";

export const dynamic = "force-dynamic";

export default async function EditPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [property, cities] = await Promise.all([
    getHostProperty(id),
    getCities(),
  ]);
  if (!property) notFound();
  const availabilityFrom = new Date().toISOString().slice(0, 10);
  const availabilityTo = addUtcDays(availabilityFrom, 29);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title-lg text-ink">{property.name}</h1>
          <p className="text-muted-foreground">{property.cityName}, Nigeria</p>
        </div>
        <div className="flex items-center gap-3">
          {property.status === "APPROVED" && (
            <LinkButton
              href={`/stays/${property.slug}`}
              variant="secondary"
              size="sm"
            >
              View live listing
            </LinkButton>
          )}
          <StatusBadge status={property.status} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section id="property-details" className="scroll-mt-24 space-y-3">
            <h2 className="text-title-sm text-ink">Details</h2>
            <PropertyForm
              cities={cities}
              property={property}
              initialEditing={query.edit === "details"}
            />
          </section>

          <section id="room-types" className="scroll-mt-24 space-y-3">
            <h2 className="text-title-sm text-ink">Room types &amp; units</h2>
            <RoomManager
              propertyId={property.id}
              roomTypes={property.roomTypes}
            />
          </section>

          <section id="availability" className="scroll-mt-24 space-y-3">
            <h2 className="text-title-sm text-ink">Availability</h2>
            <AvailabilityEditor
              roomTypes={property.roomTypes}
              initialFrom={availabilityFrom}
              initialTo={availabilityTo}
            />
          </section>
        </div>

        <aside className="space-y-6">
          <section id="property-photos" className="scroll-mt-24">
            <MediaManager
              target={{ kind: "property", id: property.id }}
              media={property.media}
              heading="Property photos"
              description="Guests see the cover photo first. At least 4 photos are needed to go live; large photos are resized automatically."
            />
          </section>
          <section id="review-status" className="scroll-mt-24">
            <ReviewStatusPanel property={property} />
          </section>
          <SubmitForReview propertyId={property.id} status={property.status} />
        </aside>
      </div>
    </div>
  );
}

function addUtcDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
