import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ADMIN_NAV } from "@/components/nav-config";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell workspace="Admin console" nav={ADMIN_NAV} accountHref="/admin/settings">
      {children}
    </DashboardShell>
  );
}
