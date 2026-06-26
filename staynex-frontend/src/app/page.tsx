import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SearchPanel } from "@/features/booking/search-panel";
import { TestimonialsSection } from "@/features/reviews/testimonials-section";

export const metadata: Metadata = {
  title: "Staynex — Book trusted stays",
  description:
    "Book trusted stays across Nigeria and beyond. Verified properties, secure payments, and real-time availability.",
};

/* -----------------------------------------------------------------------------
   Demo data (mock). Kept here for the landing page; promote to a centralized
   fixtures module (per project standard §10) once shared across surfaces.
   --------------------------------------------------------------------------- */
const DESTINATIONS = [
  { city: "Calabar", stays: 128, gradient: "from-indigo-500 to-indigo-800" },
  { city: "Lagos", stays: 210, gradient: "from-indigo-600 to-indigo-900" },
  { city: "Abuja", stays: 156, gradient: "from-neutral-600 to-neutral-900" },
  {
    city: "Port Harcourt",
    stays: 92,
    gradient: "from-indigo-400 to-indigo-700",
  },
  { city: "Uyo", stays: 64, gradient: "from-indigo-500 to-neutral-800" },
];

const STAYS = [
  {
    name: "Marina Crest Hotel",
    city: "Calabar",
    type: "Hotel",
    price: 48000,
    rating: 4.8,
    reviews: 214,
    status: "Available",
    gradient: "from-indigo-500 to-indigo-800",
  },
  {
    name: "Tinapa Grand Resort",
    city: "Calabar",
    type: "Resort",
    price: 72000,
    rating: 4.9,
    reviews: 312,
    status: "Available",
    gradient: "from-indigo-600 to-indigo-900",
  },
  {
    name: "Duke Town Suites",
    city: "Calabar",
    type: "Apartment",
    price: 36000,
    rating: 4.7,
    reviews: 168,
    status: "Available",
    gradient: "from-neutral-600 to-neutral-900",
  },
  {
    name: "Harbor Nest Apartments",
    city: "Uyo",
    type: "Apartment",
    price: 29500,
    rating: 4.6,
    reviews: 97,
    status: "2 left",
    gradient: "from-indigo-400 to-indigo-700",
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

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/* ============================================================================
   Page
   ========================================================================== */
export default function HomePage() {
  return (
    <>
      <SiteHeader />

      <main id="main">
        <Hero />
        <Destinations />
        <FeaturedStays />
        <TestimonialsSection />
        <ValueProps />
        <OwnerCta />
      </main>

      <SiteFooter />
    </>
  );
}

/* ============================================================================
   Header
   ========================================================================== */
function SiteHeader() {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border bg-background/80 backdrop-blur-md">
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

        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="inline-flex h-10 items-center whitespace-nowrap rounded-md border border-border bg-surface-raised px-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Sign in
          </Link>
          <Link
            href="/search"
            className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover active:bg-primary-active"
          >
            Find a stay
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ============================================================================
   Hero + search
   ========================================================================== */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Decorative brand wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-primary-subtle blur-3xl"
      />
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
function Destinations() {
  return (
    <section className="layout-container py-14 sm:py-16">
      <SectionHead
        title="Popular destinations"
        subtitle="Explore stays across our launch cities."
        href="/search"
        linkLabel="View all"
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {DESTINATIONS.map((d) => (
          <Link
            key={d.city}
            href={`/search?city=${encodeURIComponent(d.city)}`}
            className="group relative block aspect-[4/5] overflow-hidden rounded-lg"
          >
            {/* Gradient is the fallback behind the real city photo */}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${d.gradient}`}
            />
            <Image
              src={`/assets/destinations/${slug(d.city)}.jpg`}
              alt={`${d.city}, Nigeria`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p className="font-semibold text-white">{d.city}</p>
              <p className="text-2xs text-white/80">{d.stays} stays</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ============================================================================
   Featured stays
   ========================================================================== */
function FeaturedStays() {
  return (
    <section className="bg-surface-sunken py-14 sm:py-16">
      <div className="layout-container">
        <SectionHead
          title="Featured stays"
          subtitle="Hand-picked properties travellers love."
          href="/search"
          linkLabel="Browse all stays"
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STAYS.map((stay) => (
            <StayCard key={stay.name} stay={stay} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StayCard({ stay }: { stay: (typeof STAYS)[number] }) {
  const available = stay.status === "Available";
  return (
    <Link
      href={`/stays/${slug(stay.name)}`}
      className="group surface-card block overflow-hidden transition-shadow hover:shadow-md"
    >
      <div className={`relative h-44 bg-gradient-to-br ${stay.gradient}`}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold ${
            available
              ? "border-success-border bg-success-surface text-success"
              : "border-warning-border bg-warning-surface text-warning"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${available ? "bg-success" : "bg-warning"}`}
          />
          {stay.status}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-2xs font-medium text-ink">
          {stay.type}
        </span>
      </div>

      <div className="p-4">
        <h3 className="text-title-sm truncate">{stay.name}</h3>
        <p className="mt-1 inline-flex items-center gap-1.5 text-muted-foreground">
          <IconPin className="size-4" />
          <span className="text-caption">{stay.city}, Nigeria</span>
        </p>

        <div className="mt-3 flex items-center gap-1.5 text-sm">
          <IconStar className="size-4 text-warning" />
          <span className="font-semibold text-ink">{stay.rating}</span>
          <span className="text-muted-foreground">
            · {stay.reviews} reviews
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
          <p className="text-ink">
            <span className="text-lg font-bold">{naira(stay.price)}</span>
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
   Owner CTA band
   ========================================================================== */
function OwnerCta() {
  return (
    <section className="layout-container pb-16 sm:pb-20">
      <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-12 text-center shadow-lg sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl"
        />
        <div className="relative mx-auto max-w-2xl">
          <p className="text-overline text-white/70">For property owners</p>
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
   Footer
   ========================================================================== */
function SiteFooter() {
  const cols = [
    {
      title: "Explore",
      links: [
        ["Stays", "/search"],
        ["Destinations", "/search"],
        ["Featured", "/search"],
      ],
    },
    {
      title: "Company",
      links: [
        ["About", "/about"],
        ["List your property", "/list-your-property"],
      ],
    },
    {
      title: "Legal",
      links: [
        ["Terms", "/terms"],
        ["Policies", "/policies"],
        ["Legal", "/legal"],
      ],
    },
  ] as const;

  return (
    <footer className="border-t border-border bg-surface-raised">
      <div className="layout-container py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-2">
            <Link
              href="/"
              className="inline-flex items-center"
              aria-label="Staynex home"
            >
              <Brandmark />
            </Link>
            <p className="mt-3 max-w-xs text-body-sm text-muted-foreground">
              Book trusted stays, Confidently.
            </p>
          </div>

          {cols.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-overline">{col.title}</h3>
              <ul className="mt-3 space-y-2.5">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-muted-foreground transition-colors hover:text-ink"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-caption sm:flex-row">
          <p>© {new Date().getFullYear()} Staynex. All rights reserved.</p>
          <p className="inline-flex items-center gap-1.5">
            <IconGlobe className="size-4" />
            Nigeria · Expanding worldwide
          </p>
        </div>
      </div>
    </footer>
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

function Brandmark({ className = "h-10 w-36" }: { className?: string }) {
  // Source asset is a square lockup with whitespace padding; object-cover crops
  // the vertical padding to a clean horizontal band (the wordmark stays intact).
  return (
    <span className={`relative block ${className}`}>
      <Image
        src="/assets/logo.png"
        alt="Staynex"
        fill
        sizes="144px"
        priority
        className="object-cover object-center"
      />
    </span>
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
function IconStar({ className }: IconProps) {
  return (
    <svg {...svg(className)} fill="currentColor" stroke="none">
      <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 17.77l-5.2 2.73.99-5.78-4.21-4.1 5.82-.85L12 3.5Z" />
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
function IconGlobe({ className }: IconProps) {
  return (
    <svg {...svg(className)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.3 2.5 14.7 0 17M12 3.5c-2.5 2.3-2.5 14.7 0 17" />
    </svg>
  );
}
