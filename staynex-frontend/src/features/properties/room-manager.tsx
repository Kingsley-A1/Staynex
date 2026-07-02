"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CurrencyInput, Field, Input } from "@/ui";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  // Clear the "Saved" flash a couple seconds after it appears.
  useEffect(() => {
    if (!justSavedId) return;
    const timer = window.setTimeout(() => setJustSavedId(null), 2500);
    return () => window.clearTimeout(timer);
  }, [justSavedId]);

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
        {roomTypes.map((rt) =>
          editingId === rt.id ? (
            <RoomTypeEditCard
              key={rt.id}
              roomType={rt}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null);
                setJustSavedId(rt.id);
                router.refresh();
              }}
            />
          ) : (
            <li
              key={rt.id}
              className="surface-card flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink">{rt.name}</p>
                  {justSavedId === rt.id && (
                    <span className="text-caption font-medium text-success" role="status">
                      Saved
                    </span>
                  )}
                </div>
                <p className="text-caption">
                  {formatNairaFromKobo(rt.basePriceKobo)} / night · up to {rt.maxGuests} guests ·{" "}
                  {rt.unitCount} unit{rt.unitCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingId(rt.id)}
                >
                  Edit
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => addUnit(rt.id)}>
                  Add unit
                </Button>
              </div>
            </li>
          ),
        )}
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
          <CurrencyInput
            id="rt-price"
            value={priceNaira}
            onValueChange={setPriceNaira}
            placeholder="48,000"
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

function RoomTypeEditCard({
  roomType,
  onCancel,
  onSaved,
}: {
  roomType: RoomTypeDetail;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(roomType.name);
  const [priceNaira, setPriceNaira] = useState(String(Math.round(roomType.basePriceKobo / 100)));
  const [maxGuests, setMaxGuests] = useState(String(roomType.maxGuests));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await ownerApi.updateRoomType(roomType.id, {
        name,
        basePriceKobo: Number(priceNaira) * 100,
        maxGuests: Number(maxGuests),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
      setPending(false);
    }
  }

  return (
    <li className="surface-card p-4">
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1.5fr_1fr_0.8fr] sm:items-end">
        <Field label="Room type" htmlFor={`edit-name-${roomType.id}`} required>
          <Input
            id={`edit-name-${roomType.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />
        </Field>
        <Field label="Price / night (₦)" htmlFor={`edit-price-${roomType.id}`} required>
          <CurrencyInput
            id={`edit-price-${roomType.id}`}
            value={priceNaira}
            onValueChange={setPriceNaira}
            required
          />
        </Field>
        <Field label="Max guests" htmlFor={`edit-guests-${roomType.id}`} required>
          <Input
            id={`edit-guests-${roomType.id}`}
            type="number"
            min={1}
            max={20}
            value={maxGuests}
            onChange={(e) => setMaxGuests(e.target.value)}
            required
          />
        </Field>
        <div className="flex gap-2 sm:col-span-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        </div>
        {error && (
          <p className="text-sm text-error sm:col-span-3" role="alert">
            {error}
          </p>
        )}
      </form>
    </li>
  );
}
