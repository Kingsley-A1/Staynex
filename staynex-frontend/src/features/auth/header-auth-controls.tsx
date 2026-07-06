"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { NotificationCenter } from "@/components/notification-center";
import {
  type AuthUser,
  capabilityHome,
  isAdminCapable,
  isOwnerCapable,
} from "@/lib/types";

/**
 * Right-side header controls shared by the public header and the welcome page.
 * Renders against the server-resolved session so a signed-in user never sees a
 * "Sign in" button. Anonymous users keep the original Sign in / Find a stay CTAs.
 */
export function HeaderAuthControls({ user }: { user: AuthUser | null }) {
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/sign-in"
          className="inline-flex h-10 items-center whitespace-nowrap rounded-md border border-border bg-surface-raised px-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          Sign in
        </Link>
        <Link
          href="/search"
          className="inline-flex h-10 items-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover active:bg-primary-active"
        >
          Find a stay
        </Link>
      </div>
    );
  }
  return <AccountMenu user={user} />;
}

function AccountMenu({ user }: { user: AuthUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = user.name?.trim() || user.email || "Account";
  const initial = label.charAt(0).toUpperCase();
  const workspaceHref = capabilityHome(user);
  const hasWorkspace = isOwnerCapable(user) || isAdminCapable(user);

  async function signOut() {
    setBusy(true);
    await authApi.logout().catch(() => {});
    setOpen(false);
    // Refresh so the server-resolved header re-renders as anonymous.
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/search"
        className="hidden h-10 items-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover active:bg-primary-active sm:inline-flex"
      >
        Find a stay
      </Link>
      <NotificationCenter />
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface-raised pl-1.5 pr-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {initial}
          </span>
          <span className="hidden max-w-[10rem] truncate sm:inline">{label}</span>
          <svg
            viewBox="0 0 24 24"
            className="size-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm font-semibold text-ink">{label}</p>
              {user.email && (
                <p className="truncate text-caption text-muted-foreground">{user.email}</p>
              )}
            </div>
            <div className="py-1">
              {hasWorkspace && (
                <Link
                  href={workspaceHref}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  {isAdminCapable(user) ? "Admin workspace" : "Owner dashboard"}
                </Link>
              )}
              <Link
                href="/profile"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
              >
                Profile
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={signOut}
                disabled={busy}
                className="block w-full px-4 py-2 text-left text-sm text-error transition-colors hover:bg-secondary disabled:opacity-60"
              >
                {busy ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
