"use client";

import { useEffect, useState } from "react";
import { authApi } from "@/lib/api";
import type { AuthUser } from "@/lib/types";
import { HeaderAuthControls } from "./header-auth-controls";

export function ClientHeaderAuthControls() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;
    const loadUser = () => {
      authApi
        .me()
        .then((nextUser) => {
          if (active) setUser(nextUser);
        })
        .catch(() => {
          if (active) setUser(null);
        });
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(loadUser, { timeout: 2500 });
      return () => {
        active = false;
        window.cancelIdleCallback(id);
      };
    }

    const id = window.setTimeout(loadUser, 1200);
    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, []);

  return <HeaderAuthControls user={user} />;
}
