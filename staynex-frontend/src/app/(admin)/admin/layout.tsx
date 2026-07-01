import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ADMIN_NAV } from "@/components/nav-config";
import { requireServerCapability } from "@/lib/server-authorization";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireServerCapability(["ADMIN_REVIEWER", "ADMIN_MANAGER"], "/admin");

  return (
    <DashboardShell
      workspace="Admin console"
      nav={ADMIN_NAV}
      accountHref="/admin/settings"
    >
      {children}
    </DashboardShell>
  );
}
