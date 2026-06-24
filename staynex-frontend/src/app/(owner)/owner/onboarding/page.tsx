import { LinkButton, Stepper } from "@/ui";

const STEPS = [
  { id: "account", title: "Account" },
  { id: "business", title: "Business details" },
  { id: "property", title: "First property" },
  { id: "review", title: "Submit for review" },
];

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-title-lg text-ink">Welcome to Staynex for owners</h1>
        <p className="text-muted-foreground">
          Set up your business and list your first property in a few steps.
        </p>
      </header>

      <Stepper steps={STEPS} current={2} />

      <div className="surface-card space-y-4 p-6">
        <h2 className="text-title-sm">Step 3 · Add your first property</h2>
        <p className="text-body-sm text-muted-foreground">
          Create a property draft, add room types and photos, then submit it for admin review.
          Your listing goes live once an admin approves it.
        </p>
        <LinkButton href="/owner/properties/new">Create your first property</LinkButton>
      </div>
    </div>
  );
}
