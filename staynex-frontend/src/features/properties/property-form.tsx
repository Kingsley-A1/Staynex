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

  const [name, setName] = useState(property?.name ?? "");
  const [cityId, setCityId] = useState(initialCityId);
  const [description, setDescription] = useState(property?.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (editing && property) {
        await ownerApi.updateProperty(property.id, { name, cityId, description });
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
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : editing ? "Save changes" : "Create draft"}
      </Button>
    </form>
  );
}
