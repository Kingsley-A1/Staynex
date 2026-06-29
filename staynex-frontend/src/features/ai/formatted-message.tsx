import Link from "next/link";
import type { ReactNode } from "react";

// Minimal, dependency-free, XSS-safe renderer for Staynex AI replies. The model
// emits short text with **bold**, numbered/bulleted lists, line breaks, and
// occasional `/stays/<slug>` paths or URLs. We render React elements only (never
// dangerouslySetInnerHTML), so there is no injection surface. This keeps the
// frontend's zero-runtime-dependency footprint intact.

const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const UNORDERED = /^\s*[-•*]\s+(.*)$/;
// Inline: **bold** | absolute URL | internal /stays/<slug> path.
const INLINE = /\*\*([^*]+)\*\*|(https?:\/\/[^\s)]+)|(\/stays\/[a-zA-Z0-9-]+)/g;

export function FormattedMessage({
  content,
  onNavigate,
}: {
  content: string;
  onNavigate?: () => void;
}) {
  const blocks = content.trim().split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, i) => (
        <Block key={i} text={block} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function Block({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;

  if (lines.every((l) => ORDERED.test(l))) {
    return (
      <ol className="list-decimal space-y-1 pl-5">
        {lines.map((l, i) => (
          <li key={i}>{renderInline(l.replace(ORDERED, "$1"), onNavigate)}</li>
        ))}
      </ol>
    );
  }

  if (lines.every((l) => UNORDERED.test(l))) {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {lines.map((l, i) => (
          <li key={i}>{renderInline(l.replace(UNORDERED, "$1"), onNavigate)}</li>
        ))}
      </ul>
    );
  }

  return (
    <p>
      {lines.map((l, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {renderInline(l, onNavigate)}
        </span>
      ))}
    </p>
  );
}

function renderInline(text: string, onNavigate?: () => void): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  INLINE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));

    if (match[1] !== undefined) {
      nodes.push(<strong key={key++}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      nodes.push(
        <a
          key={key++}
          href={match[2]}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {match[2]}
        </a>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <Link
          key={key++}
          href={match[3]}
          onClick={onNavigate}
          className="text-primary underline underline-offset-2"
        >
          {match[3]}
        </Link>,
      );
    }

    last = match.index + match[0].length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
