import { HostSettings } from "@/features/host/host-settings";
import { SettingsShell } from "@/features/settings/settings-shell";

export default function OwnerSettingsPage() {
  return (
    <SettingsShell
      title="Host settings"
      description="Manage your business profile, operating locations, and payout method."
    >
      <HostSettings />
    </SettingsShell>
  );
}
