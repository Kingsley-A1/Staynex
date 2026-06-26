"use client";

import { useCallback, useEffect, useState } from "react";
import { LinkButton } from "@/ui";
import { catalogApi, ownerApiSettings } from "@/lib/api";
import type { CityOption, OwnerSettingsView } from "@/lib/types";
import { OwnerLocationsManager, OwnerPayoutCard, OwnerProfileCard } from "./owner-cards";

export function OwnerSettings() {
  const [data, setData] = useState<OwnerSettingsView | null | undefined>(undefined);
  const [cities, setCities] = useState<CityOption[]>([]);

  const reload = useCallback(async () => {
    setData(await ownerApiSettings.settings());
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([ownerApiSettings.settings(), catalogApi.cities()])
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
    return <p className="surface-card p-6 text-muted-foreground">Loading your settings…</p>;
  }
  if (data === null) {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <p className="text-muted-foreground">
          You need an owner account to manage these settings.
        </p>
        <LinkButton href="/owner/register?next=/owner/onboarding">Become a host</LinkButton>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OwnerProfileCard profile={data.profile} onChanged={reload} />
      <OwnerLocationsManager locations={data.locations} cities={cities} onChanged={reload} />
      <OwnerPayoutCard payoutMethod={data.payoutMethod} onChanged={reload} />
    </div>
  );
}
