"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/ui";
import { ownerApi } from "@/lib/api";
import { formatNairaFromKobo } from "@/lib/format";
import type { RoomTypeDetail } from "@/lib/types";

export function RoomManager({
  propertyId,
  roomTypes,
}: {
  propertyId: string;
  roomTypes: RoomTypeDetail[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [priceNaira, setPriceNaira] = useState("");
  const [maxGuests, setMaxGuests] = useState("2");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addRoomType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await ownerApi.createRoomType({
        propertyId,
        name,
        basePriceKobo: Number(priceNaira) * 100,
        maxGuests: Number(maxGuests),
      });
      setName("");
      setPriceNaira("");
      setMaxGuests("2");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add room type");
    } finally {
      setPending(false);
    }
  }

  async function addUnit(roomTypeId: string) {
    setError(null);
    try {
      await ownerApi.addRoomUnit({ roomTypeId });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add unit");
    }
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {roomTypes.length === 0 && (
          <li className="text-caption">No room types yet. Add your first below.</li>
        )}
        {roomTypes.map((rt) => (
          <li
            key={rt.id}
            className="surface-card flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div>
              <p className="font-semibold text-ink">{rt.name}</p>
              <p className="text-caption">
                {formatNairaFromKobo(rt.basePriceKobo)} / night · up to {rt.maxGuests} guests ·{" "}
                {rt.unitCount} unit{rt.unitCount === 1 ? "" : "s"}
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => addUnit(rt.id)}>
              Add unit
            </Button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={addRoomType}
        className="surface-card grid gap-3 p-4 sm:grid-cols-[1.5fr_1fr_0.8fr_auto] sm:items-end"
      >
        <Field label="Room type" htmlFor="rt-name" required>
          <Input
            id="rt-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Deluxe Room"
            required
            minLength={2}
          />
        </Field>
        <Field label="Price / night (₦)" htmlFor="rt-price" required>
          <Input
            id="rt-price"
            type="number"
            min={0}
            value={priceNaira}
            onChange={(e) => setPriceNaira(e.target.value)}
            required
          />
        </Field>
        <Field label="Max guests" htmlFor="rt-guests" required>
          <Input
            id="rt-guests"
            type="number"
            min={1}
            max={20}
            value={maxGuests}
            onChange={(e) => setMaxGuests(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add room type"}
        </Button>
      </form>

      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
