import { LinkButton } from "@/ui";
import { ErrorState } from "@/components/error-state";

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-background">
      <ErrorState
        icon="404"
        title="Page not found"
        message="The page you're looking for doesn't exist or may have moved."
      >
        <LinkButton href="/">Back to home</LinkButton>
        <LinkButton href="/search" variant="secondary">
          Search stays
        </LinkButton>
      </ErrorState>
    </main>
  );
}
