import { ProfileView } from "@/features/profile/profile-view";
import { SettingsShell } from "@/features/settings/settings-shell";

export default function AdminSettingsPage() {
  return (
    <SettingsShell title="Admin settings" description="Your admin account and sign-in.">
      <ProfileView />
    </SettingsShell>
  );
}
