// Notification inbox endpoints.

import { request } from "./client";
import type { NotificationRow, NotificationsPage } from "@/lib/types";

export const notificationsApi = {
  list: (cursor?: string) =>
    request<NotificationsPage>(
      `/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
  get: (id: string) =>
    request<NotificationRow>(`/notifications/${encodeURIComponent(id)}`),
  markRead: (ids?: string[]) =>
    request<{ updated: number }>("/notifications/read", {
      method: "POST",
      body: JSON.stringify(ids && ids.length > 0 ? { ids } : {}),
    }),
  registerDevice: (
    token: string,
    platform: "WEB" | "ANDROID" | "IOS" = "WEB",
  ) =>
    request<{ ok: true }>("/notifications/devices", {
      method: "POST",
      body: JSON.stringify({ token, platform }),
    }),
  removeDevice: (token: string) =>
    request<{ ok: true }>(
      `/notifications/devices/${encodeURIComponent(token)}`,
      {
        method: "DELETE",
      },
    ),
};
