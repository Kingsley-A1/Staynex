import Link from "next/link";
import { AdminUserDetailView } from "@/features/admin/users-ui";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm font-medium text-primary">
          ← Back to users
        </Link>
      </div>
      <AdminUserDetailView id={id} />
    </div>
  );
}
