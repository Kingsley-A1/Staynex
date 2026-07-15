import Image from "next/image";
import Link from "next/link";
import { Brandmark } from "@/components/brandmark";

const footerColumns = [
  {
    title: "Explore",
    links: [
      ["Stays", "/search"],
      ["Destinations", "/search"],
      ["Reviews", "/reviews"],
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
    title: "Support",
    links: [
      ["Contact support", "/support"],
      ["Docs", "/docs"],
      ["Terms", "/terms"],
      ["Policies", "/policies"],
      ["Legal", "/legal"],
    ],
  },
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface-raised">
      <div className="layout-container py-12 sm:py-14">
        {/* Brand + navigation */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center"
              aria-label="Staynex Bookings"
            >
              <Brandmark />
            </Link>
            <p className="mt-4 max-w-xs text-body-sm text-muted-foreground">
              Book verified stays with real-time availability, secure payments,
              and reliable support.
            </p>
          </div>

          {footerColumns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-overline">{column.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map(([label, href]) => (
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

        {/* Meta row */}
        <div className="mt-12 flex flex-col items-center gap-3 border-t border-border pt-8 text-caption sm:flex-row sm:justify-between">
          <p>© {year} Staynex Bookings. All rights reserved.</p>
          <p className="inline-flex items-center gap-1.5">
            <IconGlobe className="size-4" />
            Nigeria · Expanding worldwide
          </p>
        </div>

        {/* Down footer — partner attribution, centered and clean */}
        <div className="mt-8 flex justify-center">
          <a
            href="https://bespoketech.com.ng"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex flex-col items-center gap-1.5 rounded-md text-center transition-colors"
          >
            <span className="text-caption">Designed &amp; developed by</span>
            <span className="inline-flex items-center gap-2">
              <Image
                src="/assets/parteners/bespoke-technologies-logo-main.png"
                alt=""
                width={120}
                height={32}
                className="h-6 w-auto object-contain"
              />
              <span className="text-sm font-semibold text-ink transition-colors group-hover:text-primary">
                Bespoke Technologies
              </span>
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}

type IconProps = { className?: string };

function IconGlobe({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.3 2.5 14.7 0 17M12 3.5c-2.5 2.3-2.5 14.7 0 17" />
    </svg>
  );
}
