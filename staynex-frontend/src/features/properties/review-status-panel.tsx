import { Badge, LinkButton, ReviewStatusBadge } from "@/ui";
import type {
  PropertyDetail,
  PropertyReviewCheckKey,
  PropertyReviewCheckView,
} from "@/lib/types";

export function ReviewStatusPanel({ property }: { property: PropertyDetail }) {
  const latest = property.latestReview;
  const checks = latest?.checks ?? [];
  const hasChecks = checks.length > 0;

  return (
    <section className="surface-card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-title-sm text-ink">Review status</h2>
          <p className="text-caption">{reviewSummary(property)}</p>
        </div>
        <ReviewStatusBadge status={property.reviewStatus} />
      </div>

      {latest && (
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <ReviewMetric
            label="Source"
            value={latest.source === "AUTO_REVIEW" ? "Auto-review" : "Admin"}
          />
          <ReviewMetric label="Risk score" value={`${latest.riskScore}/100`} />
          <ReviewMetric
            label="Reviewed"
            value={
              latest.completedAt ? formatDateTime(latest.completedAt) : "—"
            }
          />
          <ReviewMetric
            label="Scheduled"
            value={
              property.scheduledPublishAt
                ? formatDateTime(property.scheduledPublishAt)
                : "—"
            }
          />
        </div>
      )}

      {latest?.summary && (
        <p className="text-body-sm text-muted-foreground">{latest.summary}</p>
      )}

      {hasChecks && (
        <ul className="space-y-2">
          {checks.map((check) => (
            <li
              key={check.id}
              className="flex flex-wrap items-start justify-between gap-3 border-t border-border pt-3"
            >
              <div>
                <p className="font-semibold text-ink">{check.label}</p>
                <p className="text-caption">{check.details}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <CheckBadge check={check} />
                {check.status === "FAIL" && (
                  <LinkButton
                    href={reviewFixHref(check.key, property.id)}
                    variant="secondary"
                    size="sm"
                    aria-label={`Edit ${check.label.toLowerCase()}`}
                  >
                    Edit
                  </LinkButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function reviewFixHref(
  key: PropertyReviewCheckKey,
  propertyId: string,
): string {
  const details = `/host/properties/${propertyId}?edit=details#property-details`;
  const targets: Record<PropertyReviewCheckKey, string> = {
    owner_identity: "/settings",
    payout_ready: "/host/settings?edit=payout#payout-method",
    property_details: details,
    location_ready: details,
    media_ready: "#property-photos",
    rooms_ready: "#room-types",
    availability_ready: "#availability",
    duplicate_listing: details,
    content_safety: details,
  };
  return targets[key];
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-caption">{label}</p>
      <p className="font-semibold text-ink">{value}</p>
    </div>
  );
}

function CheckBadge({ check }: { check: PropertyReviewCheckView }) {
  if (check.status === "PASS") {
    return (
      <Badge className="border-success-border bg-success-surface text-success">
        Pass
      </Badge>
    );
  }
  if (check.status === "WARNING") {
    return (
      <Badge className="border-warning-border bg-warning-surface text-warning">
        Warning
      </Badge>
    );
  }
  return (
    <Badge className="border-error-border bg-error-surface text-error">
      Fail
    </Badge>
  );
}

function reviewSummary(property: PropertyDetail): string {
  if (property.reviewStatus === "SCHEDULED" && property.scheduledPublishAt) {
    return `Passed checks. Auto-publish is scheduled for ${formatDateTime(property.scheduledPublishAt)}.`;
  }
  if (property.reviewStatus === "FAILED")
    return "Checklist blockers need changes.";
  if (property.reviewStatus === "PUBLISHED") return "Published after review.";
  if (property.reviewStatus === "MANUAL_REVIEW")
    return "Admin has requested a manual follow-up.";
  if (property.reviewStatus === "PENDING") return "Review is running.";
  return "Not currently submitted for review.";
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
