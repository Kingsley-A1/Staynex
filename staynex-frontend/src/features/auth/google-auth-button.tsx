"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { type AuthUser, capabilityHome } from "@/lib/types";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleIdentity {
  accounts: {
    id: {
      initialize(cfg: {
        client_id: string;
        callback: (r: { credential?: string }) => void;
        ux_mode?: "popup" | "redirect";
      }): void;
      renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
    };
  };
}

// Google Identity Services button. The browser obtains a Google ID token; the
// backend verifies it (POST /auth/google) and sets the existing session cookie.
// `intent: "OWNER"` upgrades the account to owner-capable. Renders nothing if
// NEXT_PUBLIC_GOOGLE_CLIENT_ID isn't configured.
export function GoogleAuthButton({
  next,
  onSuccess,
  onError,
  intent,
}: {
  next?: string;
  onSuccess?: (user: AuthUser) => void;
  onError?: (message: string) => void;
  intent?: "GUEST" | "OWNER";
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Render the Google button at the wrapper's own width so it lines up with the
  // email/password inputs and never overflows on small screens. GIS caps at
  // 400px, so we clamp to that.
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!CLIENT_ID || width === 0) return;
    let cancelled = false;

    function fail(message: string) {
      setError(message);
      onError?.(message);
    }

    async function handleCredential(idToken: string) {
      setError(null);
      try {
        const user = await authApi.google(idToken, intent);
        if (onSuccess) onSuccess(user);
        else {
          router.push(next || capabilityHome(user));
          router.refresh();
        }
      } catch (err) {
        const message =
          err instanceof Error && err.message.includes("503")
            ? "Google sign-in is not configured on the server."
            : "Google sign-in could not be completed. Please try again.";
        fail(message);
      }
    }

    function init() {
      const g = (window as unknown as { google?: GoogleIdentity }).google;
      if (!g || !ref.current || cancelled) return;
      g.accounts.id.initialize({
        client_id: CLIENT_ID as string,
        ux_mode: "popup",
        callback: (resp) => {
          if (!resp.credential) {
            fail(
              "Google did not return a sign-in credential. Please try again.",
            );
            return;
          }
          void handleCredential(resp.credential);
        },
      });
      // Re-render clears any prior button so a resize doesn't stack buttons.
      ref.current.innerHTML = "";
      g.accounts.id.renderButton(ref.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        width: Math.max(200, Math.min(400, Math.round(width))),
        logo_alignment: "center",
      });
    }

    const existing = document.getElementById("gsi-client");
    if (existing) {
      init();
    } else {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.id = "gsi-client";
      s.onload = init;
      document.head.appendChild(s);
    }
    return () => {
      cancelled = true;
    };
  }, [next, onSuccess, onError, router, intent, width]);

  if (!CLIENT_ID) return null;

  return (
    <div className="space-y-3">
      <div ref={ref} className="flex min-h-10 w-full justify-center overflow-hidden" />
      {error && (
        <p className="text-center text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3 text-caption text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
