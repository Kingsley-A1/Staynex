"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notificationsApi } from "@/lib/api";
import {
  disablePush,
  enablePush,
  onForegroundMessage,
  pushPermission,
  type PushPermission,
} from "@/lib/firebase-messaging";
import type { NotificationRow } from "@/lib/types";

const POLL_MS = 60_000;

function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff)) return "";
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Notification bell for the host/admin workspaces: unread badge, inbox
 * dropdown with deep links + mark-read, a push opt-in row, and a foreground
 * toast when a push arrives while the tab is focused. Polls the unread count
 * on an interval and refreshes instantly on a live message.
 */
export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<PushPermission>("unsupported");
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const page = await notificationsApi.list();
      setItems(page.rows);
      setUnread(page.unreadCount);
    } catch {
      /* offline — leave prior state */
    }
  }, []);

  // Initial load + interval poll.
  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  // Reflect current push permission, and refresh on foreground messages.
  useEffect(() => {
    setPermission(pushPermission());
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

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await refresh();
      setLoading(false);
    }
  }

  async function markAllRead() {
    if (unread === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnread(0);
    await notificationsApi.markRead().catch(() => {});
  }

  async function openItem(item: NotificationRow) {
    setOpen(false);
    if (!item.readAt) {
      setUnread((u) => Math.max(0, u - 1));
      await notificationsApi.markRead([item.id]).catch(() => {});
    }
    if (item.linkUrl) router.push(item.linkUrl);
  }

  async function turnOnPush() {
    const ok = await enablePush();
    setPermission(pushPermission());
    if (ok) setToast({ title: "Notifications on", body: "You'll get instant alerts on this device." });
    window.setTimeout(() => setToast(null), 4000);
  }

  async function turnOffPush() {
    await disablePush();
    setPermission(pushPermission());
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-error px-1 text-[10px] font-bold leading-4 text-error-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[var(--z-dropdown,50)] mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-semibold text-ink">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-caption font-medium text-primary hover:text-primary-hover"
              >
                Mark all read
              </button>
            )}
          </div>

          {permission === "default" && (
            <button
              type="button"
              onClick={turnOnPush}
              className="flex w-full items-center gap-2 border-b border-border bg-primary-subtle px-4 py-2.5 text-left text-sm text-primary hover:bg-primary-subtle/80"
            >
              <BellIcon className="size-4" />
              Turn on push notifications for instant alerts
            </button>
          )}
          {permission === "granted" && (
            <div className="flex items-center justify-between border-b border-border px-4 py-2 text-caption text-muted-foreground">
              <span>Push notifications on</span>
              <button type="button" onClick={turnOffPush} className="font-medium hover:text-ink">
                Turn off
              </button>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-caption text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-caption text-muted-foreground">
                You&apos;re all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => {
                  const content = (
                    <>
                      <div className="flex items-start gap-2">
                        {!n.readAt && (
                          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                        )}
                        <div className={n.readAt ? "min-w-0 pl-4" : "min-w-0"}>
                          <p className="text-sm font-medium text-ink">{n.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-caption text-muted-foreground">
                            {n.body}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                        </div>
                      </div>
                    </>
                  );
                  return (
                    <li key={n.id} className={n.readAt ? "" : "bg-primary-subtle/30"}>
                      {n.linkUrl ? (
                        <button
                          type="button"
                          onClick={() => void openItem(n)}
                          className="block w-full px-4 py-3 text-left transition-colors hover:bg-secondary"
                        >
                          {content}
                        </button>
                      ) : (
                        <div className="px-4 py-3">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Foreground toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[var(--z-toast,60)] w-80 animate-slide-up rounded-xl border border-border bg-surface-raised p-4 shadow-xl">
          <p className="text-sm font-semibold text-ink">{toast.title}</p>
          <p className="mt-0.5 text-caption text-muted-foreground">{toast.body}</p>
        </div>
      )}
    </div>
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
