import { KpiCard } from "@/ui";
import { PayoutStatusBadge } from "@/components/status-pill";
import { PayoutActions } from "@/features/admin/payout-actions";
import { getAdminPayouts } from "@/lib/server-reports";
import { formatNairaFromKobo, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage() {
  const { data, offline } = await getAdminPayouts();

  if (!data) {
    return (
      <div className="surface-card p-6 text-center text-muted-foreground" role="status">
        {offline
          ? "We couldn't reach the payout service. Start the API to see live settlements."
          : "No payout data is available yet."}
      </div>
    );
  }

  const now = Date.now();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-title-lg text-ink">Payouts</h1>
        <p className="text-muted-foreground">
          Host settlements. Payouts are settled manually after check-in (net of the platform fee).
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Gross revenue"
          value={formatNairaFromKobo(data.totals.grossRevenueKobo)}
          hint="Successful payments"
        />
        <KpiCard
          label="Staynex commission"
          value={formatNairaFromKobo(data.totals.platformCommissionKobo)}
        />
        <KpiCard
          label="Pending payout"
          value={formatNairaFromKobo(data.totals.pendingPayoutKobo)}
          hint="Owed to hosts"
        />
        <KpiCard label="Paid out" value={formatNairaFromKobo(data.totals.paidPayoutKobo)} />
      </div>

      <section className="space-y-3">
        <h2 className="text-title-sm text-ink">Settlement queue</h2>
        <div className="surface-card overflow-x-auto">
          {data.payouts.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">
              No payouts yet. They appear here once guests complete payment.
            </p>
          ) : (
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="border-b border-border text-caption uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <th className="px-4 py-3 font-semibold">Host</th>
                  <th className="px-4 py-3 font-semibold">Destination</th>
                  <th className="px-4 py-3 font-semibold text-right">Host payout</th>
                  <th className="px-4 py-3 font-semibold">Eligible</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.payouts.map((p) => {
                  const eligible = new Date(p.eligibleAt).getTime() <= now;
                  const settleable = p.status === "PENDING" || p.status === "PROCESSING";
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{p.propertyName}</div>
                        <div className="text-caption">{p.cityName}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.ownerName ?? p.ownerEmail ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {p.bankName ? (
                          <>
                            <div className="text-ink">{p.bankName}</div>
                            <div className="text-caption">
                              {p.accountName ?? "—"} ····{p.accountNumberLast4 ?? "????"}
                            </div>
                          </>
                        ) : (
                          <span className="text-caption text-warning">No payout method</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-ink">
                        {formatNairaFromKobo(p.ownerPayoutKobo)}
                        <div className="text-caption font-normal text-muted-foreground">
                          of {formatNairaFromKobo(p.grossAmountKobo)} gross
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(p.eligibleAt)}
                        {!eligible && settleable ? (
                          <span className="block text-caption text-warning">Not yet eligible</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <PayoutStatusBadge status={p.status} />
                        {p.note && (
                          <span className="mt-1 block max-w-56 text-caption text-muted-foreground">
                            {p.note}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {settleable ? (
                          <PayoutActions payoutId={p.id} eligible={eligible} />
                        ) : (
                          <span className="text-caption text-muted-foreground">
                            {p.paidAt
                              ? `Paid ${formatDate(p.paidAt)}`
                              : p.failedAt
                                ? `Failed ${formatDate(p.failedAt)}`
                                : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-caption">
          Settling or failing a payout records an audit log entry. Early settlement requires an
          explicit override with a note. Automated bank transfers arrive in Phase B.
        </p>
      </section>
    </div>
  );
}
