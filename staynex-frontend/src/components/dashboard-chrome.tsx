"use client";

import { type ReactNode } from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Brandmark } from "@/components/brandmark";
import { MobileNav } from "@/components/mobile-nav";
import { NotificationCenter } from "@/components/notification-center";
import { NAV_ICONS, IconChevronLeft } from "@/components/icons";
import type { WorkspaceNavItem } from "@/components/nav-config";
import { Breadcrumbs, type BreadcrumbItem } from "@/ui";
import { SkipLink } from "@/components/skip-link";

export interface AccountSummary {
  name: string;
  email?: string | null;
  href: string;
}

export const SIDEBAR_COOKIE = "sx_sidebar";

/** Longest-match active item so `/admin/approvals` beats the `/admin` overview. */
function activeHref(pathname: string, items: WorkspaceNavItem[]): string {
  let best = "";
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (item.href.length > best.length) best = item.href;
    }
  }
  return best;
}

function workspaceBreadcrumbs(
  pathname: string,
  items: WorkspaceNavItem[],
): BreadcrumbItem[] {
  const root = items[0];
  if (!root) return [];

  const active = activeHref(pathname, items);
  const section = items.find((item) => item.href === active) ?? root;
  const breadcrumbs: BreadcrumbItem[] = [
    { label: root.label, href: root.href },
  ];

  if (!active) {
    const rootSegment = root.href.split("/").filter(Boolean)[0];
    const routeSegment = pathname
      .split("/")
      .filter(Boolean)
      .find((segment) => segment !== rootSegment);
    if (routeSegment) {
      breadcrumbs.push({ label: humanizeSegment(routeSegment) });
    } else {
      breadcrumbs[0] = { label: root.label };
    }
    return breadcrumbs;
  }

  if (section.href !== root.href) {
    breadcrumbs.push({ label: section.label, href: section.href });
  }

  const remainder = active
    ? pathname.slice(active.length).split("/").filter(Boolean)
    : [];
  if (remainder.length > 0) {
    const entity = section.entityLabel ?? section.label;
    breadcrumbs.push({
      label:
        remainder[0] === "new"
          ? `New ${entity.toLowerCase()}`
          : `${entity} details`,
    });
  } else {
    breadcrumbs[breadcrumbs.length - 1] = {
      label: breadcrumbs[breadcrumbs.length - 1].label,
    };
  }

  return breadcrumbs;
}

function humanizeSegment(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function DashboardChrome({
  workspace,
  nav,
  account,
  initialCollapsed,
  children,
}: {
  workspace: string;
  nav: WorkspaceNavItem[];
  account: AccountSummary | null;
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const pathname = usePathname();
  const active = activeHref(pathname, nav);
  const breadcrumbs = workspaceBreadcrumbs(pathname, nav);
  const showBreadcrumbs = breadcrumbs.length > 1;

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
      try {
        localStorage.setItem(SIDEBAR_COOKIE, next ? "collapsed" : "expanded");
      } catch {
        /* storage unavailable — cookie still drives SSR */
      }
      return next;
    });
  }

  return (
    <div
      className={cn(
        "min-h-dvh bg-background lg:grid",
        collapsed ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[248px_1fr]",
      )}
    >
      <SkipLink />
      {/* Desktop sidebar — collapsible icon rail */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface-raised lg:flex">
        {/* Brand + collapse toggle */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-border",
            collapsed
              ? "flex-col justify-center gap-2 py-2"
              : "justify-between px-4",
          )}
        >
          <Link
            href="/"
            aria-label="Staynex Bookings home"
            className="inline-flex items-center"
          >
            {collapsed ? (
              <span className="relative block size-8 overflow-hidden rounded-md">
                <Image
                  src="/icon.png"
                  alt="Staynex Bookings"
                  fill
                  sizes="32px"
                  className="object-cover"
                />
              </span>
            ) : (
              <Brandmark
                iconClassName="size-7"
                textClassName="text-base"
                hideSuffixOnMobile
              />
            )}
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <IconChevronLeft
              className={cn(
                "size-5 transition-transform",
                collapsed && "rotate-180",
              )}
            />
          </button>
        </div>

        {/* Nav */}
        <nav
          aria-label="Workspace sections"
          className={cn(
            "flex-1 overflow-y-auto py-3",
            collapsed ? "px-2" : "px-3",
          )}
        >
          <NavList items={nav} active={active} collapsed={collapsed} />
        </nav>

        {/* Account footer */}
        {account && <AccountFooter account={account} collapsed={collapsed} />}
      </aside>

      {/* Right column: a utility top bar (bell everywhere; logo + nav on mobile) + main */}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-[var(--z-sticky)] flex h-16 items-center justify-between gap-3 border-b border-border bg-surface-raised/95 px-4 backdrop-blur-md sm:px-6">
          <Link
            href="/"
            aria-label="Staynex Bookings home"
            className="inline-flex items-center lg:hidden"
          >
            <Brandmark
              iconClassName="size-7"
              textClassName="text-base"
              hideSuffixOnMobile
            />
          </Link>
          <p className="hidden text-sm font-semibold text-ink lg:block">
            {workspace}
          </p>
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <span className="text-overline text-muted-foreground lg:hidden">
              {workspace}
            </span>
            <div className="lg:hidden">
              <MobileNav items={nav} workspace={workspace} account={account} />
            </div>
          </div>
        </header>

        {showBreadcrumbs && (
          <div className="sticky top-16 z-[calc(var(--z-sticky)-1)] border-b border-border bg-background/95 backdrop-blur-md">
            <div className="layout-container py-2.5">
              <Breadcrumbs items={breadcrumbs} />
            </div>
          </div>
        )}

        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "layout-container pb-8",
            showBreadcrumbs ? "pt-4 sm:pt-5" : "pt-5 sm:pt-6",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function NavList({
  items,
  active,
  collapsed,
}: {
  items: WorkspaceNavItem[];
  active: string;
  collapsed: boolean;
}) {
  let lastSection: string | undefined;
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        const isActive = item.href === active;
        const showHeading =
          !collapsed && item.section && item.section !== lastSection;
        const showDivider =
          collapsed && item.section && item.section !== lastSection;
        lastSection = item.section;
        return (
          <li key={item.href}>
            {showHeading && (
              <p className="px-3 pb-1 pt-3 text-overline text-muted-foreground">
                {item.section}
              </p>
            )}
            {showDivider && (
              <div className="mx-2 my-1.5 border-t border-border" />
            )}
            <Link
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group/navitem relative flex items-center rounded-md text-sm font-medium transition-colors",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                isActive
                  ? "bg-primary-subtle text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-ink",
              )}
            >
              <Icon className="size-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {collapsed && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-full z-[var(--z-tooltip)] ml-2 hidden whitespace-nowrap rounded-md border border-border bg-surface-overlay px-2 py-1 text-xs font-medium text-ink shadow-md group-hover/navitem:block"
                >
                  {item.label}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AccountFooter({
  account,
  collapsed,
}: {
  account: AccountSummary;
  collapsed: boolean;
}) {
  const initial = (account.name?.trim() || account.email || "?")
    .charAt(0)
    .toUpperCase();
  return (
    <div
      className={cn(
        "shrink-0 border-t border-border",
        collapsed ? "p-2" : "p-3",
      )}
    >
      <Link
        href={account.href}
        title={collapsed ? account.name : undefined}
        className={cn(
          "flex items-center rounded-md transition-colors hover:bg-secondary",
          collapsed ? "justify-center p-1.5" : "gap-3 p-2",
        )}
      >
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {initial}
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">
              {account.name}
            </span>
            {account.email && (
              <span className="block truncate text-caption text-muted-foreground">
                {account.email}
              </span>
            )}
          </span>
        )}
      </Link>
    </div>
  );
}
