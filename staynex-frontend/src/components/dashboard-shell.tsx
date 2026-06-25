import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { RoleNav } from "@/components/role-nav";
import { MobileNav } from "@/components/mobile-nav";
import type { NavItem } from "@/components/nav-config";

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
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden border-r border-border bg-surface-raised lg:block">
        <div className="sticky top-0">
          <div className="flex h-16 items-center px-5">
            <Link href="/" aria-label="Staynex home" className="relative block h-9 w-32">
              <Image
                src="/assets/logo.png"
                alt="Staynex"
                fill
                sizes="128px"
                className="object-cover object-center"
              />
            </Link>
          </div>
          <div className="px-3 pb-3">
            <p className="px-3 pb-2 text-overline text-muted-foreground">{workspace}</p>
            <RoleNav items={nav} />
          </div>
        </div>
      </aside>

      {/* Mobile top bar with hamburger — hidden on desktop */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface-raised px-4 lg:hidden">
        <Link href="/" aria-label="Staynex home" className="relative block h-9 w-32">
          <Image
            src="/assets/logo.png"
            alt="Staynex"
            fill
            sizes="128px"
            className="object-cover object-center"
          />
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-overline text-muted-foreground">{workspace}</span>
          <MobileNav items={nav} workspace={workspace} />
        </div>
      </header>

      <main className="layout-container py-8">{children}</main>
    </div>
  );
}
