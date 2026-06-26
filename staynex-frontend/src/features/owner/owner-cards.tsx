"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Button, Field, Input, Select } from "@/ui";
import { EditableCard } from "@/features/settings/editable-card";
import { SettingsCard, SettingsRow } from "@/features/settings/settings-shell";
import { apiErrorMessage, areasApi, ownerApiSettings } from "@/lib/api";
import {
  type AreaOption,
  type CityOption,
  type OwnerLocationView,
  type OwnerPayoutMethodView,
  type OwnerProfileView,
  PAYOUT_METHOD_STATUS_LABELS,
} from "@/lib/types";

type Reload = () => Promise<void> | void;

interface LocationInput {
  cityId: string;
  areaId: string | null;
  label: string | null;
  addressLine: string | null;
  isPrimary: boolean;
}

// --- Business profile -------------------------------------------------------

export function OwnerProfileCard({
  profile,
  onChanged,
}: {
  profile: OwnerProfileView;
  onChanged: Reload;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [businessName, setBusinessName] = useState(profile.businessName ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");

  function reset() {
    setDisplayName(profile.displayName ?? "");
    setBusinessName(profile.businessName ?? "");
    setPhone(profile.phone ?? "");
  }

  async function save() {
    await ownerApiSettings.updateProfile({
      displayName: displayName.trim() || undefined,
      businessName: businessName.trim() || undefined,
      phone: phone.trim() || undefined,
    });
    await onChanged();
  }

  return (
    <EditableCard
      title="Business profile"
      description="How your business appears across Staynex."
      onEdit={reset}
      onCancel={reset}
      onSave={save}
      canSave={businessName.trim().length > 0 && phone.trim().length > 0}
      summary={
        <dl>
          <SettingsRow label="Display name">{profile.displayName || "—"}</SettingsRow>
          <SettingsRow label="Business name">
            {profile.businessName || <span className="text-warning">Not set</span>}
          </SettingsRow>
          <SettingsRow label="Contact phone">
            {profile.phone || <span className="text-warning">Not set</span>}
          </SettingsRow>
        </dl>
      }
      form={
        <>
          <Field label="Display name" htmlFor="displayName">
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={120}
            />
          </Field>
          <Field label="Business name" htmlFor="businessName" required>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              maxLength={160}
              required
            />
          </Field>
          <Field label="Contact phone" htmlFor="phone" required>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234…"
              autoComplete="tel"
              required
            />
          </Field>
        </>
      }
    />
  );
}

// --- Payout method ----------------------------------------------------------

export function OwnerPayoutCard({
  payoutMethod,
  onChanged,
}: {
  payoutMethod: OwnerPayoutMethodView | null;
  onChanged: Reload;
}) {
  const [bankName, setBankName] = useState(payoutMethod?.bankName ?? "");
  const [accountName, setAccountName] = useState(payoutMethod?.accountName ?? "");
  const [accountNumber, setAccountNumber] = useState("");
  const [provider, setProvider] = useState(payoutMethod?.provider ?? "");

  function reset() {
    setBankName(payoutMethod?.bankName ?? "");
    setAccountName(payoutMethod?.accountName ?? "");
    setAccountNumber("");
    setProvider(payoutMethod?.provider ?? "");
  }

  async function save() {
    await ownerApiSettings.savePayoutMethod({
      bankName: bankName.trim(),
      accountName: accountName.trim(),
      accountNumber: accountNumber.trim(),
      provider: provider.trim() || null,
    });
    await onChanged();
  }

  const validNumber = /^\d{6,20}$/.test(accountNumber.trim());

  return (
    <EditableCard
      title="Payout method"
      description="Where Staynex settles your earnings. We never store full card details."
      editLabel={payoutMethod ? "Update" : "Add payout method"}
      onEdit={reset}
      onCancel={reset}
      onSave={save}
      canSave={bankName.trim().length > 0 && accountName.trim().length > 0 && validNumber}
      summary={
        payoutMethod ? (
          <dl>
            <SettingsRow label="Bank">{payoutMethod.bankName}</SettingsRow>
            <SettingsRow label="Account name">{payoutMethod.accountName}</SettingsRow>
            <SettingsRow label="Account number">•••• {payoutMethod.accountNumberLast4}</SettingsRow>
            <SettingsRow label="Status">
              {PAYOUT_METHOD_STATUS_LABELS[payoutMethod.status]}
            </SettingsRow>
          </dl>
        ) : (
          <p className="text-body-sm text-muted-foreground">
            No payout method yet. Add one so Staynex can settle your earnings.
          </p>
        )
      }
      form={
        <>
          <Field label="Bank name" htmlFor="bankName" required>
            <Input
              id="bankName"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              maxLength={120}
              required
            />
          </Field>
          <Field label="Account name" htmlFor="accountName" required>
            <Input
              id="accountName"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              maxLength={120}
              required
            />
          </Field>
          <Field
            label="Account number"
            htmlFor="accountNumber"
            required
            hint={payoutMethod ? "Re-enter to update. 6–20 digits." : "6–20 digits."}
          >
            <Input
              id="accountNumber"
              inputMode="numeric"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
              maxLength={20}
              required
            />
          </Field>
          <Field label="Provider" htmlFor="provider" hint="Optional, e.g. Paystack">
            <Input
              id="provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              maxLength={80}
            />
          </Field>
        </>
      }
    />
  );
}

// --- Locations --------------------------------------------------------------

export function OwnerLocationsManager({
  locations,
  cities,
  onChanged,
}: {
  locations: OwnerLocationView[];
  cities: CityOption[];
  onChanged: Reload;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function add(input: LocationInput) {
    await ownerApiSettings.createLocation(input);
    setAdding(false);
    await onChanged();
  }

  async function update(id: string, input: LocationInput) {
    await ownerApiSettings.updateLocation(id, input);
    setEditingId(null);
    await onChanged();
  }

  return (
    <SettingsCard
      title="Operating locations"
      description="Cities and areas where you host. Your first location is your primary."
      action={
        !adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            Add location
          </Button>
        )
      }
    >
      <div className="space-y-3">
        {locations.length === 0 && !adding && (
          <p className="text-body-sm text-muted-foreground">
            No locations yet. Add at least one to host on Staynex.
          </p>
        )}

        {locations.map((loc) =>
          editingId === loc.id ? (
            <LocationForm
              key={loc.id}
              cities={cities}
              initial={loc}
              submitLabel="Save location"
              onSubmit={(input) => update(loc.id, input)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <LocationRow
              key={loc.id}
              location={loc}
              others={locations.filter((l) => l.id !== loc.id)}
              deleting={deletingId === loc.id}
              onEdit={() => setEditingId(loc.id)}
              onDeleteStart={() => setDeletingId(loc.id)}
              onDeleteCancel={() => setDeletingId(null)}
              onDeleted={async () => {
                setDeletingId(null);
                await onChanged();
              }}
            />
          ),
        )}

        {adding && (
          <LocationForm
            cities={cities}
            submitLabel="Add location"
            onSubmit={add}
            onCancel={() => setAdding(false)}
          />
        )}
      </div>
    </SettingsCard>
  );
}

function LocationRow({
  location,
  others,
  deleting,
  onEdit,
  onDeleteStart,
  onDeleteCancel,
  onDeleted,
}: {
  location: OwnerLocationView;
  others: OwnerLocationView[];
  deleting: boolean;
  onEdit: () => void;
  onDeleteStart: () => void;
  onDeleteCancel: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [replacementId, setReplacementId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsReplacement = location.propertyCount > 0;

  async function confirmDelete() {
    if (needsReplacement && !replacementId) {
      setError("Choose a location to move the listings to.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ownerApiSettings.deleteLocation(location.id, replacementId || undefined);
      await onDeleted();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't delete this location."));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
            {location.label || location.cityName}
            {location.isPrimary && (
              <span className="rounded-full bg-primary-subtle px-2 py-0.5 text-2xs font-semibold text-primary">
                Primary
              </span>
            )}
          </p>
          <p className="text-body-sm text-muted-foreground">
            {[location.areaName, location.cityName].filter(Boolean).join(", ")}
            {location.addressLine ? ` · ${location.addressLine}` : ""}
          </p>
          {location.propertyCount > 0 && (
            <p className="mt-0.5 text-caption">
              {location.propertyCount} listing{location.propertyCount === 1 ? "" : "s"}
            </p>
          )}
        </div>
        {!deleting && (
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={onDeleteStart} className="text-error">
              Delete
            </Button>
          </div>
        )}
      </div>

      {deleting && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {needsReplacement ? (
            <Field
              label={`Move ${location.propertyCount} listing${location.propertyCount === 1 ? "" : "s"} to`}
              htmlFor={`replace-${location.id}`}
              required
            >
              <Select
                id={`replace-${location.id}`}
                value={replacementId}
                onChange={(e) => setReplacementId(e.target.value)}
              >
                <option value="">Select a location…</option>
                {others.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label || o.cityName} · {o.cityName}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <p className="text-body-sm text-muted-foreground">
              Delete this location? This can't be undone.
            </p>
          )}
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={confirmDelete} disabled={busy}>
              {busy ? "Deleting…" : "Delete location"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDeleteCancel} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LocationForm({
  cities,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  cities: CityOption[];
  initial?: OwnerLocationView;
  submitLabel: string;
  onSubmit: (input: LocationInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [cityId, setCityId] = useState(initial?.cityId ?? cities[0]?.id ?? "");
  const [areaId, setAreaId] = useState(initial?.areaId ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [addressLine, setAddressLine] = useState(initial?.addressLine ?? "");
  const [isPrimary, setIsPrimary] = useState(initial?.isPrimary ?? false);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cityName = cities.find((c) => c.id === cityId)?.name ?? "";

  useEffect(() => {
    let active = true;
    if (!cityName) {
      setAreas([]);
      return;
    }
    areasApi
      .listForCity(cityName)
      .then((list) => active && setAreas(list))
      .catch(() => active && setAreas([]));
    return () => {
      active = false;
    };
  }, [cityName]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        cityId,
        areaId: areaId || null,
        label: label.trim() || null,
        addressLine: addressLine.trim() || null,
        isPrimary,
      });
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save this location."));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-border bg-secondary p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="City" htmlFor="loc-city" required>
          <Select
            id="loc-city"
            value={cityId}
            onChange={(e) => {
              setCityId(e.target.value);
              setAreaId("");
            }}
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Area" htmlFor="loc-area" hint={areas.length === 0 ? "No areas listed" : "Optional"}>
          <Select
            id="loc-area"
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            disabled={areas.length === 0}
          >
            <option value="">No specific area</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Label" htmlFor="loc-label" hint="Optional, e.g. Marina branch">
        <Input id="loc-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
      </Field>
      <Field label="Address" htmlFor="loc-address" hint="Optional">
        <Input
          id="loc-address"
          value={addressLine}
          onChange={(e) => setAddressLine(e.target.value)}
          maxLength={200}
        />
      </Field>
      <label className="flex items-center gap-2 text-body-sm text-ink">
        <input
          type="checkbox"
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
          className="size-4 rounded border-input text-primary focus-visible:ring-primary"
        />
        Set as primary location
      </label>
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy || !cityId}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
