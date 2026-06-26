import type { Metadata } from "next";
import { ProfileView } from "@/features/profile/profile-view";
import { SettingsShell } from "@/features/settings/settings-shell";

export const metadata: Metadata = { title: "Account settings — Staynex" };

export default function SettingsPage() {
  return (
    <main className="layout-container py-10">
      <SettingsShell title="Account settings" description="Manage your account details and sign-in.">
        <ProfileView />
      </SettingsShell>
    </main>
  );
}
