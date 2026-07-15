"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CurrencyInput, Field, Input } from "@/ui";
import { hostApi } from "@/lib/api";
import { formatNairaFromKobo } from "@/lib/format";
import { MediaManager } from "@/features/media/media-manager";
import type { RoomTypeDetail } from "@/lib/types";

const DEFAULT_ROOM_QUANTITY = 1;
const MAX_ROOM_QUANTITY = 500;

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
  const [roomQuantity, setRoomQuantity] = useState(
    String(DEFAULT_ROOM_QUANTITY),
  );
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);
  const [photosOpenId, setPhotosOpenId] = useState<string | null>(null);
  const [updatingUnitsId, setUpdatingUnitsId] = useState<string | null>(null);
  const [unitCounts, setUnitCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(roomTypes.map((room) => [room.id, room.unitCount])),
  );

  useEffect(() => {
    setUnitCounts(
      Object.fromEntries(roomTypes.map((room) => [room.id, room.unitCount])),
    );
  }, [roomTypes]);

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
      await hostApi.createRoomType({
        propertyId,
        name,
        basePriceKobo: Number(priceNaira) * 100,
        maxGuests: Number(maxGuests),
        unitCount: Number(roomQuantity) || DEFAULT_ROOM_QUANTITY,
      });
      setName("");
      setPriceNaira("");
      setMaxGuests("2");
      setRoomQuantity(String(DEFAULT_ROOM_QUANTITY));
      setAdding(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add room type");
    } finally {
      setPending(false);
    }
  }

  async function changeUnitCount(
    roomTypeId: string,
    direction: "increase" | "decrease",
  ) {
    setError(null);
    setUpdatingUnitsId(roomTypeId);
    try {
      if (direction === "increase") {
        await hostApi.addRoomUnit({ roomTypeId });
        setUnitCounts((current) => ({
          ...current,
          [roomTypeId]:
            (current[roomTypeId] ??
              roomTypes.find((room) => room.id === roomTypeId)?.unitCount ??
              0) + 1,
        }));
      } else {
        const result = await hostApi.removeRoomUnit(roomTypeId);
        setUnitCounts((current) => ({
          ...current,
          [roomTypeId]: result.unitCount,
        }));
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update room units",
      );
    } finally {
      setUpdatingUnitsId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption">
          {roomTypes.length} room type{roomTypes.length === 1 ? "" : "s"}
        </p>
        {!adding && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setAdding(true)}
          >
            Add room type
          </Button>
        )}
      </div>
      <ul className="space-y-3">
        {roomTypes.length === 0 && (
          <li className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-caption">
            No room types yet. Add your first room type to define pricing and
            capacity.
          </li>
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
            <li key={rt.id} className="surface-card space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ink">{rt.name}</p>
                    {justSavedId === rt.id && (
                      <span
                        className="text-caption font-medium text-success"
                        role="status"
                      >
                        Saved
                      </span>
                    )}
                  </div>
                  <p className="text-caption">
                    {formatNairaFromKobo(rt.basePriceKobo)} / night · up to{" "}
                    {rt.maxGuests} guests · {unitCounts[rt.id] ?? rt.unitCount}{" "}
                    unit
                    {(unitCounts[rt.id] ?? rt.unitCount) === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setPhotosOpenId((current) =>
                        current === rt.id ? null : rt.id,
                      )
                    }
                  >
                    {photosOpenId === rt.id
                      ? "Hide photos"
                      : `Photos (${rt.media.length})`}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(rt.id)}
                  >
                    Edit
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    Physical rooms
                  </p>
                  <p className="text-caption">
                    Set how many separate rooms of this type your property has.
                  </p>
                </div>
                <div
                  className="inline-flex min-h-11 w-fit items-center overflow-hidden rounded-md border border-input bg-surface-raised"
                  role="group"
                  aria-label={`${rt.name} physical room count`}
                >
                  <button
                    type="button"
                    className="grid size-11 place-items-center text-xl font-medium text-ink transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Remove one ${rt.name} room`}
                    onClick={() => void changeUnitCount(rt.id, "decrease")}
                    disabled={
                      updatingUnitsId === rt.id ||
                      (unitCounts[rt.id] ?? rt.unitCount) === 0
                    }
                  >
                    <span aria-hidden>−</span>
                  </button>
                  <output
                    className="grid min-w-14 place-items-center self-stretch border-x border-input px-3 text-base font-semibold text-ink"
                    aria-live="polite"
                    aria-label={`${unitCounts[rt.id] ?? rt.unitCount} rooms configured`}
                  >
                    {updatingUnitsId === rt.id
                      ? "…"
                      : (unitCounts[rt.id] ?? rt.unitCount)}
                  </output>
                  <button
                    type="button"
                    className="grid size-11 place-items-center text-xl font-medium text-ink transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Add one ${rt.name} room`}
                    onClick={() => void changeUnitCount(rt.id, "increase")}
                    disabled={updatingUnitsId === rt.id}
                  >
                    <span aria-hidden>+</span>
                  </button>
                </div>
              </div>
              {photosOpenId === rt.id && (
                <MediaManager
                  target={{ kind: "room", id: rt.id }}
                  media={rt.media}
                  heading={`${rt.name} photos`}
                  description="Shown in the guest room gallery. Use sharp landscape photos at least 1600px wide."
                />
              )}
            </li>
          ),
        )}
      </ul>

      {adding && (
        <form
          onSubmit={addRoomType}
          className="surface-card grid gap-3 p-4 sm:grid-cols-[1.4fr_1fr_0.75fr_0.75fr] sm:items-end"
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
          <Field label="Room quantity" htmlFor="rt-quantity" required>
            <Input
              id="rt-quantity"
              type="number"
              min={1}
              max={MAX_ROOM_QUANTITY}
              value={roomQuantity}
              onChange={(e) => setRoomQuantity(e.target.value)}
              required
            />
          </Field>
          <div className="flex flex-wrap gap-2 sm:col-span-4 sm:justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Save room type"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAdding(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

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
  const [priceNaira, setPriceNaira] = useState(
    String(Math.round(roomType.basePriceKobo / 100)),
  );
  const [maxGuests, setMaxGuests] = useState(String(roomType.maxGuests));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await hostApi.updateRoomType(roomType.id, {
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
      <form
        onSubmit={onSubmit}
        className="grid gap-3 sm:grid-cols-[1.5fr_1fr_0.8fr] sm:items-end"
      >
        <Field label="Room type" htmlFor={`edit-name-${roomType.id}`} required>
          <Input
            id={`edit-name-${roomType.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />
        </Field>
        <Field
          label="Price / night (₦)"
          htmlFor={`edit-price-${roomType.id}`}
          required
        >
          <CurrencyInput
            id={`edit-price-${roomType.id}`}
            value={priceNaira}
            onValueChange={setPriceNaira}
            required
          />
        </Field>
        <Field
          label="Max guests"
          htmlFor={`edit-guests-${roomType.id}`}
          required
        >
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={pending}
          >
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
