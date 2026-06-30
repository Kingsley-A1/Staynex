"use client";

import { type ReactNode } from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { MobileNav } from "@/components/mobile-nav";
import { NAV_ICONS, IconChevronLeft } from "@/components/icons";
import type { WorkspaceNavItem } from "@/components/nav-config";

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
      {/* Desktop sidebar — collapsible icon rail */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface-raised lg:flex">
        {/* Brand + collapse toggle */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-border",
            collapsed ? "flex-col justify-center gap-2 py-2" : "justify-between px-4",
          )}
        >
          <Link href="/" aria-label="Staynex home" className="inline-flex items-center">
            {collapsed ? (
              <span className="relative block size-8 overflow-hidden rounded-md">
                <Image src="/icon.png" alt="Staynex" fill sizes="32px" className="object-cover" />
              </span>
            ) : (
              <span className="relative block h-8 w-28">
                <Image src="/assets/logo.png" alt="Staynex" fill sizes="112px" className="object-contain object-left" />
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <IconChevronLeft className={cn("size-5 transition-transform", collapsed && "rotate-180")} />
          </button>
        </div>

        {/* Nav */}
        <nav
          aria-label="Workspace sections"
          className={cn("flex-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-3")}
        >
          {!collapsed && (
            <p className="px-3 pb-1 text-overline text-muted-foreground">{workspace}</p>
          )}
          <NavList items={nav} active={active} collapsed={collapsed} />
        </nav>

        {/* Account footer */}
        {account && <AccountFooter account={account} collapsed={collapsed} />}
      </aside>

      {/* Mobile top bar with hamburger */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface-raised px-4 lg:hidden">
        <Link href="/" aria-label="Staynex home" className="relative block h-9 w-32">
          <Image src="/assets/logo.png" alt="Staynex" fill sizes="128px" className="object-contain object-left" />
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-overline text-muted-foreground">{workspace}</span>
          <MobileNav items={nav} workspace={workspace} account={account} />
        </div>
      </header>

      <main className="layout-container py-8">{children}</main>
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
        const showHeading = !collapsed && item.section && item.section !== lastSection;
        const showDivider = collapsed && item.section && item.section !== lastSection;
        lastSection = item.section;
        return (
          <li key={item.href}>
            {showHeading && (
              <p className="px-3 pb-1 pt-3 text-overline text-muted-foreground">{item.section}</p>
            )}
            {showDivider && <div className="mx-2 my-1.5 border-t border-border" />}
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

function AccountFooter({ account, collapsed }: { account: AccountSummary; collapsed: boolean }) {
  const initial = (account.name?.trim() || account.email || "?").charAt(0).toUpperCase();
  return (
    <div className={cn("shrink-0 border-t border-border", collapsed ? "p-2" : "p-3")}>
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
            <span className="block truncate text-sm font-semibold text-ink">{account.name}</span>
            {account.email && (
              <span className="block truncate text-caption text-muted-foreground">{account.email}</span>
            )}
          </span>
        )}
      </Link>
    </div>
  );
}
