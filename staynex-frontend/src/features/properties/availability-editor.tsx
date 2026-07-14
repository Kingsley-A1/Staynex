"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, LinkButton, Select } from "@/ui";
import { apiErrorMessage, hostApi } from "@/lib/api";
import type { AvailabilityDay, RoomTypeDetail } from "@/lib/types";

const MAX_RANGE_DAYS = 366;

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

  function chooseRoom(nextId: string) {
    const room = roomTypes.find((candidate) => candidate.id === nextId);
    setRoomTypeId(nextId);
    setTotalUnits(String(room?.unitCount ?? 0));
    setSavedMessage(null);
    setError(null);
  }

  function chooseStart(nextFrom: string) {
    setFrom(nextFrom);
    const latestEnd = addDays(nextFrom, MAX_RANGE_DAYS - 1);
    if (to < nextFrom) setTo(addDays(nextFrom, 29));
    else if (to > latestEnd) setTo(latestEnd);
    setSavedMessage(null);
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
        `${result.updatedDays} night${result.updatedDays === 1 ? "" : "s"} updated for ${selectedRoom.name}.`,
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

  return (
    <form onSubmit={save} className="surface-card space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="font-semibold text-ink">Open rooms for booking</p>
          <p className="mt-1 text-caption">
            Choose how many physical rooms guests can book on each night. Set
            zero to close the selected dates.
          </p>
        </div>
        <span className="rounded-full bg-primary-subtle px-2.5 py-1 text-xs font-semibold text-primary">
          30 open days required for review
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Room type" htmlFor="availability-room" required>
          <Select
            id="availability-room"
            value={roomTypeId}
            onChange={(event) => chooseRoom(event.target.value)}
            required
          >
            {roomTypes.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </Select>
        </Field>
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
              setSavedMessage(null);
            }}
            required
          />
        </Field>
        <Field
          label="Available rooms per night"
          htmlFor="availability-units"
          required
          hint={`${selectedRoom?.unitCount ?? 0} active room unit${selectedRoom?.unitCount === 1 ? "" : "s"} configured.`}
        >
          <Input
            id="availability-units"
            type="number"
            inputMode="numeric"
            min={0}
            max={selectedRoom?.unitCount ?? 0}
            value={totalUnits}
            onChange={(event) => {
              setTotalUnits(event.target.value);
              setSavedMessage(null);
            }}
            required
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-caption" aria-live="polite">
          {loadingCalendar
            ? "Checking current availability…"
            : calendar
              ? `${openDays} of ${requestedDays} selected nights are currently open.`
              : `${requestedDays} night${requestedDays === 1 ? "" : "s"} selected.`}
        </p>
        <Button
          type="submit"
          disabled={
            pending ||
            !validCapacity ||
            requestedDays < 1 ||
            requestedDays > MAX_RANGE_DAYS
          }
        >
          {pending ? "Saving availability…" : "Save availability"}
        </Button>
      </div>

      {selectedRoom && selectedRoom.unitCount === 0 && (
        <p className="rounded-md border border-warning-border bg-warning-surface px-3 py-2 text-sm text-warning">
          This room type has no units yet. Add a room unit before opening dates.
        </p>
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
