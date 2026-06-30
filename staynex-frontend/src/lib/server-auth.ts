// Server-only helper to resolve the signed-in user from the request's session
// cookie. Used by server components (e.g. public headers) so the UI reflects
// auth state on first paint — no client flash of a "Sign in" button for a user
// who is actually signed in. Returns null for anonymous or on any failure.

import { cookies } from "next/headers";
import { API_BASE } from "@/lib/api-base";
import type { AuthUser } from "@/lib/types";

export async function getServerUser(): Promise<AuthUser | null> {
  try {
    const store = await cookies();
    const all = store.getAll();
    if (all.length === 0) return null;
    const cookieHeader = all.map((c) => `${c.name}=${c.value}`).join("; ");
    const res = await fetch(`${API_BASE}/auth/me`, {
      cache: "no-store",
      headers: { cookie: cookieHeader },
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthUser | null;
  } catch {
    return null;
  }
}
