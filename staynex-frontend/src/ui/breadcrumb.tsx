import Link from "next/link";
import { cn } from "@/lib/cn";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Compact, horizontally resilient path navigation for public and workspace
 * surfaces. The current page is always the final item and is never linked.
 */
export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("overflow-x-auto [scrollbar-width:none]", className)}
    >
      <ol className="flex min-w-max items-center gap-1 text-sm">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className="flex items-center gap-1"
            >
              {index > 0 && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="size-4 shrink-0 text-border-strong"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 3.5 4.5 4.5L6 12.5" />
                </svg>
              )}
              {item.href && !current ? (
                <Link
                  href={item.href}
                  className="rounded-sm px-1.5 py-1 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-ink hover:no-underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={current ? "page" : undefined}
                  className="max-w-64 truncate px-1.5 py-1 font-medium text-ink"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
