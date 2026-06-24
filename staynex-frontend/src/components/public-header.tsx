import Image from "next/image";
import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border bg-background/80 backdrop-blur-md">
      <div className="layout-container flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Staynex home" className="relative block h-9 w-32">
          <Image
            src="/assets/logo.png"
            alt="Staynex"
            fill
            sizes="128px"
            priority
            className="object-cover object-center"
          />
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link href="/search" className="rounded-md px-3 py-2 text-muted-foreground hover:text-ink">
            Find a stay
          </Link>
          <Link
            href="/list-your-property"
            className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-ink sm:block"
          >
            List your property
          </Link>
        </nav>
      </div>
    </header>
  );
}
