import type { Metadata } from "next";
import { NotificationsView } from "@/features/notifications/notifications-view";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Your booking updates, reminders, and alerts on Staynex Bookings.",
  robots: { index: false },
};

export default function NotificationsPage() {
  return (
    <main className="layout-container py-10 sm:py-12">
      <NotificationsView />
    </main>
  );
}
