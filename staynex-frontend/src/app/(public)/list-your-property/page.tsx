import type { Metadata } from "next";
import { LinkButton } from "@/ui";

export const metadata: Metadata = {
  title: "List your property — Staynex",
  description: "Turn your property into a reliable booking channel with Staynex.",
};

const STEPS = [
  { title: "Create your listing", desc: "Add your property, rooms, photos, and pricing." },
  { title: "Get approved", desc: "Our team reviews your listing before it goes live." },
  { title: "Receive bookings", desc: "Manage availability, bookings, and earnings in one place." },
];

export default function ListYourPropertyPage() {
  return (
    <main className="layout-container py-12">
      <div className="mx-auto max-w-2xl">
        <header className="text-center">
          <p className="text-overline">For property owners</p>
          <h1 className="mt-2 text-title-lg text-ink">
            Turn your property into a reliable booking channel
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            List once and manage availability, bookings, and earnings from one dashboard. No upfront
            cost to get started.
          </p>
        </header>

        <ol className="mt-10 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="surface-card flex gap-4 p-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-subtle font-bold text-primary">
                {i + 1}
              </span>
              <div>
                <h2 className="font-semibold text-ink">{s.title}</h2>
                <p className="text-body-sm text-muted-foreground">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/owner/register?next=/owner/onboarding">
            Get started as an owner
          </LinkButton>
          <LinkButton href="/owner/dashboard" variant="secondary">
            Owner dashboard
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
