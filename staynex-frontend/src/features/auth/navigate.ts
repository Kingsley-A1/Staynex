// Post-auth destination logic shared by the auth form, the Google button, and
// the server-side auto-forward on /sign-in. Pure functions only — safe to
// import from both server and client components.

import {
  type AuthUser,
  capabilityHome,
  isAdminCapable,
  isOwnerCapable,
} from "@/lib/types";

/**
 * Allow only same-origin path redirects for `?next=` (guards open redirects:
 * absolute URLs, protocol-relative `//host`, and `/\` backslash tricks).
 */
export function sanitizeNextPath(
  next: string | null | undefined,
): string | null {
  if (!next || !next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

function requiresOwner(path: string): boolean {
  if (path.startsWith("/host/register")) return false; // public page
  return path === "/host" || path.startsWith("/host/");
}

function requiresAdmin(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

/**
 * Where to send `user` after authenticating: honor `next` when it's a safe
 * internal path the user can actually access; otherwise fall back to their
 * capability home. Prevents a guest's `?next=/host/…` from landing on a
 * forbidden workspace right after sign-in.
 */
export function authDestination(
  user: AuthUser,
  next: string | null | undefined,
): string {
  const path = sanitizeNextPath(next);
  if (!path) return capabilityHome(user);
  if (requiresOwner(path) && !isOwnerCapable(user)) return capabilityHome(user);
  if (requiresAdmin(path) && !isAdminCapable(user)) return capabilityHome(user);
  return path;
}
