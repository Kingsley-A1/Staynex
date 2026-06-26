import { redirect } from "next/navigation";

// Profile moved into Settings. Keep the old route working via a redirect.
export default function ProfileRedirect() {
  redirect("/settings");
}
