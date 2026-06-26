import { redirect } from "next/navigation";

// Owner profile moved into Owner settings. Keep the old route working.
export default function OwnerProfileRedirect() {
  redirect("/owner/settings");
}
