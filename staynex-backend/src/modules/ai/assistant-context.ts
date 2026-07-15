import type { AuthUser } from "../../../types";

const ROLE_QUESTION =
  /\b(am i|what(?:'s| is) my|which)\b[^?]{0,60}\b(guest|host|owner|role|account type)\b|\bguest or host\b/i;

export function isOwnerCapable(user: AuthUser | null): boolean {
  return Boolean(user?.capabilities.includes("OWNER"));
}

export function assistantSurface(pagePath?: string): string {
  if (!pagePath) return "an unspecified Staynex page";
  if (pagePath === "/host/dashboard") return "the Host Workspace dashboard";
  if (pagePath === "/host/properties") return "the host property portfolio";
  if (/^\/host\/properties\/[^/]+$/.test(pagePath))
    return "a host property workspace";
  if (pagePath === "/host/bookings") return "the host bookings workspace";
  if (/^\/host\/bookings\/[^/]+$/.test(pagePath))
    return "a host booking detail page";
  if (pagePath.startsWith("/host/settings"))
    return "the host settings workspace";
  if (pagePath.startsWith("/host/onboarding")) return "host onboarding";
  if (pagePath.startsWith("/host/")) return "the Host Workspace";
  if (/^\/stays\/[^/]+$/.test(pagePath)) return "a public property page";
  if (pagePath.startsWith("/search")) return "stay search";
  if (pagePath.startsWith("/checkout")) return "checkout";
  if (pagePath.startsWith("/booking/")) return "the guest booking journey";
  if (pagePath.startsWith("/admin/")) return "an admin workspace page";
  return "a public Staynex page";
}

export function accountContextFacts(
  user: AuthUser | null,
  pagePath?: string,
): string[] {
  const surface = assistantSurface(pagePath);
  if (!user) {
    return [
      "The current visitor is not signed in; do not infer an account role.",
      `The current application surface is ${surface}.`,
    ];
  }

  const capabilities = user.capabilities.join(", ");
  return [
    `The backend-verified signed-in account capabilities are: ${capabilities}.`,
    isOwnerCapable(user)
      ? "This account has host access. Guest booking access remains available because capabilities are additive; do not describe this person as guest-only."
      : "This account does not have host access; do not claim that it owns or manages properties.",
    `The current application surface is ${surface}.`,
  ];
}

export function accountIdentityAnswer(
  message: string,
  user: AuthUser | null,
  pagePath?: string,
): string | null {
  if (!ROLE_QUESTION.test(message)) return null;

  if (!user) {
    return "You are not signed in, so I can only treat this as a public guest session. Sign in to let Staynex verify whether your account has host access.";
  }
  if (isOwnerCapable(user)) {
    const location = pagePath?.startsWith("/host/")
      ? " You are currently in the Host Workspace."
      : " You can open the Host Workspace to manage your properties.";
    return `Your signed-in account has host access.${location} You can also book stays as a guest, but you are not a guest-only user.`;
  }
  if (
    user.capabilities.includes("ADMIN_MANAGER") ||
    user.capabilities.includes("ADMIN_REVIEWER")
  ) {
    return "Your signed-in account has Staynex admin access. It does not currently have host access, so I will not expose owner-only property insights.";
  }
  return "Your signed-in account is a guest account. It does not currently have host access; use the List your property journey if you want to become a host.";
}

export function shouldLoadHostInsights(
  message: string,
  pagePath?: string,
): boolean {
  if (pagePath?.startsWith("/host/")) return true;
  return /\b(my|our)\b[^?]{0,40}\b(property|properties|listing|listings|booking|bookings|earning|earnings|payout|payouts|room|rooms|performance|portfolio)\b|\bhost (dashboard|performance|insights|portfolio)\b/i.test(
    message,
  );
}

export function hostPropertyId(pagePath?: string): string | null {
  const match = pagePath?.match(/^\/host\/properties\/([^/]+)$/);
  const id = match?.[1];
  return id && id !== "new" ? id : null;
}
