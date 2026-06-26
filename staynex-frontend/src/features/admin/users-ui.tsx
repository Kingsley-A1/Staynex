"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/ui";
import { SettingsCard, SettingsRow } from "@/features/settings/settings-shell";
import { adminUsersApi, apiErrorMessage } from "@/lib/api";
import {
  type AdminUserDetail,
  type AdminUserRow,
  type AppCapability,
  PAYOUT_METHOD_STATUS_LABELS,
  type RevealedPayoutMethod,
} from "@/lib/types";

const naira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;

const CAPABILITY_STYLE: Record<AppCapability, string> = {
  GUEST: "bg-secondary text-muted-foreground",
  OWNER: "bg-primary-subtle text-primary",
  ADMIN_REVIEWER: "bg-warning-surface text-warning",
  ADMIN_MANAGER: "bg-success-surface text-success",
};

const CAPABILITY_LABEL: Record<AppCapability, string> = {
  GUEST: "Guest",
  OWNER: "Owner",
  ADMIN_REVIEWER: "Admin",
  ADMIN_MANAGER: "Super Admin",
};

function CapabilityBadges({ capabilities }: { capabilities: AppCapability[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {capabilities.map((c) => (
        <span
          key={c}
          className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${CAPABILITY_STYLE[c]}`}
        >
          {CAPABILITY_LABEL[c]}
        </span>
      ))}
    </span>
  );
}

// --- List -------------------------------------------------------------------

export function AdminUsersList() {
  const [rows, setRows] = useState<AdminUserRow[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminUsersApi
      .list()
      .then((r) => active && setRows(r))
      .catch(() => active && setError("Couldn't load users. You may not have access."));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <p className="surface-card p-6 text-error" role="alert">
        {error}
      </p>
    );
  }
  if (rows === undefined) {
    return <p className="surface-card p-6 text-muted-foreground">Loading users…</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((u) => (
        <Link
          key={u.id}
          href={`/admin/users/${u.id}`}
          className="surface-card flex items-center justify-between gap-4 p-4 transition-shadow hover:shadow-md"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{u.name || "Unnamed user"}</p>
            <p className="truncate text-body-sm text-muted-foreground">{u.email || "No email"}</p>
            <div className="mt-1.5">
              <CapabilityBadges capabilities={u.capabilities} />
            </div>
          </div>
          <div className="shrink-0 text-right text-caption text-muted-foreground">
            <p>
              {u.propertyCount} {u.propertyCount === 1 ? "property" : "properties"}
            </p>
            <p>
              {u.bookingCount} {u.bookingCount === 1 ? "booking" : "bookings"}
            </p>
          </div>
        </Link>
      ))}
      {rows.length === 0 && (
        <p className="surface-card p-6 text-muted-foreground">No users yet.</p>
      )}
    </div>
  );
}

// --- Detail -----------------------------------------------------------------

export function AdminUserDetailView({ id }: { id: string }) {
  const [user, setUser] = useState<AdminUserDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminUsersApi
      .get(id)
      .then((u) => active && setUser(u))
      .catch(() => active && setError("Couldn't load this user."));
    return () => {
      active = false;
    };
  }, [id]);

  if (error) {
    return (
      <p className="surface-card p-6 text-error" role="alert">
        {error}
      </p>
    );
  }
  if (user === undefined) {
    return <p className="surface-card p-6 text-muted-foreground">Loading user…</p>;
  }
  if (user === null) return null;

  return (
    <div className="space-y-4">
      <SettingsCard title={user.name || "Unnamed user"} description={user.email || "No email"}>
        <dl>
          <SettingsRow label="Phone">{user.phone || "—"}</SettingsRow>
          <SettingsRow label="Capabilities">
            <CapabilityBadges capabilities={user.capabilities} />
          </SettingsRow>
          <SettingsRow label="Joined">
            {new Date(user.createdAt).toLocaleDateString("en-NG", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </SettingsRow>
          <SettingsRow label="Properties">{user.counts.properties}</SettingsRow>
          <SettingsRow label="Bookings">{user.counts.bookings}</SettingsRow>
        </dl>
      </SettingsCard>

      {user.ownerProfile && (
        <SettingsCard title="Owner profile">
          <dl>
            <SettingsRow label="Business name">{user.ownerProfile.businessName || "—"}</SettingsRow>
            <SettingsRow label="Contact phone">{user.ownerProfile.phone || "—"}</SettingsRow>
            <SettingsRow label="Onboarding">
              {user.ownerProfile.onboardingCompletedAt ? "Complete" : "Incomplete"}
            </SettingsRow>
            <SettingsRow label="Payout earned">{naira(user.payoutSummary.paidKobo)}</SettingsRow>
            <SettingsRow label="Payout pending">{naira(user.payoutSummary.pendingKobo)}</SettingsRow>
          </dl>
        </SettingsCard>
      )}

      {user.ownerLocations.length > 0 && (
        <SettingsCard title="Operating locations">
          <ul className="space-y-2">
            {user.ownerLocations.map((loc) => (
              <li key={loc.id} className="rounded-lg border border-border p-3">
                <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                  {loc.label || loc.cityName}
                  {loc.isPrimary && (
                    <span className="rounded-full bg-primary-subtle px-2 py-0.5 text-2xs font-semibold text-primary">
                      Primary
                    </span>
                  )}
                </p>
                <p className="text-body-sm text-muted-foreground">
                  {[loc.areaName, loc.cityName].filter(Boolean).join(", ")}
                  {loc.addressLine ? ` · ${loc.addressLine}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </SettingsCard>
      )}

      <PayoutMethodSection user={user} />
    </div>
  );
}

function PayoutMethodSection({ user }: { user: AdminUserDetail }) {
  const [revealed, setRevealed] = useState<RevealedPayoutMethod | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

  async function reveal() {
    setRevealing(true);
    setRevealError(null);
    try {
      setRevealed(await adminUsersApi.revealPayout(user.id));
    } catch (err) {
      setRevealError(apiErrorMessage(err, "Couldn't reveal the account number."));
    } finally {
      setRevealing(false);
    }
  }

  // Reviewers never receive payout details from the API.
  if (user.payoutRestricted) {
    return (
      <SettingsCard title="Payout method">
        <p className="text-body-sm text-muted-foreground">
          Payout details are restricted to Super Admins.
        </p>
      </SettingsCard>
    );
  }

  if (!user.payoutMethod) {
    return (
      <SettingsCard title="Payout method">
        <p className="text-body-sm text-muted-foreground">No payout method on file.</p>
      </SettingsCard>
    );
  }

  const method = user.payoutMethod;
  return (
    <SettingsCard
      title="Payout method"
      description="Super Admin view. Revealing the full number is audited."
    >
      <dl>
        <SettingsRow label="Bank">{method.bankName}</SettingsRow>
        <SettingsRow label="Account name">{method.accountName}</SettingsRow>
        <SettingsRow label="Account number">
          {revealed ? revealed.accountNumber : `•••• ${method.accountNumberLast4}`}
        </SettingsRow>
        <SettingsRow label="Status">{PAYOUT_METHOD_STATUS_LABELS[method.status]}</SettingsRow>
      </dl>
      <div className="mt-4">
        {method.hasEncryptedNumber ? (
          !revealed && (
            <Button variant="secondary" size="sm" onClick={reveal} disabled={revealing}>
              {revealing ? "Revealing…" : "Reveal full number"}
            </Button>
          )
        ) : (
          <p className="text-caption">
            Full number isn't stored (payout encryption isn't configured).
          </p>
        )}
        {revealError && (
          <p className="mt-2 text-sm text-error" role="alert">
            {revealError}
          </p>
        )}
      </div>
    </SettingsCard>
  );
}
