"use client";

import { Button, LinkButton } from "@/ui";
import { ErrorState } from "@/components/error-state";

export default function OfflinePage() {
  return (
    <main className="min-h-dvh bg-background">
      <ErrorState
        icon="⚡"
        title="No internet connection"
        message="You appear to be offline. Check your connection and try again — your booking progress is safe."
      >
        <Button onClick={() => window.location.reload()}>Try again</Button>
        <LinkButton href="/" variant="secondary">
          Back to home
        </LinkButton>
      </ErrorState>
    </main>
  );
}
