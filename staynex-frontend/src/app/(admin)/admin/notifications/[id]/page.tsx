import { NotificationDetailView } from "@/features/notifications/notification-detail-view";

export default async function AdminNotificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <NotificationDetailView
      notificationId={id}
      inboxHref="/admin/notifications"
    />
  );
}
