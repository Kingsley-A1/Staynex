import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/auth-form";
import { authDestination } from "@/features/auth/navigate";
import { getServerUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Sign in — Staynex" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Already signed in? Don't show the form — forward to the destination (or
  // their capability home). This also self-heals the stale-router-cache case
  // where an authenticated user gets bounced here by a cached redirect.
  const user = await getServerUser();
  if (user) redirect(authDestination(user, next));

  return (
    <main className="layout-container py-12">
      <div className="mx-auto max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-title-lg text-ink">Welcome back</h1>
          <p className="mt-1 text-muted-foreground">Sign in to continue.</p>
        </header>
        <AuthForm mode="login" next={next} />
      </div>
    </main>
  );
}
