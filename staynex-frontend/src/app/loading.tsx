// Route-level loading fallback (App Router Suspense). A calm, branded spinner —
// crisp and minimal, no logo. Pure CSS, no client JS.
export default function Loading() {
  return (
    <div className="brand-loader" role="status" aria-live="polite">
      <span className="brand-spinner" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
