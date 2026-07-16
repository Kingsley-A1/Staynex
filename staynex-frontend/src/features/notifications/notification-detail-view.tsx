"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/error-state";
import { IconBell } from "@/components/icons";
import { ApiError, notificationsApi } from "@/lib/api";
import type { NotificationRow } from "@/lib/types";
import { ViewSourceButton } from "./view-source-button";
import { OptimizedFillImage } from "@/ui/optimized-fill-image";

export function NotificationDetailView({
  notificationId,
  inboxHref,
}: {
  notificationId: string;
  inboxHref: string;
}) {
  const [notification, setNotification] = useState<NotificationRow | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;
    notificationsApi
      .get(notificationId)
      .then((item) => {
        if (!active) return;
        setNotification(item);
        if (!item.readAt) {
          void notificationsApi.markRead([item.id]).catch(() => undefined);
        }
      })
      .catch((error) => {
        if (!active) return;
        setNotFound(error instanceof ApiError && error.status === 404);
        setOffline(!(error instanceof ApiError) || error.status >= 500);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [notificationId]);

  if (loading) {
    return (
      <p
        className="py-16 text-center text-caption text-muted-foreground"
        role="status"
      >
        Loading notification…
      </p>
    );
  }

  if (!notification) {
    return (
      <ErrorState
        tone={notFound ? "neutral" : "error"}
        title={notFound ? "Notification not found" : "Notification unavailable"}
        message={
          offline
            ? "We couldn't load this notification. Check your connection and try again."
            : "This notification may no longer be available."
        }
      >
        <Link
          href={inboxHref}
          className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface-raised px-4 text-sm font-semibold text-ink"
        >
          Back to notifications
        </Link>
      </ErrorState>
    );
  }

  return (
    <article className="mx-auto max-w-2xl">
      <Link
        href={inboxHref}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
      >
        <span aria-hidden>←</span>
        <span className="ml-2">All notifications</span>
      </Link>

      <div className="surface-card mt-3 overflow-hidden">
        {notification.imageUrl && (
          <div className="relative aspect-[16/7] bg-secondary">
            <OptimizedFillImage
              src={notification.imageUrl}
              alt="Property referenced by this notification"
              sizes="(min-width: 768px) 672px, 100vw"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        )}
        <header className="border-b border-border bg-primary-subtle/35 p-5 sm:p-6">
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <IconBell className="size-5" />
          </span>
          <p className="mt-5 text-overline text-muted-foreground">
            {notificationTypeLabel(notification.type)}
          </p>
          <h1 className="mt-1 text-title-md text-ink">{notification.title}</h1>
          <time
            dateTime={notification.createdAt}
            className="mt-2 block text-caption text-muted-foreground"
          >
            {formatNotificationDate(notification.createdAt)}
          </time>
        </header>

        <div className="space-y-6 p-5 sm:p-6">
          <p className="whitespace-pre-wrap text-body-sm leading-relaxed text-ink">
            {notification.body}
          </p>
          <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="break-all text-[11px] text-muted-foreground">
              Notification ID: {notification.id}
            </p>
            <ViewSourceButton href={notification.linkUrl} />
          </div>
        </div>
      </div>
    </article>
  );
}

function notificationTypeLabel(type: NotificationRow["type"]): string {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatNotificationDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
