import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata: Metadata = {
  title: "Become a host — Staynex",
  description: "Create your Staynex host account and start listing your property.",
};

export default async function OwnerRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="layout-container py-12">
      <div className="mx-auto max-w-md space-y-6">
        <header className="text-center">
          <p className="text-overline">For hosts</p>
          <h1 className="mt-2 text-title-lg text-ink">List your property on Staynex</h1>
          <p className="mt-1 text-muted-foreground">
            Create your host account. Next you'll set up your business profile, locations, and payout
            method.
          </p>
        </header>
        <AuthForm mode="register" roleIntent="OWNER" next={next || "/host/onboarding"} />
        <p className="text-center text-caption">
          Already hosting with us?{" "}
          <Link href="/sign-in?next=/host/dashboard" className="font-semibold text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
