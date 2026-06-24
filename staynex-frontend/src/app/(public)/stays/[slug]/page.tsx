import { notFound } from "next/navigation";
import { RoomGalleryCarousel } from "@/ui";
import { BookingWidget } from "@/features/booking/booking-widget";
import { getPublicProperty } from "@/lib/server-catalog";
import { formatNairaFromKobo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { property } = await getPublicProperty(slug);
  if (!property) notFound();

  const slides = property.media.map((m) => ({ id: m.id, url: m.url, altText: m.altText }));
  const rooms = property.roomTypes.map((rt) => ({
    id: rt.id,
    name: rt.name,
    basePriceKobo: rt.basePriceKobo,
    maxGuests: rt.maxGuests,
  }));

  return (
    <main className="layout-container space-y-6 py-8">
      <header>
        <h1 className="text-title-lg text-ink">{property.name}</h1>
        <p className="text-muted-foreground">{property.cityName}, Nigeria</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <RoomGalleryCarousel slides={slides} label={`${property.name} gallery`} />
          <section className="surface-card p-5">
            <h2 className="text-title-sm">About this stay</h2>
            <p className="mt-2 text-body-sm text-muted-foreground">
              {property.description ?? "No description provided."}
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="text-title-sm text-ink">Rooms</h2>
            <ul className="space-y-2">
              {property.roomTypes.map((rt) => (
                <li
                  key={rt.id}
                  className="surface-card flex items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="font-semibold text-ink">{rt.name}</p>
                    <p className="text-caption">Up to {rt.maxGuests} guests</p>
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

        <aside className="lg:sticky lg:top-20 lg:self-start">
          {rooms.length > 0 ? (
            <BookingWidget rooms={rooms} defaults={sp} />
          ) : (
            <div className="surface-card p-5 text-muted-foreground">No rooms available yet.</div>
          )}
        </aside>
      </div>
    </main>
  );
}
