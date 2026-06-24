import Link from "next/link";
import { formatNairaFromKobo } from "@/lib/format";
import type { PropertySummary } from "@/lib/types";
import { StatusBadge } from "./badge";

export function PropertyCard({
  property,
  href,
  actionLabel = "Manage",
}: {
  property: PropertySummary;
  href: string;
  actionLabel?: string;
}) {
  return (
    <Link
      href={href}
      className="group surface-card block overflow-hidden transition-shadow hover:shadow-md"
    >
      <div className="relative h-36 bg-gradient-to-br from-indigo-500 to-indigo-800">
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        <div className="absolute left-3 top-3">
          <StatusBadge status={property.status} />
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-title-sm truncate">{property.name}</h3>
        <p className="text-caption mt-1">{property.cityName}, Nigeria</p>
        <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
          <div>
            <p className="text-ink">
              <span className="text-lg font-bold">
                {formatNairaFromKobo(property.fromPriceKobo)}
              </span>
              <span className="text-caption"> / night</span>
            </p>
            <p className="text-caption">
              {property.roomTypeCount} room type{property.roomTypeCount === 1 ? "" : "s"}
            </p>
          </div>
          <span className="text-sm font-semibold text-primary">{actionLabel} →</span>
        </div>
      </div>
    </Link>
  );
}
