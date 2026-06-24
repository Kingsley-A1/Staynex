import { getAuditLogs } from "@/lib/server-reports";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const { data, offline } = await getAuditLogs();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-title-lg text-ink">Audit log</h1>
        <p className="text-muted-foreground">
          Every admin override is recorded here for accountability.
        </p>
      </header>

      {!data ? (
        <div className="surface-card p-6 text-center text-muted-foreground" role="status">
          {offline ? "We couldn't reach the audit service." : "No audit data is available yet."}
        </div>
      ) : data.length === 0 ? (
        <div className="surface-card p-6 text-center text-muted-foreground">
          No override actions recorded yet.
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-caption uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Entity</th>
                <th className="px-4 py-3 font-semibold">Actor</th>
                <th className="px-4 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-ink">{r.action}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.entityType} · <span className="font-mono text-xs">{r.entityId}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {r.actorUserId ?? "system"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
