// Push registration lifecycle. The backend's FCM HTTP v1 sender expects native
// FCM registration tokens (DeviceToken rows), so this module registers the
// device's native push token — not an Expo push token.
//
// Platform notes:
// - Android needs a dev/preview build with `google-services.json` wired in
//   app.config.ts (Expo Go cannot mint an FCM token). iOS delivery via the
//   backend's FCM sender additionally needs the Firebase iOS app configured.
// - Every failure path here is non-fatal: push is an enhancement, never a
//   gate on the booking flow.

import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { notificationsApi } from "@/data/api";

const PUSH_TOKEN_KEY = "staynex_push_token";

const platformLabel = (): "ANDROID" | "IOS" => (Platform.OS === "ios" ? "IOS" : "ANDROID");

export type PushOptInResult =
  | { status: "registered" }
  | { status: "denied" }
  | { status: "unsupported"; reason: string };

/**
 * Ask for permission (if needed) and register this device's native push token
 * with the backend. Call at a moment of real intent — e.g. right after a
 * booking confirmation — never on first launch.
 */
export async function optInToPush(): Promise<PushOptInResult> {
  if (!Device.isDevice) {
    return { status: "unsupported", reason: "Push needs a physical device." };
  }
  try {
    const existing = await Notifications.getPermissionsAsync();
    const permission = existing.granted
      ? existing
      : await Notifications.requestPermissionsAsync();
    if (!permission.granted) return { status: "denied" };
    await registerCurrentToken();
    return { status: "registered" };
  } catch (err) {
    // Typical cause: running in Expo Go / missing google-services.json.
    return {
      status: "unsupported",
      reason:
        err instanceof Error && err.message
          ? err.message
          : "Push isn't available in this build.",
    };
  }
}

/**
 * Silent refresh on app start: if the user already granted permission, keep
 * the backend's token current (FCM tokens rotate). Never prompts.
 */
export async function refreshPushRegistrationIfGranted(): Promise<void> {
  if (!Device.isDevice) return;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    await registerCurrentToken();
  } catch {
    /* non-fatal — push is best-effort */
  }
}

/** Deregister this device on sign-out so a shared phone stops receiving pushes. */
export async function unregisterPush(): Promise<void> {
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (!token) return;
  try {
    await notificationsApi.removeDevice(token);
  } catch {
    /* best-effort: clear locally even if the network call fails */
  }
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
}

async function registerCurrentToken(): Promise<void> {
  const native = await Notifications.getDevicePushTokenAsync();
  const token = typeof native.data === "string" ? native.data : String(native.data);
  if (!token || token.length < 20) throw new Error("No usable device push token");
  await notificationsApi.registerDevice(token, platformLabel());
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
}

/**
 * Map a push payload's `data.link` (a Staynex web path or absolute URL) onto an
 * in-app route. Falls back to the notifications inbox — never a dead tap.
 */
export function routeForPushLink(link: string | undefined): {
  pathname: string;
  params?: Record<string, string>;
} {
  if (link) {
    const path = link.replace(/^https?:\/\/[^/]+/, "");
    // Guest booking links: `/booking/confirmed?booking=<id>` (see
    // notifications.service.ts) — the trip detail screen is the mobile home
    // for a booking.
    const booking = path.match(/^\/booking\/confirmed\/?\?.*booking=([\w-]+)/);
    if (booking) return { pathname: "/trips/[id]", params: { id: booking[1] } };
    const stay = path.match(/^\/stays\/([\w-]+)/);
    if (stay) return { pathname: "/stays/[slug]", params: { slug: stay[1] } };
    // Host links: new/refunded bookings and check-in reminders deep-link to the
    // host booking detail; payout notices land on the Host tab. The backend
    // only sends these to owner accounts, and the host stack re-checks the
    // capability before rendering.
    const hostBooking = path.match(/^\/host\/bookings\/([\w-]+)/);
    if (hostBooking) return { pathname: "/host/bookings/[id]", params: { id: hostBooking[1] } };
    if (/^\/host\/bookings\/?$/.test(path)) return { pathname: "/(tabs)/host" };
  }
  return { pathname: "/notifications" };
}
