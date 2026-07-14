// Serves the FCM background service worker at the origin root
// (/firebase-messaging-sw.js) — the scope FCM requires. The worker carries the
// PUBLIC Firebase config (non-secret NEXT_PUBLIC_* values) and shows background
// notifications + routes clicks to the notification's deep link.

export const dynamic = "force-static";

export function GET(): Response {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };

  const firebaseConfigured = Boolean(
    config.apiKey && config.projectId && config.messagingSenderId && config.appId,
  );

  const firebaseWorker = firebaseConfigured
    ? `
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(config)});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const title = (payload.notification && payload.notification.title) || "Staynex";
  const body = (payload.notification && payload.notification.body) || "";
  const link = (payload.data && payload.data.link) || "/";
  self.registration.showNotification(title, {
    body: body,
    icon: "/icon.png",
    badge: "/icon.png",
    data: { link: link },
  });
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clients) {
      for (const client of clients) {
        if (client.url.indexOf(link) !== -1 && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
    })
  );
});`
    : "";

  const body = `/* Staynex FCM background service worker (generated). */
const OFFLINE_CACHE = "staynex-offline-v1";

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(OFFLINE_CACHE)
      .then(function (cache) { return cache.addAll(["/offline", "/icon.png"]); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (key) {
          return key.startsWith("staynex-offline-") && key !== OFFLINE_CACHE;
        }).map(function (key) { return caches.delete(key); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(function () {
      return caches.match("/offline").then(function (response) {
        return response || new Response("Staynex is offline", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      });
    })
  );
});

${firebaseWorker}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
