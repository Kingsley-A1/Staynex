import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { DashboardNav } from "@/components/dashboard-nav";

const NAV = [{ href: "/admin/approvals", label: "Approvals" }];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-surface-raised">
        <div className="layout-container flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label="Staynex home" className="relative block h-9 w-32">
            <Image
              src="/assets/logo.png"
              alt="Staynex"
              fill
              sizes="128px"
              className="object-cover object-center"
            />
          </Link>
          <span className="text-overline">Admin console</span>
        </div>
        <div className="layout-container pb-3">
          <DashboardNav items={NAV} />
        </div>
      </header>
      <main className="layout-container py-8">{children}</main>
    </div>
  );
}
