"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, GuestSelector, type GuestCounts } from "@/ui";
import { guestApi } from "@/lib/api";
import { formatNairaFromKobo } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AvailabilityQuote } from "@/lib/types";

export interface RoomOption {
  id: string;
  name: string;
  basePriceKobo: number;
  maxGuests: number;
}

function toCount(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Shrink occupancy (children first, then adults to a floor of 1) to fit a room. */
function clampGuests(g: GuestCounts, max: number): GuestCounts {
  let { adults, children } = g;
  while (adults + children > max) {
    if (children > 0) children -= 1;
    else if (adults > 1) adults -= 1;
    else break;
  }
  return { ...g, adults, children };
}

export function BookingWidget({
  rooms,
  defaults,
}: {
  rooms: RoomOption[];
  defaults?: {
    checkIn?: string;
    checkOut?: string;
    adults?: string;
    children?: string;
    infants?: string;
  };
}) {
  const router = useRouter();
  const [roomTypeId, setRoomTypeId] = useState(rooms[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState(defaults?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(defaults?.checkOut ?? "");
  const [guests, setGuests] = useState<GuestCounts>(() => ({
    adults: Math.max(1, toCount(defaults?.adults, 2)),
    children: toCount(defaults?.children, 0),
    infants: toCount(defaults?.infants, 0),
  }));
  const [quote, setQuote] = useState<AvailabilityQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxGuests = rooms.find((r) => r.id === roomTypeId)?.maxGuests ?? 16;
  const canCheck = Boolean(roomTypeId && checkIn && checkOut && checkIn < checkOut);
  const resetQuote = () => setQuote(null);

  async function check() {
    setBusy(true);
    setError(null);
    setQuote(null);
    try {
      setQuote(
        await guestApi.quote({
          roomTypeId,
          checkIn,
          checkOut,
          adults: guests.adults,
          children: guests.children,
          infants: guests.infants,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check availability");
    } finally {
      setBusy(false);
    }
  }

  async function reserve() {
    setBusy(true);
    setError(null);
    try {
      const hold = await guestApi.createHold({
        roomTypeId,
        checkIn,
        checkOut,
        adults: guests.adults,
        children: guests.children,
        infants: guests.infants,
      });
      router.push(`/checkout?hold=${hold.holdId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reserve");
      setBusy(false);
    }
  }

  return (
    <div className="surface-card space-y-4 p-5">
      <h2 className="text-title-sm">Book your stay</h2>

      <Field label="Room" htmlFor="bw-room">
        <Select
          id="bw-room"
          value={roomTypeId}
          onChange={(e) => {
            const id = e.target.value;
            setRoomTypeId(id);
            const nextMax = rooms.find((r) => r.id === id)?.maxGuests ?? 16;
            setGuests((g) => clampGuests(g, nextMax));
            resetQuote();
          }}
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} — {formatNairaFromKobo(r.basePriceKobo)}/night
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Check in" htmlFor="bw-in">
          <Input
            id="bw-in"
            type="date"
            value={checkIn}
            onChange={(e) => {
              setCheckIn(e.target.value);
              resetQuote();
            }}
          />
        </Field>
        <Field label="Check out" htmlFor="bw-out">
          <Input
            id="bw-out"
            type="date"
            value={checkOut}
            onChange={(e) => {
              setCheckOut(e.target.value);
              resetQuote();
            }}
          />
        </Field>
      </div>

      <Field label="Guests" htmlFor="bw-guests">
        <GuestSelector
          id="bw-guests"
          value={guests}
          maxGuests={maxGuests}
          onChange={(next) => {
            setGuests(next);
            resetQuote();
          }}
        />
      </Field>

      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}

      {!quote ? (
        <Button onClick={check} disabled={!canCheck || busy} className="w-full">
          {busy ? "Checking…" : "Check availability"}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {formatNairaFromKobo(quote.nightlyPriceKobo)} × {quote.nights} night
                {quote.nights === 1 ? "" : "s"}
              </span>
              <span className="font-semibold text-ink">{formatNairaFromKobo(quote.totalKobo)}</span>
            </div>
            <p className={cn("mt-1 text-xs", quote.available > 0 ? "text-success" : "text-error")}>
              {quote.available > 0
                ? `${quote.available} available for these dates`
                : "Not available for these dates"}
            </p>
          </div>
          {quote.available > 0 ? (
            <Button onClick={reserve} disabled={busy} className="w-full">
              {busy ? "Reserving…" : "Reserve & continue"}
            </Button>
          ) : (
            <Button variant="secondary" onClick={resetQuote} className="w-full">
              Change dates
            </Button>
          )}
        </div>
      )}

      <p className="text-caption">Availability is verified by Staynex before payment.</p>
    </div>
  );
}
