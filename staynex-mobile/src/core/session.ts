// Session state (Zustand). Holds the current signed-in user and hydrates it from
// `GET /auth/me` on cold start so a persisted cookie restores the session without
// a re-login. Never derives auth state locally — the API is the source of truth.

import { create } from "zustand";
import type { AuthUser } from "@staynex/backend/types";
import { clearSessionCookie } from "@/core/client";
import { authApi } from "@/data/api";

type SessionStatus = "idle" | "hydrating" | "ready";

interface SessionState {
  user: AuthUser | null;
  status: SessionStatus;
  /** Resolve the persisted cookie against the API. Safe to call once on launch. */
  hydrate: () => Promise<void>;
  /** Set the user after a successful login/register. */
  setUser: (user: AuthUser | null) => void;
  /** Clear the server session, the persisted cookie, and local state. */
  signOut: () => Promise<void>;
}

export const useSession = create<SessionState>()((set) => ({
  user: null,
  status: "idle",
  hydrate: async () => {
    set({ status: "hydrating" });
    try {
      const user = await authApi.me();
      set({ user, status: "ready" });
    } catch {
      // A failed /auth/me (expired cookie, offline) means "no session", not a crash.
      set({ user: null, status: "ready" });
    }
  },
  setUser: (user) => set({ user }),
  signOut: async () => {
    try {
      await authApi.logout();
    } catch {
      /* best-effort: clear locally even if the network call fails */
    }
    await clearSessionCookie();
    set({ user: null });
  },
}));
