import { notFound } from "next/navigation";
import { RoomGalleryCarousel, StatusBadge } from "@/ui";
import { ApprovalActions } from "@/features/admin/approval-actions";
import { ReviewStatusPanel } from "@/features/properties/review-status-panel";
import { formatNairaFromKobo } from "@/lib/format";
import { getAdminApproval } from "@/lib/server-reports";

export default async function ReviewPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: property, offline } = await getAdminApproval(id);
  if (!property) {
    if (offline) {
      return (
        <div className="surface-card p-8 text-center text-muted-foreground" role="status">
          We couldn't reach the approvals service. Start the API to review this submission.
        </div>
      );
    }
    notFound();
  }

  const slides = property.media.map((m) => ({ id: m.id, url: m.url, altText: m.altText }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title-lg text-ink">{property.name}</h1>
          <p className="text-muted-foreground">{property.cityName}, Nigeria</p>
        </div>
        <StatusBadge status={property.status} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <RoomGalleryCarousel slides={slides} label={`${property.name} gallery`} />

          <section className="surface-card p-5">
            <h2 className="text-title-sm">Description</h2>
            <p className="mt-2 text-body-sm text-muted-foreground">
              {property.description ?? "No description provided."}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-title-sm text-ink">Room types</h2>
            <ul className="space-y-2">
              {property.roomTypes.map((rt) => (
                <li
                  key={rt.id}
                  className="surface-card flex items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="font-semibold text-ink">{rt.name}</p>
                    <p className="text-caption">
                      up to {rt.maxGuests} guests · {rt.unitCount} unit
                      {rt.unitCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="font-semibold text-ink">
                    {formatNairaFromKobo(rt.basePriceKobo)}
                    <span className="text-caption"> / night</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <ReviewStatusPanel property={property} />
          <ApprovalActions propertyId={property.id} />
        </aside>
      </div>
    </div>
  );
}
