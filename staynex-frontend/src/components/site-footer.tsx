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
    title: "Legal",
    links: [
      ["Terms", "/terms"],
      ["Policies", "/policies"],
      ["Legal", "/legal"],
    ],
  },
] as const;

export function SiteFooter() {
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
              <Brandmark priority />
            </Link>
            <p className="mt-3 max-w-xs text-body-sm text-muted-foreground">
              Book verified stays with real-time availability, secure payments,
              and reliable support.
            </p>
          </div>

          {footerColumns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-overline">{column.title}</h2>
              <ul className="mt-3 space-y-2.5">
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

        <div className="mt-10 flex flex-col gap-5 border-t border-border pt-6 text-caption lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <p>© {new Date().getFullYear()} Staynex. All rights reserved.</p>
            <p className="inline-flex items-center gap-1.5">
              <IconGlobe className="size-4" />
              Nigeria · Expanding worldwide
            </p>
          </div>

          <a
            href="https://bespoketech.com.ng"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-wrap items-center gap-2 rounded-md text-muted-foreground transition-colors hover:text-ink"
          >
            <span>Designed and Developed by</span>
            <Image
              src="/assets/parteners/bespoke-technologies-logo-main.png"
              alt=""
              width={132}
              height={36}
              className="h-7 w-auto object-contain"
            />
            <span className="font-semibold text-ink">Bespoke Technologies</span>
            <span className="text-muted-foreground">bespoketech.com.ng</span>
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
