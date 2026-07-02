"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/ui";
import { ownerApi } from "@/lib/api";
import type { PropertyDetail } from "@/lib/types";
import type { CityOption } from "@/features/properties/fixtures";

export function PropertyForm({
  cities,
  property,
}: {
  cities: CityOption[];
  property?: PropertyDetail;
}) {
  const router = useRouter();
  const editing = Boolean(property);
  const initialCityId = property
    ? (cities.find((c) => c.name === property.cityName)?.id ?? cities[0]?.id ?? "")
    : (cities[0]?.id ?? "");

  const [mode, setMode] = useState<"view" | "edit">(editing ? "view" : "edit");
  const [name, setName] = useState(property?.name ?? "");
  const [cityId, setCityId] = useState(initialCityId);
  const [description, setDescription] = useState(property?.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  function startEdit() {
    setJustSaved(false);
    setMode("edit");
  }

  function cancelEdit() {
    if (!property) return;
    setName(property.name);
    setCityId(initialCityId);
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
        await ownerApi.updateProperty(property.id, { name, cityId, description });
        setMode("view");
        setJustSaved(true);
        router.refresh();
      } else {
        const created = await ownerApi.createProperty({ name, cityId, description });
        router.push(`/owner/properties/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  if (editing && property && mode === "view") {
    const cityName = cities.find((c) => c.id === cityId)?.name ?? property.cityName;
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
            <dd className="text-ink">{property.name}</dd>
          </div>
          <div>
            <dt className="text-label text-muted-foreground">City</dt>
            <dd className="text-ink">{cityName}</dd>
          </div>
          <div>
            <dt className="text-label text-muted-foreground">Description</dt>
            <dd className="whitespace-pre-wrap text-ink">
              {property.description || <span className="text-muted-foreground">Not set</span>}
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
    <form onSubmit={onSubmit} className="surface-card max-w-2xl space-y-5 p-5 sm:p-6">
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
        <Select id="city" value={cityId} onChange={(e) => setCityId(e.target.value)} required>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
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
          <Button type="button" variant="ghost" onClick={cancelEdit} disabled={pending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
