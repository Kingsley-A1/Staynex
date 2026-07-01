import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Access denied - Staynex",
  robots: { index: false },
};

export default function ForbiddenPage() {
  return (
    <main className="layout-container flex min-h-dvh items-center justify-center py-12">
      <section className="mx-auto max-w-md text-center">
        <p className="text-overline text-error">Access denied</p>
        <h1 className="mt-2 text-title-lg text-ink">
          You do not have access to this workspace.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Use the account with the right Staynex permissions, or return to
          public booking.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sign in
          </Link>
          <Link
            href="/search"
            className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Find a stay
          </Link>
        </div>
      </section>
    </main>
  );
}
