"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, LinkButton } from "@/ui";
import { apiErrorMessage, authApi, catalogApi, hostApiSettings } from "@/lib/api";
import {
  type AuthUser,
  type CityOption,
  isOwnerCapable,
  type OwnerOnboardingState,
} from "@/lib/types";
import { HostLocationsManager, HostPayoutCard, HostProfileCard } from "./host-cards";

export function HostOnboarding() {
  const router = useRouter();
  const [me, setMe] = useState<AuthUser | null | undefined>(undefined);
  const [state, setState] = useState<OwnerOnboardingState | null>(null);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [upgrading, setUpgrading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const user = await authApi.me();
    setMe(user);
    if (isOwnerCapable(user)) {
      const [s, c] = await Promise.all([hostApiSettings.onboarding(), catalogApi.cities()]);
      setState(s);
      setCities(c);
    }
  }, []);

  useEffect(() => {
    load().catch(() => setMe(null));
  }, [load]);

  const reloadState = useCallback(async () => {
    setState(await hostApiSettings.onboarding());
  }, []);

  async function becomeHost() {
    setUpgrading(true);
    try {
      await authApi.becomeHost();
      await load();
    } finally {
      setUpgrading(false);
    }
  }

  async function finish(skipPayout: boolean) {
    setFinishing(true);
    setFinishError(null);
    try {
      setState(await hostApiSettings.completeOnboarding(skipPayout));
    } catch (err) {
      setFinishError(apiErrorMessage(err, "Couldn't finish onboarding. Complete the steps above."));
    } finally {
      setFinishing(false);
    }
  }

  if (me === undefined) {
    return <p className="surface-card p-6 text-muted-foreground">Loading…</p>;
  }

  if (me === null) {
    return (
      <Gate
        title="Sign in to continue"
        body="Create a host account or sign in to set up your hosting profile."
      >
        <LinkButton href="/host/register?next=/host/onboarding">Create host account</LinkButton>
        <LinkButton href="/sign-in?next=/host/onboarding" variant="secondary">
          Sign in
        </LinkButton>
      </Gate>
    );
  }

  if (!isOwnerCapable(me)) {
    return (
      <Gate
        title="Become a host"
        body="You're signed in as a guest. Upgrade this account to start hosting — no need to create a new one."
      >
        <Button onClick={becomeHost} disabled={upgrading}>
          {upgrading ? "Please wait…" : "Continue as owner"}
        </Button>
      </Gate>
    );
  }

  if (!state) {
    return <p className="surface-card p-6 text-muted-foreground">Loading your onboarding…</p>;
  }

  const completed = Boolean(state.profile.onboardingCompletedAt);
  const { readiness } = state;
  const hasPayout = state.payoutMethod !== null;

  if (completed) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="surface-card space-y-4 p-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-success-surface text-success">
            <CheckIcon className="size-6" />
          </span>
          <div>
            <h2 className="text-title-sm text-ink">You're ready to host</h2>
            <p className="mt-1 text-body-sm text-muted-foreground">
              Your owner profile is set up. Create your first property to start receiving bookings.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <LinkButton href="/host/properties/new">Create your first property</LinkButton>
            <LinkButton href="/host/settings" variant="secondary">
              Manage settings
            </LinkButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />

      <ol className="surface-card divide-y divide-border p-2">
        <ChecklistItem done={readiness.hasBusinessName} label="Business name" />
        <ChecklistItem done={readiness.hasPhone} label="Contact phone" />
        <ChecklistItem done={readiness.hasLocation} label="At least one location" />
        <ChecklistItem
          done={hasPayout}
          label="Payout method"
          optional="optional — you can add it later"
        />
      </ol>

      <HostProfileCard profile={state.profile} onChanged={reloadState} />
      <HostLocationsManager locations={state.locations} cities={cities} onChanged={reloadState} />
      <HostPayoutCard payoutMethod={state.payoutMethod} onChanged={reloadState} />

      <div className="surface-card space-y-3 p-6">
        <h2 className="text-title-sm text-ink">Finish onboarding</h2>
        {readiness.hasBusinessName && readiness.hasPhone && readiness.hasLocation ? (
          <>
            <p className="text-body-sm text-muted-foreground">
              {hasPayout
                ? "Everything's set. Finish to unlock your owner dashboard."
                : "You can finish now and add your payout method later from settings."}
            </p>
            {finishError && (
              <p className="text-sm text-error" role="alert">
                {finishError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => finish(!hasPayout)} disabled={finishing}>
                {finishing ? "Finishing…" : hasPayout ? "Finish onboarding" : "Finish, add payout later"}
              </Button>
              <button
                type="button"
                onClick={() => router.push("/host/dashboard")}
                className="text-sm font-medium text-muted-foreground hover:text-ink"
              >
                Go to dashboard
              </button>
            </div>
          </>
        ) : (
          <p className="text-body-sm text-muted-foreground">
            Add your business name, contact phone, and at least one location to finish.
          </p>
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="space-y-2">
      <h1 className="text-title-lg text-ink">Welcome to Staynex for owners</h1>
      <p className="text-muted-foreground">
        Set up your business so guests can book with confidence. Your progress is saved as you go.
      </p>
    </header>
  );
}

function Gate({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md space-y-5 text-center">
      <header className="space-y-2">
        <h1 className="text-title-lg text-ink">{title}</h1>
        <p className="text-muted-foreground">{body}</p>
      </header>
      <div className="flex flex-wrap justify-center gap-2">{children}</div>
    </div>
  );
}

function ChecklistItem({
  done,
  label,
  optional,
}: {
  done: boolean;
  label: string;
  optional?: string;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-full ${
          done ? "bg-success-surface text-success" : "border border-border text-muted-foreground"
        }`}
      >
        {done ? <CheckIcon className="size-4" /> : <span className="size-1.5 rounded-full bg-current" />}
      </span>
      <span className={done ? "text-ink" : "text-muted-foreground"}>
        {label}
        {optional && <span className="text-caption"> · {optional}</span>}
      </span>
    </li>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}
