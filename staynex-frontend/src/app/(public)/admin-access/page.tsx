import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountSwitchButton } from "@/features/auth/account-switch-button";
import { AuthForm } from "@/features/auth/auth-form";
import { getServerUser } from "@/lib/server-auth";
import { isAdminCapable } from "@/lib/types";

export const metadata: Metadata = {
  title: "Admin sign in — Staynex",
  robots: { index: false },
};

export default async function AdminAccessPage() {
  const user = await getServerUser();
  if (isAdminCapable(user)) redirect("/admin");

  return (
    <main className="layout-container py-12 sm:py-16">
      <div className="mx-auto max-w-md space-y-6">
        <header className="text-center">
          <p className="text-overline text-primary">Staff workspace</p>
          <h1 className="mt-2 text-title-lg text-ink">Admin sign in</h1>
          <p className="mt-2 text-muted-foreground">
            Use your authorized Staynex staff account. Super Admin accounts
            complete email verification before a session is created.
          </p>
        </header>

        {user ? (
          <section
            className="surface-card space-y-5 p-6 text-center"
            role="alert"
          >
            <div>
              <h2 className="text-title-sm text-ink">Admin access required</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You are signed in{user.email ? ` as ${user.email}` : ""}, but
                this account does not have admin permissions.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <AccountSwitchButton
                destination="/admin-access"
                label="Sign out and use a staff account"
              />
              <Link
                href="/support"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Contact support
              </Link>
            </div>
          </section>
        ) : (
          <AuthForm mode="login" next="/admin" requireAdmin />
        )}

        <p className="text-center text-caption text-muted-foreground">
          Staff accounts are issued by Staynex. Need help?{" "}
          <Link href="/support" className="font-semibold text-primary">
            Contact support
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
