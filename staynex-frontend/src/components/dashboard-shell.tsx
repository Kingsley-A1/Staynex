import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { RoleNav } from "@/components/role-nav";
import type { NavItem } from "@/components/nav-config";

// Shared owner/admin workspace chrome: brand + role nav as a sidebar on large
// screens, stacked header + horizontal nav on mobile. Replaces the duplicated
// owner/admin layout markup.
export function DashboardShell({
  workspace,
  nav,
  children,
}: {
  workspace: string;
  nav: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-border bg-surface-raised lg:border-b-0 lg:border-r">
        <div className="lg:sticky lg:top-0">
          <div className="layout-container flex h-16 items-center justify-between gap-4 lg:px-5">
            <Link href="/" aria-label="Staynex home" className="relative block h-9 w-32">
              <Image
                src="/assets/logo.png"
                alt="Staynex"
                fill
                sizes="128px"
                className="object-cover object-center"
              />
            </Link>
            <span className="text-overline lg:hidden">{workspace}</span>
          </div>
          <div className="layout-container pb-3 lg:px-3">
            <p className="hidden px-3 pb-2 text-overline lg:block">{workspace}</p>
            <RoleNav items={nav} />
          </div>
        </div>
      </aside>
      <main className="layout-container py-8">{children}</main>
    </div>
  );
}
