import { AdminLocationSettings } from "@/features/admin/location-settings";
import { ProfileView } from "@/features/profile/profile-view";
import { SettingsShell } from "@/features/settings/settings-shell";

export default function AdminSettingsPage() {
  return (
    <SettingsShell
      title="Admin settings"
      description="Manage your admin account and the location catalog used across Staynex."
    >
      <ProfileView />
      <AdminLocationSettings />
    </SettingsShell>
  );
}
