import Link from "next/link";
import { StatusBadge } from "@/ui";
import { getApprovalQueue } from "@/features/properties/fixtures";
import { formatNairaFromKobo } from "@/lib/format";

export default function ApprovalsPage() {
  const queue = getApprovalQueue();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-title-lg text-ink">Property approvals</h1>
        <p className="text-muted-foreground">
          {queue.length} propert{queue.length === 1 ? "y" : "ies"} awaiting review.
        </p>
      </header>

      <ul className="space-y-3">
        {queue.length === 0 && (
          <li className="surface-card p-8 text-center text-muted-foreground">
            Nothing in the queue right now.
          </li>
        )}
        {queue.map((p) => (
          <li key={p.id}>
            <Link
              href={`/admin/approvals/${p.id}`}
              className="surface-card flex flex-wrap items-center justify-between gap-3 p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span
                  className="size-10 rounded-md bg-gradient-to-br from-indigo-500 to-indigo-800"
                  aria-hidden
                />
                <div>
                  <p className="font-semibold text-ink">{p.name}</p>
                  <p className="text-caption">
                    {p.cityName} · {p.roomTypeCount} room type{p.roomTypeCount === 1 ? "" : "s"} ·
                    from {formatNairaFromKobo(p.fromPriceKobo)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={p.status} />
                <span className="text-sm font-semibold text-primary">Review →</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
