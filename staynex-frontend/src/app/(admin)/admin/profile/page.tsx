import { ProfileView } from "@/features/profile/profile-view";

export default function AdminProfilePage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-title-lg text-ink">Profile</h1>
        <p className="text-muted-foreground">Your admin account details.</p>
      </header>
      <ProfileView />
    </div>
  );
}
