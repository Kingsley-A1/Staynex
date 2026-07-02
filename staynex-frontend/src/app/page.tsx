import type { Metadata } from "next";
import Link from "next/link";
import { Brandmark } from "@/components/brandmark";
import { SiteFooter } from "@/components/site-footer";
import { SearchPanel } from "@/features/booking/search-panel";
import { TestimonialsSection } from "@/features/reviews/testimonials-section";
import { ClientHeaderAuthControls } from "@/features/auth/client-header-auth-controls";
import { DestinationImageCycle } from "@/features/landing/destination-image-cycle";
import { formatNairaFromKobo } from "@/lib/format";
import { getHomeCatalog } from "@/lib/server-catalog";
import { OptimizedFillImage } from "@/ui";
import type { DestinationShowcase, PropertySummary } from "@/lib/types";

export const metadata: Metadata = {
  title: "Staynex — Book trusted stays",
  description:
    "Book trusted stays across Nigeria and beyond. Verified properties, secure payments, and real-time availability.",
};

export const revalidate = 300;

const DESTINATIONS = [
  {
    city: "Calabar",
    gradient: "from-indigo-500 to-teal-800",
    fallbackImageUrl: "/assets/destinations/calabar.jpg",
  },
  {
    city: "Lagos",
    gradient: "from-sky-500 to-indigo-900",
    fallbackImageUrl: "/assets/destinations/lagos.jpg",
  },
  {
    city: "Abuja",
    gradient: "from-neutral-600 to-indigo-900",
    fallbackImageUrl: "/assets/destinations/abuja.jpg",
  },
  {
    city: "Port Harcourt",
    gradient: "from-teal-500 to-indigo-800",
    fallbackImageUrl: "/assets/destinations/port-harcourt.jpg",
  },
  {
    city: "Uyo",
    gradient: "from-amber-500 to-indigo-900",
    fallbackImageUrl: "/assets/destinations/uyo.jpg",
  },
];

const FEATURES = [
  {
    title: "Verified stays",
    desc: "Every property is reviewed and approved before it goes live.",
    icon: IconShield,
  },
  {
    title: "Secure payments",
    desc: "Pay safely with Paystack. Your booking is protected end to end.",
    icon: IconLock,
  },
  {
    title: "Real-time availability",
    desc: "Live calendars mean confirmed rooms and no double bookings.",
    icon: IconCalendar,
  },
  {
    title: "Always supported",
    desc: "Local help whenever you travel, wherever you go next.",
    icon: IconHeadset,
  },
];

/* ============================================================================
   Page
   ========================================================================== */
export default async function HomePage() {
  const home = await getHomeCatalog();
  return (
    <div className="bg-white">
      <SiteHeader />

      <main id="main">
        <Hero />
        <Destinations destinations={home.catalog.destinations} />
        <FeaturedStays
          latest={home.catalog.latestProperties}
          mostBooked={home.catalog.mostBookedProperties}
          live={home.live}
        />
        <TestimonialsSection />
        <ValueProps />
        <HostCta />
      </main>

      <SiteFooter />
    </div>
  );
}

/* ============================================================================
   Header
   ========================================================================== */
function SiteHeader() {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border bg-white">
      <div className="layout-container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center" aria-label="Staynex home">
          <Brandmark />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <Link href="/search" className="transition-colors hover:text-ink">
            Stays
          </Link>
          <Link href="/search" className="transition-colors hover:text-ink">
            Destinations
          </Link>
          <Link
            href="/list-your-property"
            className="transition-colors hover:text-ink"
          >
            List your property
          </Link>
        </nav>

        <ClientHeaderAuthControls />
      </div>
    </header>
  );
}

/* ============================================================================
   Hero + search
   ========================================================================== */
function Hero() {
  return (
    <section className="home-hero relative overflow-hidden">
      <div className="layout-container relative py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-overline mb-4">Verified stays · Secure payments</p>
          <h1 className="font-display text-3xl font-bold tracking-tighter text-ink sm:text-4xl lg:text-5xl">
            Book trusted stays,
            <br className="hidden sm:block" />{" "}
            <span className="text-primary">Confidently.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-md leading-relaxed text-muted-foreground">
            Search verified hotels, resorts, and apartments with real-time
            availability and secure payments — from Calabar to anywhere you go.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-4xl">
          <SearchPanel />
        </div>

        <ul className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {[
            "Secure Paystack payments",
            "Verified properties",
            "Instant confirmation",
          ].map((t) => (
            <li key={t} className="inline-flex items-center gap-1.5">
              <IconCheck className="size-4 text-success" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ============================================================================
   Destinations
   ========================================================================== */
function Destinations({
  destinations,
}: {
  destinations: DestinationShowcase[];
}) {
  const liveByCity = new Map(
    destinations.map((destination) => [
      destination.cityName.toLowerCase(),
      destination,
    ]),
  );

  return (
    <section className="layout-container py-14 sm:py-16">
      <SectionHead
        title="Launch cities"
        subtitle="Explore stays across our launch cities."
        href="/search"
        linkLabel="View all"
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {DESTINATIONS.map((d) => {
          const live = liveByCity.get(d.city.toLowerCase());
          const stayCount = live?.stayCount ?? 0;
          return (
            <Link
              key={d.city}
              href={`/search?city=${encodeURIComponent(d.city)}`}
              className="group relative block aspect-[4/5] overflow-hidden rounded-lg"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${d.gradient}`}
              />
              <DestinationImageCycle
                city={d.city}
                fallbackImageUrl={d.fallbackImageUrl}
                propertyImageUrls={live?.propertyImageUrls ?? []}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="font-semibold text-white">{d.city}</p>
                <p className="text-2xs text-white/80">
                  {stayCount > 0
                    ? `${stayCount} live ${stayCount === 1 ? "stay" : "stays"}`
                    : "Coming soon"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ============================================================================
   Featured stays
   ========================================================================== */
function FeaturedStays({
  latest,
  mostBooked,
  live,
}: {
  latest: PropertySummary[];
  mostBooked: PropertySummary[];
  live: boolean;
}) {
  const hasLatest = latest.length > 0;
  const hasMostBooked = mostBooked.length > 0;

  return (
    <section className="border-y border-border/60 py-14 sm:py-16">
      <div className="layout-container">
        <div className="space-y-10">
          <LiveStaySection
            title="Latest stays"
            subtitle="Recently approved properties uploaded by hosts."
            href="/search"
            linkLabel="Browse all stays"
            items={latest.slice(0, 4)}
            tag="New"
          />
          {hasMostBooked && (
            <LiveStaySection
              title="Most booked"
              subtitle="Properties with confirmed booking activity."
              href="/search"
              linkLabel="See popular stays"
              items={mostBooked.slice(0, 4)}
              tag="Popular"
            />
          )}
          {!hasLatest && (
            <div className="surface-card p-8 text-center">
              <h3 className="text-title-sm text-ink">
                Live stays will appear here.
              </h3>
              <p className="mx-auto mt-2 max-w-md text-body-sm text-muted-foreground">
                Once approved properties are uploaded, this section will show the
                newest stays and booking-driven popular stays automatically.
              </p>
              {!live && (
                <p className="mt-3 text-caption">
                  The live catalog API is not reachable right now.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LiveStaySection({
  title,
  subtitle,
  href,
  linkLabel,
  items,
  tag,
}: {
  title: string;
  subtitle: string;
  href: string;
  linkLabel: string;
  items: PropertySummary[];
  tag: string;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <SectionHead
        title={title}
        subtitle={subtitle}
        href={href}
        linkLabel={linkLabel}
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((property) => (
          <StayCard key={property.id} property={property} tag={tag} />
        ))}
      </div>
    </section>
  );
}

function StayCard({
  property,
  tag,
}: {
  property: PropertySummary;
  tag: string;
}) {
  return (
    <Link
      href={`/stays/${property.slug}`}
      className="group surface-card block overflow-hidden transition-shadow hover:shadow-md"
    >
      <div className="relative h-44 bg-gradient-to-br from-indigo-500 to-indigo-800">
        {property.coverImageUrl && (
          <OptimizedFillImage
            src={property.coverImageUrl}
            alt={property.name}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <span
          className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-success-border bg-success-surface px-2.5 py-1 text-2xs font-semibold text-success"
        >
          <span className="size-1.5 rounded-full bg-success" />
          Verified
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-2xs font-medium text-ink">
          {tag}
        </span>
      </div>

      <div className="p-4">
        <h3 className="text-title-sm truncate">{property.name}</h3>
        <p className="mt-1 inline-flex items-center gap-1.5 text-muted-foreground">
          <IconPin className="size-4" />
          <span className="text-caption">{property.cityName}, Nigeria</span>
        </p>

        <p className="mt-3 text-caption">
          {property.roomTypeCount} room type
          {property.roomTypeCount === 1 ? "" : "s"}
        </p>

        <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
          <p className="text-ink">
            <span className="text-lg font-bold">
              {formatNairaFromKobo(property.fromPriceKobo)}
            </span>
            <span className="text-caption"> / night</span>
          </p>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all group-hover:gap-2">
            View
            <IconArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ============================================================================
   Value props
   ========================================================================== */
function ValueProps() {
  return (
    <section className="layout-container py-14 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-title-lg text-ink">Why book with Staynex</h2>
        <p className="mt-2 text-muted-foreground">
          A real booking engine built to be secure by default and low-friction
          by design.
        </p>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ title, desc, icon: Icon }) => (
          <div key={title} className="surface-card p-5">
            <span className="inline-flex size-11 items-center justify-center rounded-lg bg-primary-subtle text-primary">
              <Icon className="size-5" />
            </span>
            <h3 className="text-title-sm mt-4 text-ink">{title}</h3>
            <p className="mt-1.5 text-body-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================================
   Host CTA band
   ========================================================================== */
function HostCta() {
  return (
    <section className="layout-container pb-16 sm:pb-20">
      <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-12 text-center shadow-lg sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl"
        />
        <div className="relative mx-auto max-w-2xl">
          <p className="text-overline text-white/70">For hosts</p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Turn your property into a reliable booking channel.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">
            List once and manage availability, bookings, and earnings from one
            dashboard. No upfront cost to get started.
          </p>
          <Link
            href="/list-your-property"
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-md bg-white px-6 font-semibold text-primary shadow-sm transition-transform hover:-translate-y-0.5"
          >
            List your property
            <IconArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ============================================================================
   Small shared pieces
   ========================================================================== */
function SectionHead({
  title,
  subtitle,
  href,
  linkLabel,
}: {
  title: string;
  subtitle: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-title-lg text-ink">{title}</h2>
        <p className="mt-1 text-muted-foreground">{subtitle}</p>
      </div>
      <Link
        href={href}
        className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary transition-all hover:gap-2 sm:inline-flex"
      >
        {linkLabel}
        <IconArrowRight className="size-4" />
      </Link>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Icons — inline SVG, 24px grid, 1.5 stroke, currentColor (consistent set).
   ---------------------------------------------------------------------------- */
type IconProps = { className?: string };
const svg = (className?: string) => ({
  className,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

function IconPin({ className }: IconProps) {
  return (
    <svg {...svg(className)}>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
function IconArrowRight({ className }: IconProps) {
  return (
    <svg {...svg(className)}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
function IconCheck({ className }: IconProps) {
  return (
    <svg {...svg(className)}>
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}
function IconShield({ className }: IconProps) {
  return (
    <svg {...svg(className)}>
      <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function IconLock({ className }: IconProps) {
  return (
    <svg {...svg(className)}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" />
    </svg>
  );
}
function IconCalendar({ className }: IconProps) {
  return (
    <svg {...svg(className)}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    </svg>
  );
}
function IconHeadset({ className }: IconProps) {
  return (
    <svg {...svg(className)}>
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <rect x="3" y="13" width="4" height="6" rx="1.5" />
      <rect x="17" y="13" width="4" height="6" rx="1.5" />
      <path d="M21 19a3 3 0 0 1-3 3h-3" />
    </svg>
  );
}
