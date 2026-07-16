"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV_ICONS, IconClose } from "@/components/icons";
import { IconMenu } from "@/components/icons";
import type { WorkspaceNavItem } from "@/components/nav-config";
import type { AccountSummary } from "@/components/dashboard-chrome";

export function MobileNav({
  items,
  workspace,
  account,
}: {
  items: WorkspaceNavItem[];
  workspace: string;
  account?: AccountSummary | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  let lastSection: string | undefined;

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-controls="mobile-sidebar"
        onClick={() => setOpen(true)}
        className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <IconMenu />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[calc(var(--z-drawer)-1)] bg-black/30"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar drawer */}
      <aside
        id="mobile-sidebar"
        aria-hidden={!open}
        className={cn(
          "fixed inset-y-0 left-0 z-[var(--z-drawer)] flex w-64 flex-col border-r border-border bg-surface-raised shadow-2xl transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="text-sm font-semibold text-ink">{workspace}</span>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <IconClose />
          </button>
        </div>

        <nav aria-label="Workspace sections" className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const Icon = NAV_ICONS[item.icon];
              const active =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
              const showHeading = item.section && item.section !== lastSection;
              lastSection = item.section;
              return (
                <li key={item.href}>
                  {showHeading && (
                    <p className="px-3 pb-1 pt-3 text-overline text-muted-foreground">
                      {item.section}
                    </p>
                  )}
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary-subtle text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-ink",
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {account && (
          <div className="shrink-0 border-t border-border p-3">
            <Link
              href={account.href}
              className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-secondary"
            >
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {(account.name?.trim() || account.email || "?").charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{account.name}</span>
                {account.email && (
                  <span className="block truncate text-caption text-muted-foreground">
                    {account.email}
                  </span>
                )}
              </span>
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
