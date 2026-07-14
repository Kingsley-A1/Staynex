"use client";

import { useCallback, useEffect, useState } from "react";
import { LinkButton } from "@/ui";
import { catalogApi, hostApiSettings } from "@/lib/api";
import type { CityOption, OwnerSettingsView } from "@/lib/types";
import {
  HostLocationsManager,
  HostPayoutCard,
  HostProfileCard,
} from "./host-cards";

export function HostSettings({ edit }: { edit?: "payout" }) {
  const [data, setData] = useState<OwnerSettingsView | null | undefined>(
    undefined,
  );
  const [cities, setCities] = useState<CityOption[]>([]);

  const reload = useCallback(async () => {
    setData(await hostApiSettings.settings());
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([hostApiSettings.settings(), catalogApi.cities()])
      .then(([d, c]) => {
        if (!active) return;
        setData(d);
        setCities(c);
      })
      .catch(() => active && setData(null));
    return () => {
      active = false;
    };
  }, []);

  if (data === undefined) {
    return (
      <p className="surface-card p-6 text-muted-foreground">
        Loading your settings…
      </p>
    );
  }
  if (data === null) {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <p className="text-muted-foreground">
          You need a host account to manage these settings.
        </p>
        <LinkButton href="/host/register?next=/host/onboarding">
          Become a host
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section id="business-profile" className="scroll-mt-24">
        <HostProfileCard profile={data.profile} onChanged={reload} />
      </section>
      <section id="operating-locations" className="scroll-mt-24">
        <HostLocationsManager
          locations={data.locations}
          cities={cities}
          onChanged={reload}
        />
      </section>
      <section id="payout-method" className="scroll-mt-24">
        <HostPayoutCard
          payoutMethod={data.payoutMethod}
          onChanged={reload}
          initialEditing={edit === "payout"}
        />
      </section>
    </div>
  );
}
