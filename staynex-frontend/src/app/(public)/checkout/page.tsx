import Link from "next/link";
import { CheckoutClient } from "@/features/booking/checkout-client";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ hold?: string }>;
}) {
  const { hold } = await searchParams;

  return (
    <main className="layout-container py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-title-lg text-ink">Checkout</h1>
        {hold ? (
          <CheckoutClient holdId={hold} />
        ) : (
          <p className="text-muted-foreground">
            No reservation selected.{" "}
            <Link href="/search" className="font-semibold text-primary">
              Search stays
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
