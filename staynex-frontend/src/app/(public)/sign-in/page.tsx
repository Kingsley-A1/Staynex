import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata: Metadata = { title: "Sign in — Staynex" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
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
