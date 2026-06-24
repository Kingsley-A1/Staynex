import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata: Metadata = { title: "Create account — Staynex" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="layout-container py-12">
      <div className="mx-auto max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-title-lg text-ink">Create your account</h1>
          <p className="mt-1 text-muted-foreground">
            You can browse stays without one — an account is only needed to book.
          </p>
        </header>
        <AuthForm mode="register" next={next} />
      </div>
    </main>
  );
}
