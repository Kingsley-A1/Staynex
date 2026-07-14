import type { Metadata } from "next";
import { NotificationsView } from "@/features/notifications/notifications-view";

export const metadata: Metadata = {
  title: "Notifications",
};

export default function AdminNotificationsPage() {
  return <NotificationsView />;
}
