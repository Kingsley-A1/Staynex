import { redirect } from "next/navigation";

// Host profile moved into Host settings. Keep the old route working.
export default function OwnerProfileRedirect() {
  redirect("/host/settings");
}
