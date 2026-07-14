import { getAiLogs } from "@/lib/server-reports";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminAiLogsPage() {
  const { data, offline } = await getAiLogs();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-title-lg text-ink">Staynex AI logs</h1>
        <p className="text-muted-foreground">
          Staynex AI is tool-first and bounded. Every reply, refusal, and
          unavailable response is logged here.
        </p>
      </header>

      {!data ? (
        <div className="surface-card p-6 text-center text-muted-foreground" role="status">
          {offline ? "We couldn't reach the AI log service." : "No AI log data is available yet."}
        </div>
      ) : data.length === 0 ? (
        <div className="surface-card p-6 text-center text-muted-foreground">
          No assistant activity recorded yet.
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-caption uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Summary</th>
                <th className="px-4 py-3 font-semibold">Conversation</th>
                <th className="px-4 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-ink">{r.actionType}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.summary ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {r.conversationId.slice(0, 10)}…
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
