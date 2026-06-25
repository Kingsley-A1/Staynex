"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import type { AppRole, AuthUser } from "@/lib/types";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleIdentity {
  accounts: {
    id: {
      initialize(cfg: { client_id: string; callback: (r: { credential: string }) => void }): void;
      renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
    };
  };
}

function roleHome(role: AppRole): string {
  if (role === "OWNER") return "/owner/dashboard";
  if (role === "ADMIN_REVIEWER" || role === "ADMIN_MANAGER") return "/admin/approvals";
  return "/";
}

// Google Identity Services button. The browser obtains a Google ID token; the
// backend verifies it (POST /auth/google) and sets the existing session cookie.
// Renders nothing if NEXT_PUBLIC_GOOGLE_CLIENT_ID isn't configured.
export function GoogleAuthButton({
  next,
  onSuccess,
}: {
  next?: string;
  onSuccess?: (user: AuthUser) => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    async function handleCredential(idToken: string) {
      try {
        const user = await authApi.google(idToken);
        if (onSuccess) onSuccess(user);
        else {
          router.push(next || roleHome(user.role));
          router.refresh();
        }
      } catch {
        /* surfaced by the surrounding form when needed */
      }
    }

    function init() {
      const g = (window as unknown as { google?: GoogleIdentity }).google;
      if (!g || !ref.current || cancelled) return;
      g.accounts.id.initialize({
        client_id: CLIENT_ID as string,
        callback: (resp) => void handleCredential(resp.credential),
      });
      g.accounts.id.renderButton(ref.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        width: 320,
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
  }, [next, onSuccess, router]);

  if (!CLIENT_ID) return null;

  return (
    <div className="space-y-3">
      <div ref={ref} className="flex min-h-[40px] justify-center" />
      <div className="flex items-center gap-3 text-caption text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
