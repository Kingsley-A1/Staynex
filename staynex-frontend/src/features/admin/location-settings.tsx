"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Button, Field, Input, Select } from "@/ui";
import { SettingsCard } from "@/features/settings/settings-shell";
import { adminApi, apiErrorMessage, authApi } from "@/lib/api";
import {
  AREA_TYPE_LABELS,
  type AdminCityRow,
  type AdminLocationReferenceView,
  type AreaOption,
  type AreaTypeValue,
} from "@/lib/types";

const EMPTY_REFERENCES: AdminLocationReferenceView = {
  countries: [],
  regions: [],
};

export function AdminLocationSettings() {
  const [cities, setCities] = useState<AdminCityRow[]>([]);
  const [references, setReferences] = useState(EMPTY_REFERENCES);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [selectedCityId, setSelectedCityId] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingCity, setAddingCity] = useState(false);
  const [editingCityId, setEditingCityId] = useState<string | null>(null);
  const [deletingCityId, setDeletingCityId] = useState<string | null>(null);
  const [addingArea, setAddingArea] = useState(false);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [deletingAreaId, setDeletingAreaId] = useState<string | null>(null);

  async function loadCities(preferredCityId?: string) {
    const [nextCities, nextReferences] = await Promise.all([
      adminApi.cities(),
      adminApi.locationReferences(),
    ]);
    setCities(nextCities);
    setReferences(nextReferences);
    setSelectedCityId((current) => {
      const candidate = preferredCityId || current;
      return nextCities.some((city) => city.id === candidate)
        ? candidate
        : (nextCities[0]?.id ?? "");
    });
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      adminApi.cities(),
      adminApi.locationReferences(),
      authApi.me(),
    ])
      .then(([nextCities, nextReferences, user]) => {
        if (!active) return;
        setCities(nextCities);
        setReferences(nextReferences);
        setSelectedCityId(nextCities[0]?.id ?? "");
        setCanManage(Boolean(user?.capabilities.includes("ADMIN_MANAGER")));
      })
      .catch(
        (err) =>
          active &&
          setError(apiErrorMessage(err, "Couldn't load platform locations.")),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setAddingArea(false);
    setEditingAreaId(null);
    setDeletingAreaId(null);
    if (!selectedCityId) {
      setAreas([]);
      return;
    }
    adminApi
      .areas(selectedCityId)
      .then((next) => active && setAreas(next))
      .catch(
        (err) =>
          active && setError(apiErrorMessage(err, "Couldn't load city areas.")),
      );
    return () => {
      active = false;
    };
  }, [selectedCityId]);

  async function reloadAreas() {
    if (selectedCityId) setAreas(await adminApi.areas(selectedCityId));
  }

  if (loading) {
    return (
      <div className="surface-card p-6 text-body-sm text-muted-foreground">
        Loading location settings…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p
          className="rounded-lg border border-error/20 bg-error/5 p-3 text-sm text-error"
          role="alert"
        >
          {error}
        </p>
      )}
      {!canManage && (
        <p className="rounded-lg border border-warning-border bg-warning-surface p-3 text-sm text-warning">
          Location settings are read-only for reviewers. A manager can add,
          edit, or remove records.
        </p>
      )}

      <SettingsCard
        title="Cities"
        description="Cities available to host onboarding, property creation, and guest search."
        action={
          canManage && !addingCity ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAddingCity(true)}
            >
              Add city
            </Button>
          ) : null
        }
      >
        <div className="space-y-3">
          {addingCity && (
            <CityForm
              references={references}
              submitLabel="Create city"
              onCancel={() => setAddingCity(false)}
              onSubmit={async (input) => {
                const created = await adminApi.createCity(input);
                setAddingCity(false);
                await loadCities(created.id);
              }}
            />
          )}
          {cities.length === 0 && !addingCity && (
            <p className="text-body-sm text-muted-foreground">
              No cities are configured yet.
            </p>
          )}
          <ul className="space-y-2">
            {cities.map((city) => (
              <li key={city.id} className="rounded-lg border border-border p-4">
                {editingCityId === city.id ? (
                  <CityForm
                    references={references}
                    initial={city}
                    submitLabel="Save city"
                    onCancel={() => setEditingCityId(null)}
                    onSubmit={async (input) => {
                      await adminApi.updateCity(city.id, input);
                      setEditingCityId(null);
                      await loadCities(city.id);
                    }}
                  />
                ) : (
                  <>
                    <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{city.name}</p>
                        <p className="text-body-sm text-muted-foreground">
                          {[city.regionName, city.countryName]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                        <p className="mt-1 text-caption">
                          {city.areaCount} areas · {city.propertyCount} listings
                          · {city.ownerLocationCount} host locations
                        </p>
                      </div>
                      {canManage && deletingCityId !== city.id && (
                        <div className="flex flex-wrap gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingCityId(city.id)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-error"
                            onClick={() => setDeletingCityId(city.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                    {deletingCityId === city.id && (
                      <ConfirmDelete
                        label="Delete this city? It must have no areas, listings, or host locations."
                        onCancel={() => setDeletingCityId(null)}
                        onConfirm={async () => {
                          await adminApi.deleteCity(city.id);
                          setDeletingCityId(null);
                          await loadCities();
                        }}
                      />
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Areas and locations"
        description="Manage LGAs and neighbourhoods within each city."
        action={
          canManage && selectedCityId && !addingArea ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAddingArea(true)}
            >
              Add area
            </Button>
          ) : null
        }
      >
        <div className="space-y-4">
          <Field label="City" htmlFor="admin-area-city">
            <Select
              id="admin-area-city"
              value={selectedCityId}
              onChange={(event) => setSelectedCityId(event.target.value)}
            >
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </Select>
          </Field>
          {addingArea && (
            <AreaForm
              submitLabel="Create area"
              onCancel={() => setAddingArea(false)}
              onSubmit={async (input) => {
                await adminApi.createArea({ cityId: selectedCityId, ...input });
                setAddingArea(false);
                await reloadAreas();
                await loadCities(selectedCityId);
              }}
            />
          )}
          <ul className="space-y-2">
            {areas.map((area) => (
              <li key={area.id} className="rounded-lg border border-border p-4">
                {editingAreaId === area.id ? (
                  <AreaForm
                    initial={area}
                    submitLabel="Save area"
                    onCancel={() => setEditingAreaId(null)}
                    onSubmit={async (input) => {
                      await adminApi.updateArea(area.id, input);
                      setEditingAreaId(null);
                      await reloadAreas();
                    }}
                  />
                ) : (
                  <>
                    <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                      <div>
                        <p className="font-medium text-ink">{area.name}</p>
                        <p className="text-caption">
                          {AREA_TYPE_LABELS[area.type]}
                          {area.notable ? " · Featured" : ""}
                          {area.hasProperties ? " · Has live listings" : ""}
                        </p>
                      </div>
                      {canManage && deletingAreaId !== area.id && (
                        <div className="flex flex-wrap gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingAreaId(area.id)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-error"
                            onClick={() => setDeletingAreaId(area.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                    {deletingAreaId === area.id && (
                      <ConfirmDelete
                        label="Delete this area? It must not be used by a listing or host location."
                        onCancel={() => setDeletingAreaId(null)}
                        onConfirm={async () => {
                          await adminApi.deleteArea(area.id);
                          setDeletingAreaId(null);
                          await reloadAreas();
                          await loadCities(selectedCityId);
                        }}
                      />
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          {selectedCityId && areas.length === 0 && !addingArea && (
            <p className="text-body-sm text-muted-foreground">
              No areas are configured for this city.
            </p>
          )}
        </div>
      </SettingsCard>
    </div>
  );
}

interface CityInput {
  countryId: string;
  regionId: string | null;
  name: string;
}

function CityForm({
  references,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  references: AdminLocationReferenceView;
  initial?: AdminCityRow;
  submitLabel: string;
  onSubmit: (input: CityInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [countryId, setCountryId] = useState(
    initial?.countryId ?? references.countries[0]?.id ?? "",
  );
  const [regionId, setRegionId] = useState(initial?.regionId ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const regions = references.regions.filter(
    (region) => region.countryId === countryId,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        countryId,
        regionId: regionId || null,
        name: name.trim(),
      });
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save this city."));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg bg-secondary p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Country"
          htmlFor={`city-country-${initial?.id ?? "new"}`}
          required
        >
          <Select
            id={`city-country-${initial?.id ?? "new"}`}
            value={countryId}
            onChange={(event) => {
              setCountryId(event.target.value);
              setRegionId("");
            }}
            required
          >
            {references.countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Region or state"
          htmlFor={`city-region-${initial?.id ?? "new"}`}
          hint="Optional"
        >
          <Select
            id={`city-region-${initial?.id ?? "new"}`}
            value={regionId}
            onChange={(event) => setRegionId(event.target.value)}
          >
            <option value="">No region selected</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field
        label="City name"
        htmlFor={`city-name-${initial?.id ?? "new"}`}
        required
      >
        <Input
          id={`city-name-${initial?.id ?? "new"}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={120}
          required
        />
      </Field>
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <FormActions busy={busy} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}

interface AreaInput {
  name: string;
  type: AreaTypeValue;
  notable: boolean;
}

function AreaForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: AreaOption;
  submitLabel: string;
  onSubmit: (input: AreaInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<AreaTypeValue>(
    initial?.type ?? "NEIGHBORHOOD",
  );
  const [notable, setNotable] = useState(initial?.notable ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), type, notable });
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save this area."));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg bg-secondary p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Area name"
          htmlFor={`area-name-${initial?.id ?? "new"}`}
          required
        >
          <Input
            id={`area-name-${initial?.id ?? "new"}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            required
          />
        </Field>
        <Field
          label="Area type"
          htmlFor={`area-type-${initial?.id ?? "new"}`}
          required
        >
          <Select
            id={`area-type-${initial?.id ?? "new"}`}
            value={type}
            onChange={(event) => setType(event.target.value as AreaTypeValue)}
          >
            <option value="NEIGHBORHOOD">Neighborhood</option>
            <option value="LOCAL_GOVERNMENT_AREA">Local government area</option>
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-body-sm text-ink">
        <input
          type="checkbox"
          checked={notable}
          onChange={(event) => setNotable(event.target.checked)}
          className="size-4 rounded border-input text-primary focus-visible:ring-primary"
        />
        Feature this area in discovery
      </label>
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <FormActions busy={busy} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}

function FormActions({
  busy,
  submitLabel,
  onCancel,
}: {
  busy: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onCancel}
        disabled={busy}
      >
        Cancel
      </Button>
    </div>
  );
}

function ConfirmDelete({
  label,
  onConfirm,
  onCancel,
}: {
  label: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(apiErrorMessage(err, "This record couldn't be deleted."));
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <p className="text-body-sm text-muted-foreground">{label}</p>
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          size="sm"
          onClick={() => void confirm()}
          disabled={busy}
        >
          {busy ? "Deleting…" : "Confirm delete"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
