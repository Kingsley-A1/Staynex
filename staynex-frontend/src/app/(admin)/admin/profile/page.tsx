import { redirect } from "next/navigation";

// Admin profile moved into Admin settings. Keep the old route working.
export default function AdminProfileRedirect() {
  redirect("/admin/settings");
}
