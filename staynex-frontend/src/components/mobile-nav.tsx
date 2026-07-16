"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // Close on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // The dashboard header uses backdrop-filter, which establishes a containing
  // block for fixed descendants. Portalling the drawer to document.body keeps
  // it viewport-sized; this effect supplies the expected modal behaviour.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === "Tab") {
        const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [open]);

  let lastSection: string | undefined;
  const activeItemHref = items.reduce((best, item) => {
    const matches =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    return matches && item.href.length > best.length ? item.href : best;
  }, "");

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-controls="mobile-sidebar"
        onClick={() => setOpen(true)}
        className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <IconMenu />
      </button>

      {open &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[calc(var(--z-overlay)-1)] bg-black/30"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <aside
              ref={drawerRef}
              id="mobile-sidebar"
              role="dialog"
              aria-modal="true"
              aria-label={`${workspace} navigation`}
              className="fixed inset-y-0 left-0 z-[var(--z-overlay)] flex w-[min(20rem,85vw)] flex-col border-r border-border bg-surface-raised shadow-2xl animate-slide-in-left"
            >
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
                <span className="text-sm font-semibold text-ink">
                  {workspace}
                </span>
                <button
                  ref={closeRef}
                  type="button"
                  aria-label="Close navigation menu"
                  onClick={() => setOpen(false)}
                  className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <IconClose />
                </button>
              </div>

              <nav
                aria-label="Workspace sections"
                className="flex-1 overflow-y-auto p-3"
              >
                <ul className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const Icon = NAV_ICONS[item.icon];
                    const active = item.href === activeItemHref;
                    const showHeading =
                      item.section && item.section !== lastSection;
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
                      {(account.name?.trim() || account.email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </span>
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
                  </Link>
                </div>
              )}
            </aside>
          </>,
          document.body,
        )}
    </>
  );
}
