// Capability checks against the server-issued AuthUser. Capabilities are never
// derived or cached client-side beyond the session object itself — `/auth/me`
// is the single source of truth, and the backend re-enforces every capability
// on each request regardless of what the UI shows (skill.md §9).

import type { AuthUser } from "@staynex/backend/types";

/** True when the signed-in user may enter the host workspace. */
export function isOwner(user: AuthUser | null): boolean {
  return Boolean(user?.capabilities?.includes("OWNER"));
}
