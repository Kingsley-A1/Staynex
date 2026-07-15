import { getAdminPerformance } from "@/lib/server-reports";
import type { PerformanceMetricSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

const CORE_LABELS: Record<string, string> = {
  LCP: "Largest Contentful Paint",
  INP: "Interaction to Next Paint",
  CLS: "Cumulative Layout Shift",
  FCP: "First Contentful Paint",
  TTFB: "Time to First Byte",
};

export default async function AdminPerformancePage() {
  const { data, offline } = await getAdminPerformance();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-label text-primary">Operational monitoring</p>
        <h1 className="text-title-lg text-ink">Performance</h1>
        <p className="max-w-3xl text-muted-foreground">
          First-party browser samples for Staynex Core Web Vitals. Targets:
          LCP under 2.5s, INP under 200ms, and CLS at or below 0.1.
        </p>
      </header>

      {!data ? (
        <div className="surface-card p-6 text-center text-muted-foreground" role="status">
          {offline
            ? "We couldn't reach the performance service."
            : "No performance data is available yet."}
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {data.metrics.map((metric) => (
              <MetricCard key={metric.name} metric={metric} />
            ))}
          </section>

          <section className="surface-card space-y-3 p-4">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-title-sm text-ink">Route health</h2>
                <p className="text-caption">
                  Last {data.windowHours} hours · {data.totalSamples} browser samples
                </p>
              </div>
              <p className="text-caption">Generated {new Date(data.generatedAt).toLocaleString()}</p>
            </div>
            {data.routes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No route samples yet. Open the public, host, and booking journeys after deploy.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-border text-caption uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Route</th>
                      <th className="px-3 py-2 font-semibold">Samples</th>
                      <th className="px-3 py-2 font-semibold">LCP p75</th>
                      <th className="px-3 py-2 font-semibold">INP p75</th>
                      <th className="px-3 py-2 font-semibold">CLS p75</th>
                      <th className="px-3 py-2 font-semibold">Poor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.routes.map((route) => (
                      <tr key={route.route}>
                        <td className="px-3 py-2 font-mono text-xs text-ink">{route.route}</td>
                        <td className="px-3 py-2">{route.sampleCount}</td>
                        <td className="px-3 py-2">{formatMetric("LCP", route.lcpP75)}</td>
                        <td className="px-3 py-2">{formatMetric("INP", route.inpP75)}</td>
                        <td className="px-3 py-2">{formatMetric("CLS", route.clsP75)}</td>
                        <td className="px-3 py-2">{route.poorCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="surface-card space-y-2 p-4">
            <h2 className="text-title-sm text-ink">CTO notes</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {data.recommendations.map((recommendation) => (
                <li key={recommendation} className="rounded-lg bg-secondary px-3 py-2">
                  {recommendation}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ metric }: { metric: PerformanceMetricSummary }) {
  const isCore = metric.target !== null;
  const healthy = metric.targetMetRate === null || metric.targetMetRate >= 90;
  return (
    <article className="surface-card space-y-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-label text-ink">{metric.name}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            healthy ? "bg-primary/10 text-primary" : "bg-warning-surface text-warning"
          }`}
        >
          {isCore ? `${metric.targetMetRate ?? 0}% target` : "tracked"}
        </span>
      </div>
      <p className="text-caption">{CORE_LABELS[metric.name]}</p>
      <p className="text-2xl font-bold text-ink">{formatMetric(metric.name, metric.p75)}</p>
      <p className="text-caption">
        p75 · {metric.sampleCount} samples · {metric.poorCount} poor
      </p>
    </article>
  );
}

function formatMetric(name: string, value: number | null): string {
  if (value === null) return "—";
  if (name === "CLS") return value.toFixed(3);
  return `${Math.round(value)}ms`;
}
