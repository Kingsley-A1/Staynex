import Link from "next/link";
import { Brandmark } from "@/components/brandmark";
import { ClientHeaderAuthControls } from "@/features/auth/client-header-auth-controls";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border bg-background/80 backdrop-blur-md">
      <div className="layout-container flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="Staynex Bookings home"
          className="inline-flex items-center"
        >
          <Brandmark priority />
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium">
          <Link
            href="/reviews"
            className="hidden whitespace-nowrap rounded-md px-3 py-2 text-muted-foreground hover:text-ink sm:inline-flex"
          >
            Reviews
          </Link>
          <Link
            href="/list-your-property"
            className="hidden whitespace-nowrap rounded-md px-3 py-2 text-muted-foreground hover:text-ink md:inline-flex"
          >
            List your property
          </Link>
          <ClientHeaderAuthControls />
        </nav>
      </div>
    </header>
  );
}
