import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PropertyCard, PropertyCardSkeletonGrid } from "@/ui";
import { SearchPanel } from "@/features/booking/search-panel";
import { CITIES } from "@/features/properties/fixtures";
import { searchProperties } from "@/lib/server-catalog";
import { getServerUser } from "@/lib/server-auth";
import type { PropertySummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your stays — Staynex",
  description: "Browse available stays across Staynex launch cities, neatly aggregated.",
};

export default async function StaysDashboardPage() {
  const user = await getServerUser();
  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <main className="layout-container space-y-12 py-8 sm:py-10">
      {/* Greeting + quick search render instantly */}
      <section className="space-y-5">
        <header className="space-y-1">
          <h1 className="text-display-sm text-ink">
            {firstName ? `Welcome back, ${firstName}` : "Find your next stay"}
          </h1>
          <p className="text-body-lg text-muted-foreground">
            Verified stays across our launch cities — pick up where you left off.
          </p>
        </header>
        <SearchPanel />
      </section>

      {/* Aggregated stays stream in with a mirrored skeleton */}
      <Suspense fallback={<StaysSectionsFallback />}>
        <StaysSections />
      </Suspense>

      {/* Explore by city — static, no data dependency */}
      <section className="space-y-4">
        <h2 className="text-title-md text-ink">Explore by city</h2>
        <div className="flex flex-wrap gap-2">
          {CITIES.map((c) => (
            <Link
              key={c.id}
              href={`/search?city=${encodeURIComponent(c.name)}`}
              className="inline-flex items-center rounded-full border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

interface CitySection {
  city: string;
  items: PropertySummary[];
  live: boolean;
}

async function StaysSections() {
  const sections = await Promise.all(
    CITIES.map(async (c): Promise<CitySection> => {
      const res = await searchProperties({ city: c.name });
      return { city: c.name, items: res.items, live: res.live };
    }),
  );

  const populated = sections.filter((s) => s.items.length > 0);
  const featured = populated.flatMap((s) => s.items).slice(0, 4);
  const anyLive = sections.some((s) => s.live);

  if (populated.length === 0) {
    return (
      <div className="surface-card p-10 text-center">
        <p className="text-muted-foreground">No stays to show yet.</p>
        <Link
          href="/search"
          className="mt-4 inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Search all stays
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <StaySection title="Featured stays" subtitle="Hand-picked places to start." items={featured} />
      {populated.map((s) => (
        <StaySection
          key={s.city}
          title={`Stays in ${s.city}`}
          subtitle={`${s.items.length} available`}
          href={`/search?city=${encodeURIComponent(s.city)}`}
          items={s.items.slice(0, 4)}
        />
      ))}
      {!anyLive && (
        <p className="text-caption">
          Showing sample data — live results appear when the API is connected.
        </p>
      )}
    </div>
  );
}

function StaysSectionsFallback() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-7 w-44 rounded-md" />
      <PropertyCardSkeletonGrid count={4} className="lg:grid-cols-4" />
    </div>
  );
}

function StaySection({
  title,
  subtitle,
  href,
  items,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  items: PropertySummary[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-title-md text-ink">{title}</h2>
          {subtitle && <p className="text-caption mt-0.5">{subtitle}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="shrink-0 text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
          >
            See all →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((p) => (
          <PropertyCard key={p.id} property={p} href={`/stays/${p.slug}`} actionLabel="View" />
        ))}
      </div>
    </section>
  );
}
