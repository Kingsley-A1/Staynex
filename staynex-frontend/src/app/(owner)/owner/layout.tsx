import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { OWNER_NAV } from "@/components/nav-config";

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell workspace="Owner workspace" nav={OWNER_NAV}>
      {children}
    </DashboardShell>
  );
}
