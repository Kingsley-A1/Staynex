import { Badge } from "@/ui";
import { Stars } from "@/features/reviews/stars";
import { TestimonialActions } from "@/features/admin/testimonial-actions";
import { getAdminTestimonials } from "@/lib/server-reports";
import { formatDate } from "@/lib/format";
import { TESTIMONIAL_STATUS_LABELS, type TestimonialStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<TestimonialStatus, string> = {
  PENDING_REVIEW: "border-warning-border bg-warning-surface text-warning",
  APPROVED: "border-success-border bg-success-surface text-success",
  REJECTED: "border-error-border bg-error-surface text-error",
};

export default async function AdminTestimonialsPage() {
  const { data, offline } = await getAdminTestimonials();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-title-lg text-ink">Testimonials</h1>
        <p className="text-muted-foreground">
          Approve, reject, or hold guest reviews. Only approved reviews appear publicly.
        </p>
      </header>

      {!data ? (
        <div className="surface-card p-6 text-center text-muted-foreground" role="status">
          {offline
            ? "We couldn't reach the reviews service."
            : "No testimonial data is available yet."}
        </div>
      ) : data.length === 0 ? (
        <div className="surface-card p-6 text-center text-muted-foreground">
          No testimonials submitted yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map((t) => (
            <li
              key={t.id}
              className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars rating={t.rating} />
                  <Badge className={STATUS_STYLES[t.status]}>
                    {TESTIMONIAL_STATUS_LABELS[t.status]}
                  </Badge>
                </div>
                {t.title && <p className="font-semibold text-ink">{t.title}</p>}
                <p className="text-body-sm text-muted-foreground">“{t.body}”</p>
                <p className="text-caption">
                  {t.guestName ?? "Guest"} · {t.propertyName}, {t.cityName} · {formatDate(t.createdAt)}
                </p>
              </div>
              <TestimonialActions id={t.id} status={t.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
