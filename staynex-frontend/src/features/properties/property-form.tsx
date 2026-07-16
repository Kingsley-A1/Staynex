"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/ui";
import { areasApi, hostApi } from "@/lib/api";
import type { PropertyDetail } from "@/lib/types";
import type { CityOption } from "@/features/properties/fixtures";

export function PropertyForm({
  cities,
  property,
  initialEditing = false,
}: {
  cities: CityOption[];
  property?: PropertyDetail;
  initialEditing?: boolean;
}) {
  const router = useRouter();
  const editing = Boolean(property);
  const initialCityId =
    property?.cityId ??
    cities.find((c) => c.name === property?.cityName)?.id ??
    cities[0]?.id ??
    "";

  const [mode, setMode] = useState<"view" | "edit">(
    editing && !initialEditing ? "view" : "edit",
  );
  const [name, setName] = useState(property?.name ?? "");
  const [cityId, setCityId] = useState(initialCityId);
  const [areaId, setAreaId] = useState(property?.areaId ?? "");
  const [areas, setAreas] = useState<Array<{ id: string; name: string }>>(
    property?.areaId && property.areaName
      ? [{ id: property.areaId, name: property.areaName }]
      : [],
  );
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [areaLoadError, setAreaLoadError] = useState(false);
  const [description, setDescription] = useState(property?.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    let active = true;
    if (!cityId) {
      setAreas([]);
      setLoadingAreas(false);
      return;
    }
    setLoadingAreas(true);
    setAreaLoadError(false);
    areasApi
      .listForCity(cityId)
      .then((list) => {
        if (!active) return;
        setAreas(
          list.map(({ id, name: areaName }) => ({ id, name: areaName })),
        );
      })
      .catch(() => {
        if (!active) return;
        setAreaLoadError(true);
        setAreas(
          property?.cityId === cityId && property.areaId && property.areaName
            ? [{ id: property.areaId, name: property.areaName }]
            : [],
        );
      })
      .finally(() => active && setLoadingAreas(false));
    return () => {
      active = false;
    };
  }, [cityId, property?.areaId, property?.areaName, property?.cityId]);

  function startEdit() {
    setJustSaved(false);
    setMode("edit");
  }

  function cancelEdit() {
    if (!property) return;
    setName(property.name);
    setCityId(initialCityId);
    setAreaId(property.areaId ?? "");
    setDescription(property.description ?? "");
    setError(null);
    setMode("view");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (editing && property) {
        await hostApi.updateProperty(property.id, {
          name,
          cityId,
          areaId: areaId || null,
          description,
        });
        setMode("view");
        setJustSaved(true);
        router.refresh();
      } else {
        const created = await hostApi.createProperty({
          name,
          cityId,
          areaId: areaId || null,
          description,
        });
        router.push(`/host/properties/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  if (editing && property && mode === "view") {
    const cityName =
      cities.find((c) => c.id === cityId)?.name ?? property.cityName;
    const areaName =
      areas.find((area) => area.id === areaId)?.name ?? property.areaName;
    return (
      <div className="surface-card max-w-2xl space-y-5 p-5 sm:p-6">
        {justSaved && (
          <p
            className="rounded-md border border-success-border bg-success-surface px-3 py-2 text-sm font-medium text-success"
            role="status"
          >
            Changes saved.
          </p>
        )}
        <dl className="space-y-4">
          <div>
            <dt className="text-label text-muted-foreground">Property name</dt>
            <dd className="text-ink">{name}</dd>
          </div>
          <div>
            <dt className="text-label text-muted-foreground">Area</dt>
            <dd className="text-ink">
              {areaName || (
                <span className="text-muted-foreground">Not specified</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-label text-muted-foreground">City</dt>
            <dd className="text-ink">{cityName}</dd>
          </div>
          <div>
            <dt className="text-label text-muted-foreground">Description</dt>
            <dd className="whitespace-pre-wrap text-ink">
              {description || (
                <span className="text-muted-foreground">Not set</span>
              )}
            </dd>
          </div>
        </dl>
        <Button type="button" variant="secondary" onClick={startEdit}>
          Edit details
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="surface-card max-w-2xl space-y-5 p-5 sm:p-6"
    >
      <Field label="Property name" htmlFor="name" required>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Marina Crest Hotel"
          required
          minLength={2}
        />
      </Field>
      <Field label="City" htmlFor="city" required>
        <Select
          id="city"
          value={cityId}
          onChange={(e) => {
            setCityId(e.target.value);
            setAreaId("");
          }}
          required
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Area"
        htmlFor="area"
        hint={
          loadingAreas
            ? "Loading areas..."
            : areas.length > 0
              ? "Choose the area guests will use to locate this property."
              : "No areas are configured for this city yet."
        }
      >
        <Select
          id="area"
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
          disabled={!cityId || loadingAreas || areas.length === 0}
        >
          <option value="">No specific area</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </Select>
      </Field>
      {areaLoadError && (
        <p className="text-sm text-warning" role="status">
          Areas could not be refreshed. You can save without one and add it
          later.
        </p>
      )}
      <Field
        label="Description"
        htmlFor="description"
        hint="What makes this property a trusted stay?"
      >
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
      </Field>
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Create draft"}
        </Button>
        {editing && (
          <Button
            type="button"
            variant="ghost"
            onClick={cancelEdit}
            disabled={pending}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
