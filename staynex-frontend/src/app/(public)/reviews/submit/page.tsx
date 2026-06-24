import Link from "next/link";
import { ReviewForm } from "@/features/reviews/review-form";

export const dynamic = "force-dynamic";

export default async function SubmitReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>;
}) {
  const { booking } = await searchParams;

  return (
    <main className="layout-container py-10">
      <div className="mx-auto max-w-xl">
        {booking ? (
          <ReviewForm bookingId={booking} />
        ) : (
          <p className="text-muted-foreground">
            No booking selected.{" "}
            <Link href="/" className="font-semibold text-primary">
              Go home
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
