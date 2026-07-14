"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { notificationsApi } from "@/lib/api";
import { onForegroundMessage } from "@/lib/firebase-messaging";

const POLL_MS = 60_000;

/** Route the bell to the notifications page for the current workspace. */
function notificationsHref(pathname: string): string {
  if (pathname.startsWith("/admin")) return "/admin/notifications";
  if (pathname.startsWith("/host")) return "/host/notifications";
  return "/notifications";
}

/**
 * Header notification bell — carries only the unread count and links to the
 * dedicated notifications page (guest/host/admin share one view). Polls the
 * count and shows a live toast when a push arrives while the tab is focused.
 */
export function NotificationCenter() {
  const pathname = usePathname();
  const href = notificationsHref(pathname);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const page = await notificationsApi.list();
      setUnread(page.unreadCount);
    } catch {
      /* offline — leave prior count */
    }
  }, []);

  // Initial load + interval poll, and re-check whenever the route changes
  // (e.g. after visiting the notifications page and reading items).
  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh, pathname]);

  // Live toast + count bump when a push arrives in the foreground.
  useEffect(() => {
    let unsub = () => {};
    void onForegroundMessage(({ title, body }) => {
      setToast({ title, body });
      window.setTimeout(() => setToast(null), 6000);
      void refresh();
    }).then((fn) => {
      unsub = fn;
    });
    return () => unsub();
  }, [refresh]);

  return (
    <>
      <Link
        href={href}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-error px-1 text-[10px] font-bold leading-4 text-error-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>

      {toast && (
        <div className="fixed bottom-4 right-4 z-[var(--z-toast,60)] w-80 max-w-[calc(100vw-2rem)] animate-slide-up rounded-xl border border-border bg-surface-raised p-4 shadow-xl">
          <p className="text-sm font-semibold text-ink">{toast.title}</p>
          <p className="mt-0.5 text-caption text-muted-foreground">{toast.body}</p>
        </div>
      )}
    </>
  );
}

function BellIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
