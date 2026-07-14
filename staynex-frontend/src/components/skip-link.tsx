export function SkipLink({ target = "main-content" }: { target?: string }) {
  return (
    <a
      href={`#${target}`}
      className="fixed left-4 top-3 z-[var(--z-toast)] -translate-y-20 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0"
    >
      Skip to main content
    </a>
  );
}
