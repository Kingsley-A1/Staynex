import Link from "next/link";
import { Brandmark } from "@/components/brandmark";
import { HeaderAuthControls } from "@/features/auth/header-auth-controls";
import { getServerUser } from "@/lib/server-auth";

export async function PublicHeader() {
  const user = await getServerUser();
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border bg-background/80 backdrop-blur-md">
      <div className="layout-container flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="Staynex home"
          className="inline-flex items-center"
        >
          <Brandmark className="h-9 w-32" priority />
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
          <HeaderAuthControls user={user} />
        </nav>
      </div>
    </header>
  );
}
