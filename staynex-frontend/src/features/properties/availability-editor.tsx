"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, LinkButton, Select } from "@/ui";
import { apiErrorMessage, hostApi } from "@/lib/api";
import type { AvailabilityDay, RoomTypeDetail } from "@/lib/types";

const MAX_RANGE_DAYS = 366;
const DEFAULT_OPEN_DAYS = 30;

type AvailabilityDays = "30" | "60" | "90" | "180" | "365" | "custom";

const AVAILABILITY_DAY_OPTIONS: Array<{
  value: AvailabilityDays;
  label: string;
}> = [
  { value: "30", label: "Next 30 days (recommended to go live)" },
  { value: "60", label: "Next 60 days" },
  { value: "90", label: "Next 90 days" },
  { value: "180", label: "Next 180 days" },
  { value: "365", label: "Next 365 days" },
  { value: "custom", label: "Choose a custom date range" },
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
  const [availabilityDays, setAvailabilityDays] =
    useState<AvailabilityDays>("30");
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
  const previousRoom = useRef<{ id: string; unitCount: number } | null>(null);
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

  // `router.refresh()` intentionally preserves client state. Keep the selection
  // aligned with new room data without replacing a host's valid manual capacity.
  useEffect(() => {
    const nextRoom =
      roomTypes.find((room) => room.id === roomTypeId) ?? roomTypes[0] ?? null;
    const previous = previousRoom.current;

    if (!nextRoom) {
      previousRoom.current = null;
      if (roomTypeId) setRoomTypeId("");
      setTotalUnits("0");
      return;
    }

    if (nextRoom.id !== roomTypeId) setRoomTypeId(nextRoom.id);
    setTotalUnits((current) => {
      const currentCapacity = Number(current);
      const selectedNewRoom = previous?.id !== nextRoom.id;
      const receivedFirstUnit =
        previous?.id === nextRoom.id &&
        previous.unitCount === 0 &&
        nextRoom.unitCount > 0;
      if (
        selectedNewRoom ||
        receivedFirstUnit ||
        !Number.isInteger(currentCapacity) ||
        currentCapacity < 0 ||
        currentCapacity > nextRoom.unitCount
      ) {
        return String(nextRoom.unitCount);
      }
      return current;
    });
    previousRoom.current = { id: nextRoom.id, unitCount: nextRoom.unitCount };
  }, [roomTypeId, roomTypes]);

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

  function chooseAvailabilityDays(nextValue: AvailabilityDays) {
    setAvailabilityDays(nextValue);
    if (nextValue !== "custom") {
      const days = Number(nextValue);
      setFrom(initialFrom);
      setTo(addDays(initialFrom, days - 1));
    }
    clearFeedback();
  }

  function chooseStart(nextFrom: string) {
    setAvailabilityDays("custom");
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
          ? `${selectedRoom.name} is closed for ${result.updatedDays} day${result.updatedDays === 1 ? "" : "s"}.`
          : `${selectedRoom.name} is open for ${result.updatedDays} day${result.updatedDays === 1 ? "" : "s"}, with ${capacity} room${capacity === 1 ? "" : "s"} available each night.`,
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
          Add a room type first. You can set its physical room quantity while
          creating it, then open dates here.
        </p>
        <LinkButton href="#room-types" variant="secondary" size="sm">
          Add room type
        </LinkButton>
      </div>
    );
  }

  const roomCount = selectedRoom?.unitCount ?? 0;
  const openDays =
    calendar?.filter((day) => day.availableUnits > 0).length ?? 0;
  const notOpenedDays = Math.max(0, requestedDays - (calendar?.length ?? 0));
  const closedDays =
    calendar?.filter((day) => day.totalUnits === 0).length ?? 0;
  const committedDays =
    calendar?.filter((day) => day.totalUnits > 0 && day.availableUnits === 0)
      .length ?? 0;

  return (
    <form onSubmit={save} className="surface-card space-y-6 p-5 sm:p-6">
      <div className="max-w-2xl">
        <p className="font-semibold text-ink">Set guest availability</p>
        <p className="mt-1 text-caption">
          Choose the room type and how many upcoming days to open. At least 30
          open days are required before the listing can go live.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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

        <Field
          label="Availability days"
          htmlFor="availability-days"
          required
          hint="This opens consecutive calendar days, starting today."
        >
          <Select
            id="availability-days"
            value={availabilityDays}
            onChange={(event) =>
              chooseAvailabilityDays(event.target.value as AvailabilityDays)
            }
            required
          >
            {AVAILABILITY_DAY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {availabilityDays === "custom" && (
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
                setAvailabilityDays("custom");
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
          {selectedRoom?.name} · {requestedDays} day
          {requestedDays === 1 ? "" : "s"} selected
        </p>
        <p className="mt-1 text-caption">
          {capacity === 0
            ? "These dates will be closed to new bookings."
            : `${capacity === roomCount ? `All ${roomCount}` : `${capacity} of ${roomCount}`} physical room${roomCount === 1 ? "" : "s"} will be available each night. Existing bookings and holds stay protected.`}
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
          {advancedOpen
            ? "Hide room availability controls"
            : "Adjust rooms available each night"}
        </button>

        {advancedOpen && (
          <div
            id="advanced-availability"
            className="mt-3 rounded-lg border border-border bg-surface-raised p-4"
          >
            <Field
              label="Rooms available each night"
              htmlFor="availability-units"
              required
              hint={`You have ${roomCount} active physical room${roomCount === 1 ? "" : "s"}. Enter zero only when you want to close the selected dates.`}
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
            ? "Checking the current calendar…"
            : calendar
              ? calendarSummary({
                  openDays,
                  notOpenedDays,
                  closedDays,
                  committedDays,
                })
              : `${requestedDays} day${requestedDays === 1 ? "" : "s"} selected.`}
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
            ? "Saving availability…"
            : capacity === 0
              ? "Close selected days"
              : "Open selected days"}
        </Button>
      </div>

      {selectedRoom && selectedRoom.unitCount === 0 && (
        <div className="flex flex-col gap-3 rounded-md border border-warning-border bg-warning-surface px-3 py-3 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
          <p>This room type has no physical rooms available to sell yet.</p>
          <LinkButton href="#room-types" variant="secondary" size="sm">
            Manage rooms
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

function calendarSummary({
  openDays,
  notOpenedDays,
  closedDays,
  committedDays,
}: {
  openDays: number;
  notOpenedDays: number;
  closedDays: number;
  committedDays: number;
}): string {
  const parts = [`${openDays} day${openDays === 1 ? "" : "s"} currently open`];
  if (notOpenedDays > 0) {
    parts.push(`${notOpenedDays} not opened yet`);
  }
  if (closedDays > 0) {
    parts.push(`${closedDays} deliberately closed`);
  }
  if (committedDays > 0) {
    parts.push(`${committedDays} fully booked or held`);
  }
  return `${parts.join(" · ")}.`;
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
