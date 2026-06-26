import { OwnerSettings } from "@/features/owner/owner-settings";
import { SettingsShell } from "@/features/settings/settings-shell";

export default function OwnerSettingsPage() {
  return (
    <SettingsShell
      title="Owner settings"
      description="Manage your business profile, operating locations, and payout method."
    >
      <OwnerSettings />
    </SettingsShell>
  );
}
