"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, LinkButton, Select } from "@/ui";
import { apiErrorMessage, hostApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { AvailabilityDay, RoomTypeDetail } from "@/lib/types";

const MAX_RANGE_DAYS = 366;
const DEFAULT_OPEN_DAYS = 30;

type AvailabilityMode = "30-days" | "90-days" | "custom";

const OPENING_OPTIONS: Array<{
  mode: AvailabilityMode;
  label: string;
  description: string;
}> = [
  {
    mode: "30-days",
    label: "Next 30 days",
    description: "Recommended",
  },
  {
    mode: "90-days",
    label: "Next 90 days",
    description: "Plan further ahead",
  },
  {
    mode: "custom",
    label: "Choose dates",
    description: "Set your own range",
  },
];

export function AvailabilityEditor({
  roomTypes,
  initialFrom,
  initialTo,
}: {
  roomTypes: RoomTypeDetail[];
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id ?? "");
  const [mode, setMode] = useState<AvailabilityMode>("30-days");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const selectedRoom = useMemo(
    () => roomTypes.find((room) => room.id === roomTypeId) ?? null,
    [roomTypeId, roomTypes],
  );
  const [totalUnits, setTotalUnits] = useState(
    String(roomTypes[0]?.unitCount ?? 0),
  );
  const [calendar, setCalendar] = useState<AvailabilityDay[] | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const maxTo = addDays(from, MAX_RANGE_DAYS - 1);
  const requestedDays = inclusiveDays(from, to);
  const capacity = Number(totalUnits);
  const validCapacity =
    selectedRoom !== null &&
    Number.isInteger(capacity) &&
    capacity >= 0 &&
    capacity <= selectedRoom.unitCount;

  useEffect(() => {
    if (!roomTypeId || requestedDays < 1 || requestedDays > MAX_RANGE_DAYS) {
      setCalendar(null);
      return;
    }

    let active = true;
    setLoadingCalendar(true);
    hostApi
      .getCalendar(roomTypeId, from, to)
      .then((days) => {
        if (active) setCalendar(days);
      })
      .catch(() => {
        if (active) setCalendar(null);
      })
      .finally(() => {
        if (active) setLoadingCalendar(false);
      });
    return () => {
      active = false;
    };
  }, [from, requestedDays, roomTypeId, to]);

  function clearFeedback() {
    setSavedMessage(null);
    setError(null);
  }

  function chooseRoom(nextId: string) {
    const room = roomTypes.find((candidate) => candidate.id === nextId);
    setRoomTypeId(nextId);
    setTotalUnits(String(room?.unitCount ?? 0));
    clearFeedback();
  }

  function chooseMode(nextMode: AvailabilityMode) {
    setMode(nextMode);
    setTotalUnits(String(selectedRoom?.unitCount ?? 0));
    if (nextMode === "30-days") {
      setFrom(initialFrom);
      setTo(addDays(initialFrom, DEFAULT_OPEN_DAYS - 1));
    } else if (nextMode === "90-days") {
      setFrom(initialFrom);
      setTo(addDays(initialFrom, 89));
    }
    clearFeedback();
  }

  function chooseStart(nextFrom: string) {
    setFrom(nextFrom);
    const latestEnd = addDays(nextFrom, MAX_RANGE_DAYS - 1);
    if (to < nextFrom) setTo(addDays(nextFrom, DEFAULT_OPEN_DAYS - 1));
    else if (to > latestEnd) setTo(latestEnd);
    clearFeedback();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoom || !validCapacity) return;
    setPending(true);
    setError(null);
    setSavedMessage(null);
    try {
      const result = await hostApi.setCapacity({
        roomTypeId,
        from,
        to,
        totalUnits: capacity,
      });
      setSavedMessage(
        capacity === 0
          ? `${selectedRoom.name} is closed for ${result.updatedDays} night${result.updatedDays === 1 ? "" : "s"}.`
          : `${selectedRoom.name} is open for ${result.updatedDays} night${result.updatedDays === 1 ? "" : "s"}, with up to ${capacity} room${capacity === 1 ? "" : "s"} offered per night.`,
      );
      hostApi
        .getCalendar(roomTypeId, from, to)
        .then(setCalendar)
        .catch(() => undefined);
      router.refresh();
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          "Couldn't save availability. Review the range and try again.",
        ),
      );
    } finally {
      setPending(false);
    }
  }

  if (roomTypes.length === 0) {
    return (
      <div className="surface-card space-y-3 p-5">
        <p className="text-body-sm text-muted-foreground">
          Add a room type and at least one room unit before opening dates for
          guests.
        </p>
        <LinkButton href="#room-types" variant="secondary" size="sm">
          Add room type
        </LinkButton>
      </div>
    );
  }

  const openDays =
    calendar?.filter((day) => day.availableUnits > 0).length ?? 0;
  const roomCount = selectedRoom?.unitCount ?? 0;
  const datesAreCustom = mode === "custom" || advancedOpen;

  return (
    <form onSubmit={save} className="surface-card space-y-6 p-5 sm:p-6">
      <div className="max-w-2xl">
        <p className="font-semibold text-ink">Choose when guests can book</p>
        <p className="mt-1 text-caption">
          Open at least 30 future nights so guests can find and book your
          property. Staynex protects rooms that are already booked or held.
        </p>
      </div>

      <Field label="Room type" htmlFor="availability-room" required>
        <Select
          id="availability-room"
          value={roomTypeId}
          onChange={(event) => chooseRoom(event.target.value)}
          required
        >
          {roomTypes.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name} · {room.unitCount} room
              {room.unitCount === 1 ? "" : "s"}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-label text-ink">
          When should guests be able to book?
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {OPENING_OPTIONS.map((option) => {
            const selected = mode === option.mode;
            return (
              <button
                key={option.mode}
                type="button"
                aria-pressed={selected}
                onClick={() => chooseMode(option.mode)}
                className={cn(
                  "min-h-20 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  selected
                    ? "border-primary bg-primary-subtle text-primary"
                    : "border-border bg-surface-raised text-ink hover:border-primary/40 hover:bg-secondary",
                )}
              >
                <span className="block text-sm font-semibold">
                  {option.label}
                </span>
                <span
                  className={cn(
                    "mt-1 block text-xs",
                    selected ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {datesAreCustom && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From" htmlFor="availability-from" required>
            <Input
              id="availability-from"
              type="date"
              min={initialFrom}
              value={from}
              onChange={(event) => chooseStart(event.target.value)}
              required
            />
          </Field>
          <Field label="Through" htmlFor="availability-to" required>
            <Input
              id="availability-to"
              type="date"
              min={from}
              max={maxTo}
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                clearFeedback();
              }}
              required
            />
          </Field>
        </div>
      )}

      <div className="rounded-lg border border-border bg-background p-4">
        <p className="text-sm font-semibold text-ink">
          {selectedRoom?.name} · {requestedDays} night
          {requestedDays === 1 ? "" : "s"}
        </p>
        <p className="mt-1 text-caption">
          {capacity === 0
            ? "These dates will be closed to new bookings."
            : `${capacity === roomCount ? `All ${roomCount}` : `${capacity} of ${roomCount}`} configured room${roomCount === 1 ? "" : "s"} will be offered per night. Existing bookings and holds are protected automatically.`}
        </p>
      </div>

      <div className="border-t border-border pt-4">
        <button
          type="button"
          className="min-h-11 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-expanded={advancedOpen}
          aria-controls="advanced-availability"
          onClick={() => setAdvancedOpen((current) => !current)}
        >
          {advancedOpen ? "Hide advanced availability" : "Advanced availability"}
        </button>

        {advancedOpen && (
          <div
            id="advanced-availability"
            className="mt-3 rounded-lg border border-border bg-surface-raised p-4"
          >
            <Field
              label="Rooms offered for booking"
              htmlFor="availability-units"
              required
              hint={`You have ${roomCount} active room unit${roomCount === 1 ? "" : "s"}. Enter zero to close the selected dates.`}
            >
              <Input
                id="availability-units"
                type="number"
                inputMode="numeric"
                min={0}
                max={roomCount}
                value={totalUnits}
                onChange={(event) => {
                  setTotalUnits(event.target.value);
                  clearFeedback();
                }}
                required
              />
            </Field>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-caption" aria-live="polite">
          {loadingCalendar
            ? "Checking current availability…"
            : calendar
              ? `${openDays} of ${requestedDays} selected nights are currently open.`
              : `${requestedDays} night${requestedDays === 1 ? "" : "s"} selected.`}
        </p>
        <Button
          type="submit"
          className="w-full sm:w-auto"
          disabled={
            pending ||
            roomCount === 0 ||
            !validCapacity ||
            requestedDays < 1 ||
            requestedDays > MAX_RANGE_DAYS
          }
        >
          {pending
            ? "Opening dates…"
            : capacity === 0
              ? "Close dates"
              : "Open dates"}
        </Button>
      </div>

      {selectedRoom && selectedRoom.unitCount === 0 && (
        <div className="flex flex-col gap-3 rounded-md border border-warning-border bg-warning-surface px-3 py-3 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
          <p>
            This room type has no units yet. Add a room unit before opening
            dates.
          </p>
          <LinkButton href="#room-types" variant="secondary" size="sm">
            Add room unit
          </LinkButton>
        </div>
      )}
      {savedMessage && (
        <p
          className="rounded-md border border-success-border bg-success-surface px-3 py-2 text-sm font-medium text-success"
          role="status"
        >
          {savedMessage}
        </p>
      )}
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function inclusiveDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}
