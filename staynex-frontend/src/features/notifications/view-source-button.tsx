import { LinkButton } from "@/ui";

export function ViewSourceButton({ href }: { href: string | null }) {
  if (!isSafeInternalPath(href)) return null;

  return (
    <LinkButton href={href}>
      View source
      <span aria-hidden>→</span>
    </LinkButton>
  );
}

function isSafeInternalPath(href: string | null): href is string {
  return Boolean(href && href.startsWith("/") && !href.startsWith("//"));
}
