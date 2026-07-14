import { forbidden, redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import type { AppCapability, AuthUser } from "@/lib/types";

type Capability = Exclude<AppCapability, "GUEST">;

function signInUrl(next: string): string {
  return `/sign-in?next=${encodeURIComponent(next)}`;
}

export async function requireServerCapability(
  allowed: Capability[],
  next: string,
): Promise<AuthUser> {
  const user = await getServerUser();
  if (!user) redirect(signInUrl(next));

  const canAccess = allowed.some((capability) =>
    user.capabilities.includes(capability),
  );
  if (!canAccess) forbidden();

  return user;
}
