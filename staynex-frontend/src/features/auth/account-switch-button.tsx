"use client";

import { useState } from "react";
import { authApi } from "@/lib/api";
import { Button } from "@/ui";

export function AccountSwitchButton({
  destination,
  label = "Use another account",
}: {
  destination: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function switchAccount() {
    setBusy(true);
    await authApi.logout().catch(() => {});
    window.location.replace(destination);
  }

  return (
    <Button type="button" onClick={switchAccount} disabled={busy}>
      {busy ? "Signing out…" : label}
    </Button>
  );
}
