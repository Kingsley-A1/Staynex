import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { getServerUser } from "@/lib/server-auth";
import { DashboardChrome, SIDEBAR_COOKIE, type AccountSummary } from "@/components/dashboard-chrome";
import type { WorkspaceNavItem } from "@/components/nav-config";

export async function DashboardShell({
  workspace,
  nav,
  accountHref,
  children,
}: {
  workspace: string;
  nav: WorkspaceNavItem[];
  /** Where the sidebar account footer links (settings holds the profile). */
  accountHref: string;
  children: ReactNode;
}) {
  // Cookie drives the initial collapsed width so there's no hydration flash.
  const [store, user] = await Promise.all([cookies(), getServerUser()]);
  const initialCollapsed = store.get(SIDEBAR_COOKIE)?.value === "collapsed";

  const account: AccountSummary | null = user
    ? {
        name: user.name?.trim() || user.email || "Account",
        email: user.email,
        href: accountHref,
      }
    : null;

  return (
    <DashboardChrome
      workspace={workspace}
      nav={nav}
      account={account}
      initialCollapsed={initialCollapsed}
    >
      {children}
    </DashboardChrome>
  );
}
