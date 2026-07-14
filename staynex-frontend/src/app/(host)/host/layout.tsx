import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { HOST_NAV } from "@/components/nav-config";
import { requireServerCapability } from "@/lib/server-authorization";

export default async function HostLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireServerCapability(["OWNER"], "/host/dashboard");

  return (
    <DashboardShell
      workspace="Host workspace"
      nav={HOST_NAV}
      accountHref="/host/settings"
    >
      {children}
    </DashboardShell>
  );
}
