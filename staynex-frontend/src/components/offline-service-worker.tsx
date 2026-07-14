"use client";

import { useEffect } from "react";

export function OfflineServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    const register = () => {
      if (cancelled) return;
      void navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => {
        // Offline support is progressive enhancement; never block the app.
      });
    };

    if (document.readyState === "complete") {
      const id = window.setTimeout(register, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(id);
      };
    }

    window.addEventListener("load", register, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
