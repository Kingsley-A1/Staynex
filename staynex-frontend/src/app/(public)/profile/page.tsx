import type { Metadata } from "next";
import { ProfileView } from "@/features/profile/profile-view";

export const metadata: Metadata = { title: "Your profile — Staynex" };

export default function ProfilePage() {
  return (
    <main className="layout-container py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <header>
          <h1 className="text-title-lg text-ink">Your profile</h1>
          <p className="text-muted-foreground">Manage your account details.</p>
        </header>
        <ProfileView />
      </div>
    </main>
  );
}
