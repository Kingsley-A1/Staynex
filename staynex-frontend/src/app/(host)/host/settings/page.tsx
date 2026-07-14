import { HostSettings } from "@/features/host/host-settings";
import { SettingsShell } from "@/features/settings/settings-shell";

export default async function OwnerSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const query = await searchParams;
  return (
    <SettingsShell
      title="Host settings"
      description="Manage your business profile, operating locations, and payout method."
    >
      <HostSettings edit={query.edit === "payout" ? "payout" : undefined} />
    </SettingsShell>
  );
}
