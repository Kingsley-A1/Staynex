"use client";

// Browser-side FCM: request permission, obtain a device token bound to our
// service worker + VAPID key, register it with the backend, and surface
// foreground messages. All firebase SDK imports are dynamic so nothing loads
// (or ships in the main bundle) unless the user actually opts in.

import { notificationsApi } from "@/lib/api";
import { firebaseConfig, firebaseConfigured, firebaseVapidKey } from "@/lib/firebase-config";

const TOKEN_STORAGE_KEY = "staynex_push_token";

export type PushPermission = "unsupported" | "default" | "granted" | "denied";

/** Current capability/permission without prompting. */
export function pushPermission(): PushPermission {
  if (
    typeof window === "undefined" ||
    !firebaseConfigured() ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator)
  ) {
    return "unsupported";
  }
  return Notification.permission as PushPermission;
}

async function getMessaging() {
  const [{ initializeApp, getApps }, { getMessaging, isSupported }] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  if (!(await isSupported())) return null;
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  return getMessaging(app);
}

/**
 * Prompt for permission (if needed), get the FCM token, and register it with
 * the backend. Returns true on success. Safe to call repeatedly — the token is
 * cached and re-registration is idempotent server-side.
 */
export async function enablePush(): Promise<boolean> {
  if (pushPermission() === "unsupported") return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const messaging = await getMessaging();
    if (!messaging) return false;

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
    );
    const { getToken } = await import("firebase/messaging");
    const token = await getToken(messaging, {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;

    await notificationsApi.registerDevice(token, "WEB");
    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      /* storage unavailable — token still registered server-side */
    }
    return true;
  } catch {
    return false;
  }
}

/** Unregister this device's token (opt-out / logout). */
export async function disablePush(): Promise<void> {
  try {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      await notificationsApi.removeDevice(token).catch(() => {});
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    /* best effort */
  }
}

/**
 * Subscribe to foreground messages (the SW handles background). Returns an
 * unsubscribe function. No-op when push isn't configured/permitted.
 */
export async function onForegroundMessage(
  handler: (payload: {
    title: string;
    body: string;
    link?: string;
  }) => void,
): Promise<() => void> {
  if (pushPermission() !== "granted") return () => {};
  const messaging = await getMessaging();
  if (!messaging) return () => {};
  const { onMessage } = await import("firebase/messaging");
  return onMessage(messaging, (payload) => {
    handler({
      title: payload.notification?.title ?? "Staynex",
      body: payload.notification?.body ?? "",
      link: (payload.data?.link as string | undefined) ?? undefined,
    });
  });
}
