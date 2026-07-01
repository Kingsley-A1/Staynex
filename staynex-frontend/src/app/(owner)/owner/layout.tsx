import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { OWNER_NAV } from "@/components/nav-config";
import { requireServerCapability } from "@/lib/server-authorization";

export default async function OwnerLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireServerCapability(["OWNER"], "/owner/dashboard");

  return (
    <DashboardShell
      workspace="Owner workspace"
      nav={OWNER_NAV}
      accountHref="/owner/settings"
    >
      {children}
    </DashboardShell>
  );
}
