import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AnimatedGradient } from "@/components/animated-gradient";
import { RecoveryNotice } from "@/components/recovery-notice";
import { PropertyCard, PropertyCardSkeletonGrid } from "@/ui";
import { SearchPanel } from "@/features/booking/search-panel";
import { getCatalogCities, searchProperties } from "@/lib/server-catalog";
import type { PropertySummary } from "@/lib/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Your stays — Staynex",
  description:
    "Browse available stays across Staynex launch cities, neatly aggregated.",
};

export default async function StaysDashboardPage() {
  return (
    <main>
      {/* Greeting + quick search render instantly, on the same brand-gradient
          hero as the welcome page. */}
      <section className="home-hero relative overflow-hidden">
        <AnimatedGradient />
        <div className="layout-container relative z-10 space-y-5 py-10 sm:py-12">
          <header className="space-y-1">
            <h1 className="text-display-sm text-ink">Find your next stay</h1>
            <p className="text-body-lg text-muted-foreground">
              Verified stays across our launch cities — pick up where you left
              off.
            </p>
          </header>
          <div className="max-w-4xl">
            <SearchPanel />
          </div>
        </div>
      </section>

      <div className="layout-container space-y-12 py-10 sm:py-12">
        {/* Aggregated stays stream in with a mirrored skeleton */}
        <Suspense fallback={<StaysSectionsFallback />}>
          <StaysSections />
        </Suspense>
      </div>
    </main>
  );
}

interface CitySection {
  city: string;
  items: PropertySummary[];
  unavailableReason: string | null;
}

async function StaysSections() {
  const citiesResult = await getCatalogCities();
  if (citiesResult.status === "unavailable") {
    return (
      <RecoveryNotice
        title="Live destinations could not be loaded"
        reason={`${citiesResult.reason} Staynex cannot show destinations or properties until live records are verified.`}
        retryHref="/stays?retry=destinations"
        secondaryAction={{ label: "Open search", href: "/search" }}
      />
    );
  }
  if (citiesResult.status === "empty") {
    return (
      <div className="surface-card p-10 text-center text-muted-foreground">
        No destinations are published yet.
      </div>
    );
  }

  const sections = await Promise.all(
    citiesResult.data.map(async (c): Promise<CitySection> => {
      const res = await searchProperties({ city: c.name });
      return {
        city: c.name,
        items: res.data ?? [],
        unavailableReason: res.status === "unavailable" ? res.reason : null,
      };
    }),
  );

  const populated = sections.filter((s) => s.items.length > 0);
  const featured = populated.flatMap((s) => s.items).slice(0, 4);
  const unavailable = sections
    .map((section) => section.unavailableReason)
    .filter((reason): reason is string => Boolean(reason));

  if (populated.length === 0) {
    if (unavailable.length > 0) {
      return (
        <RecoveryNotice
          title="Live stays could not be loaded"
          reason={`${unavailable[0]} Results are withheld because current availability must be verified.`}
          retryHref="/stays?retry=properties"
          secondaryAction={{ label: "Open search", href: "/search" }}
        />
      );
    }
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
      {unavailable.length > 0 && (
        <RecoveryNotice
          title="Some destinations could not be refreshed"
          reason={`${unavailable[0]} The stays below are only from destinations that returned live data.`}
          retryHref="/stays?retry=properties"
          secondaryAction={{ label: "Open search", href: "/search" }}
        />
      )}
      <StaySection
        title="Featured stays"
        subtitle="Hand-picked places to start."
        items={featured}
      />
      {populated.map((s) => (
        <StaySection
          key={s.city}
          title={`Stays in ${s.city}`}
          subtitle={`${s.items.length} available`}
          href={`/search?city=${encodeURIComponent(s.city)}`}
          items={s.items.slice(0, 4)}
        />
      ))}
      <section className="space-y-4">
        <h2 className="text-title-md text-ink">Explore by city</h2>
        <div className="flex flex-wrap gap-2">
          {citiesResult.data.map((city) => (
            <Link
              key={city.id}
              href={`/search?city=${encodeURIComponent(city.name)}`}
              className="inline-flex items-center rounded-full border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              {city.name}
            </Link>
          ))}
        </div>
      </section>
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
          <PropertyCard
            key={p.id}
            property={p}
            href={`/stays/${p.slug}`}
            actionLabel="View"
          />
        ))}
      </div>
    </section>
  );
}
