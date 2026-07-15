import Link from "next/link";
import { formatNairaFromKobo } from "@/lib/format";
import type { PropertySummary } from "@/lib/types";
import { StatusBadge, VerifiedBadge } from "./badge";
import { OptimizedFillImage } from "./optimized-fill-image";

export function PropertyCard({
  property,
  href,
  actionLabel,
  variant = "default",
}: {
  property: PropertySummary;
  href: string;
  actionLabel?: string;
  variant?: "default" | "assistant";
}) {
  const assistant = variant === "assistant";
  const resolvedActionLabel =
    actionLabel ?? (assistant ? "View stay" : "Manage");

  return (
    <Link
      href={href}
      className={`group surface-card flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md ${assistant ? "rounded-lg" : ""}`}
    >
      <div
        className={`relative bg-gradient-to-br from-indigo-500 to-indigo-800 ${assistant ? "aspect-[16/8]" : "aspect-[16/10]"}`}
      >
        {property.coverImageUrl ? (
          <OptimizedFillImage
            src={property.coverImageUrl}
            alt={property.name}
            sizes={
              assistant
                ? "(min-width: 768px) 360px, 88vw"
                : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            }
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        {(property.status === "APPROVED" || !assistant) && (
          <div className="absolute left-3 top-3">
            {property.status === "APPROVED" ? (
              <VerifiedBadge />
            ) : (
              <StatusBadge status={property.status} />
            )}
          </div>
        )}
      </div>
      <div className={`flex flex-1 flex-col ${assistant ? "p-3" : "p-4"}`}>
        <h3 className="text-title-sm truncate">{property.name}</h3>
        <p className="text-caption mt-1">{property.cityName}, Nigeria</p>
        <div
          className={`mt-auto flex items-end justify-between border-t border-border ${assistant ? "pt-2.5" : "pt-3"}`}
        >
          <div>
            <p className="text-ink">
              <span className="text-lg font-bold">
                {property.fromPriceKobo == null
                  ? "Price on request"
                  : formatNairaFromKobo(property.fromPriceKobo)}
              </span>
              {property.fromPriceKobo != null && (
                <span className="text-caption"> / night</span>
              )}
            </p>
            <p className="text-caption">
              {property.roomTypeCount} room type
              {property.roomTypeCount === 1 ? "" : "s"}
            </p>
          </div>
          <span className="text-sm font-semibold text-primary">
            {resolvedActionLabel} →
          </span>
        </div>
      </div>
    </Link>
  );
}
