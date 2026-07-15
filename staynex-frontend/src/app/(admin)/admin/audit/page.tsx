import { AuditLogView } from "@/features/admin/audit-log-view";
import { getAuditLogs } from "@/lib/server-reports";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const { data, offline } = await getAuditLogs();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-title-lg text-ink">Audit log</h1>
        <p className="text-muted-foreground">
          Every admin override is recorded here for accountability. Open any row to inspect
          its actor, property, entity, and source identifiers.
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
        <AuditLogView rows={data} />
      )}
    </div>
  );
}
