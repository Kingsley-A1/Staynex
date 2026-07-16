import { NotificationDetailView } from "@/features/notifications/notification-detail-view";

export default async function NotificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="layout-container py-8">
      <NotificationDetailView notificationId={id} inboxHref="/notifications" />
    </main>
  );
}
