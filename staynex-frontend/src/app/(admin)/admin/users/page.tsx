import { AdminUsersList } from "@/features/admin/users-ui";

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-title-lg text-ink">Users</h1>
        <p className="text-muted-foreground">
          Registered guests, owners, and admins. Open a user to see their profile and records.
        </p>
      </header>
      <AdminUsersList />
    </div>
  );
}
