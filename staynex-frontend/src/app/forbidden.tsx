import Link from "next/link";
import type { Metadata } from "next";
import { AccountSwitchButton } from "@/features/auth/account-switch-button";
import { getServerUser } from "@/lib/server-auth";
import { capabilityHome } from "@/lib/types";

export const metadata: Metadata = {
  title: "Access denied - Staynex",
  robots: { index: false },
};

export default async function ForbiddenPage() {
  const user = await getServerUser();

  return (
    <main className="layout-container flex min-h-dvh items-center justify-center py-12">
      <section className="mx-auto max-w-md text-center">
        <p className="text-overline text-error">Access denied</p>
        <h1 className="mt-2 text-title-lg text-ink">
          This account cannot open this workspace.
        </h1>
        <p className="mt-3 text-muted-foreground">
          {user
            ? `You are signed in${user.email ? ` as ${user.email}` : ""}, but this account does not include the required Staynex permission.`
            : "Sign in with an account that has the required Staynex permission."}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {user ? (
            <AccountSwitchButton destination="/sign-in" />
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign in
            </Link>
          )}
          <Link
            href={user ? capabilityHome(user) : "/search"}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {user ? "Go to my workspace" : "Find a stay"}
          </Link>
          <Link
            href="/support"
            className="inline-flex min-h-11 items-center justify-center rounded-md px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Contact support
          </Link>
        </div>
      </section>
    </main>
  );
}
