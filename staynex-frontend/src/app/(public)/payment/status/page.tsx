import { PaymentStatusClient } from "@/features/booking/payment-status-client";

export const dynamic = "force-dynamic";

export default async function PaymentStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const sp = await searchParams;
  const reference = sp.reference ?? sp.trxref ?? null;

  return (
    <main className="layout-container py-12">
      <div className="mx-auto max-w-md">
        {reference ? (
          <PaymentStatusClient reference={reference} />
        ) : (
          <div className="surface-card p-6 text-center text-muted-foreground">
            Missing payment reference.
          </div>
        )}
      </div>
    </main>
  );
}
