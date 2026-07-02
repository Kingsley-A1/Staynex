import { notFound } from "next/navigation";
import { LinkButton, RoomGalleryCarousel, StatusBadge } from "@/ui";
import { PropertyForm } from "@/features/properties/property-form";
import { ReviewStatusPanel } from "@/features/properties/review-status-panel";
import { RoomManager } from "@/features/properties/room-manager";
import { SubmitForReview } from "@/features/properties/submit-for-review";
import { MediaUploader } from "@/features/media/media-uploader";
import { getCities, getOwnerProperty } from "@/lib/server-owner";

export const dynamic = "force-dynamic";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [property, cities] = await Promise.all([getOwnerProperty(id), getCities()]);
  if (!property) notFound();

  const slides = [
    ...property.media.map((m) => ({ id: m.id, url: m.url, altText: m.altText })),
    ...property.roomTypes.flatMap((rt) =>
      rt.media.map((m) => ({ id: m.id, url: m.url, altText: m.altText })),
    ),
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title-lg text-ink">{property.name}</h1>
          <p className="text-muted-foreground">{property.cityName}, Nigeria</p>
        </div>
        <div className="flex items-center gap-3">
          {property.status === "APPROVED" && (
            <LinkButton href={`/stays/${property.slug}`} variant="secondary" size="sm">
              View live listing
            </LinkButton>
          )}
          <StatusBadge status={property.status} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-title-sm text-ink">Details</h2>
            <PropertyForm cities={cities} property={property} />
          </section>

          <section className="space-y-3">
            <h2 className="text-title-sm text-ink">Room types &amp; units</h2>
            <RoomManager propertyId={property.id} roomTypes={property.roomTypes} />
          </section>
        </div>

        <aside className="space-y-6">
          <ReviewStatusPanel property={property} />
          <section className="space-y-3">
            <h2 className="text-title-sm text-ink">Gallery preview</h2>
            <RoomGalleryCarousel slides={slides} label={`${property.name} gallery`} />
          </section>
          <MediaUploader propertyId={property.id} />
          <SubmitForReview propertyId={property.id} status={property.status} />
        </aside>
      </div>
    </div>
  );
}
