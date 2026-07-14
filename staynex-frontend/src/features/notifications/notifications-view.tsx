"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, notificationsApi } from "@/lib/api";
import {
  disablePush,
  enablePush,
  onForegroundMessage,
  pushPermission,
  type PushPermission,
} from "@/lib/firebase-messaging";
import { IconBell } from "@/components/icons";
import type { NotificationRow } from "@/lib/types";

const POLL_MS = 60_000;

function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff)) return "";
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Full-page notification inbox — shared by the guest, host, and admin
 * `/notifications` routes. The header bell only carries the unread count and
 * links here; the actual list, mark-read, push opt-in, and paging all live in
 * this one reusable view. See [[notifications-page]].
 */
export function NotificationsView() {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [permission, setPermission] = useState<PushPermission>("unsupported");

  const refresh = useCallback(async () => {
    try {
      const page = await notificationsApi.list();
      setItems(page.rows);
      setUnread(page.unreadCount);
      setCursor(page.nextCursor);
      setAuthRequired(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setAuthRequired(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + interval poll.
  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  // Reflect push permission and refresh instantly on foreground messages.
  useEffect(() => {
    setPermission(pushPermission());
    let unsub = () => {};
    void onForegroundMessage(() => void refresh()).then((fn) => {
      unsub = fn;
    });
    return () => unsub();
  }, [refresh]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await notificationsApi.list(cursor);
      setItems((prev) => [...prev, ...page.rows]);
      setCursor(page.nextCursor);
    } catch {
      /* offline — keep what we have */
    } finally {
      setLoadingMore(false);
    }
  }

  async function markAllRead() {
    if (unread === 0) return;
    setItems((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    );
    setUnread(0);
    await notificationsApi.markRead().catch(() => {});
  }

  function openItem(item: NotificationRow) {
    if (!item.readAt) {
      setItems((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );
      setUnread((u) => Math.max(0, u - 1));
      void notificationsApi.markRead([item.id]).catch(() => {});
    }
    router.push(`${pathname.replace(/\/$/, "")}/${encodeURIComponent(item.id)}`);
  }

  async function turnOnPush() {
    await enablePush();
    setPermission(pushPermission());
  }

  async function turnOffPush() {
    await disablePush();
    setPermission(pushPermission());
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title-lg text-ink">Notifications</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {unread > 0
              ? `${unread} unread`
              : "You're all caught up."}
          </p>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface-raised px-3.5 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary"
          >
            Mark all read
          </button>
        )}
      </header>

      {/* Push opt-in / status */}
      {permission === "default" && (
        <button
          type="button"
          onClick={turnOnPush}
          className="mt-5 flex w-full items-center gap-2.5 rounded-lg border border-border bg-primary-subtle px-4 py-3 text-left text-sm font-medium text-primary transition-colors hover:bg-primary-subtle/80"
        >
          <IconBell className="size-5 shrink-0" />
          Turn on push notifications for instant alerts on this device.
        </button>
      )}
      {permission === "granted" && (
        <div className="mt-5 flex items-center justify-between rounded-lg border border-border bg-surface-raised px-4 py-2.5 text-caption text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <IconBell className="size-4" /> Push notifications are on.
          </span>
          <button
            type="button"
            onClick={turnOffPush}
            className="font-medium transition-colors hover:text-ink"
          >
            Turn off
          </button>
        </div>
      )}

      {/* List */}
      <div className="mt-6">
        {loading ? (
          <ListState>Loading…</ListState>
        ) : authRequired ? (
          <div className="surface-card p-8 text-center">
            <p className="text-title-sm text-ink">Sign in to see notifications</p>
            <p className="mx-auto mt-2 max-w-sm text-body-sm text-muted-foreground">
              Your booking updates, reminders, and alerts appear here once you
              sign in.
            </p>
            <Link
              href="/sign-in?next=/notifications"
              className="mt-5 inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Sign in
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="surface-card p-10 text-center">
            <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <IconBell className="size-6" />
            </span>
            <p className="mt-4 text-title-sm text-ink">No notifications yet</p>
            <p className="mx-auto mt-1 max-w-sm text-body-sm text-muted-foreground">
              Booking updates, reminders, and alerts will show up here.
            </p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-border bg-surface-raised">
            {items.map((n) => {
              const inner = (
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={
                      n.readAt
                        ? "mt-1.5 size-2 shrink-0 rounded-full bg-transparent"
                        : "mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{n.title}</p>
                    <p className="mt-0.5 text-body-sm text-muted-foreground">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </div>
              );
              return (
                <li
                  key={n.id}
                  className={n.readAt ? "" : "bg-primary-subtle/25"}
                >
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    aria-label={`Read notification: ${n.title}`}
                    className="block w-full border-b border-border px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    {inner}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {cursor && !loading && !authRequired && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface-raised px-5 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ListState({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-12 text-center text-caption text-muted-foreground">
      {children}
    </p>
  );
}
