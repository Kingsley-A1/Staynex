"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, GuestSelector, guestSummary, type GuestCounts } from "@/ui";
import { CITIES } from "@/features/properties/fixtures";
import { areasApi } from "@/lib/api";
import { type AreaOption } from "@/lib/types";

interface Defaults {
  city?: string;
  area?: string;
  checkIn?: string;
  checkOut?: string;
  adults?: string;
  children?: string;
  infants?: string;
}

function toCount(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const FALLBACK_AREAS: Record<string, AreaOption[]> = {
  Calabar: [
    fallbackArea("Calabar Municipal", "calabar", "LOCAL_GOVERNMENT_AREA", true),
    fallbackArea("Calabar South", "calabar", "LOCAL_GOVERNMENT_AREA", true),
    fallbackArea("Marina", "calabar", "NEIGHBORHOOD", true),
    fallbackArea("State Housing", "calabar", "NEIGHBORHOOD"),
    fallbackArea("Diamond Hill", "calabar", "NEIGHBORHOOD"),
  ],
  Uyo: [
    fallbackArea("Uyo", "uyo", "LOCAL_GOVERNMENT_AREA", true),
    fallbackArea("Ewet Housing", "uyo", "NEIGHBORHOOD", true),
    fallbackArea("Itam", "uyo", "NEIGHBORHOOD"),
  ],
  "Port Harcourt": [
    fallbackArea(
      "Port Harcourt City",
      "port-harcourt",
      "LOCAL_GOVERNMENT_AREA",
      true,
    ),
    fallbackArea("Old GRA", "port-harcourt", "NEIGHBORHOOD", true),
    fallbackArea("Diobu", "port-harcourt", "NEIGHBORHOOD"),
  ],
  Lagos: [
    fallbackArea("Eti-Osa", "lagos", "LOCAL_GOVERNMENT_AREA", true),
    fallbackArea("Victoria Island", "lagos", "NEIGHBORHOOD", true),
    fallbackArea("Lekki", "lagos", "NEIGHBORHOOD", true),
    fallbackArea("Ikeja", "lagos", "NEIGHBORHOOD"),
  ],
  Abuja: [
    fallbackArea(
      "Municipal Area Council",
      "abuja",
      "LOCAL_GOVERNMENT_AREA",
      true,
    ),
    fallbackArea("Maitama", "abuja", "NEIGHBORHOOD", true),
    fallbackArea("Wuse", "abuja", "NEIGHBORHOOD"),
    fallbackArea("Garki", "abuja", "NEIGHBORHOOD"),
  ],
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function fallbackArea(
  name: string,
  citySlug: string,
  type: AreaOption["type"],
  notable = false,
): AreaOption {
  return {
    id: `fallback_${citySlug}_${slugify(name)}`,
    name,
    slug: `${slugify(name)}-${citySlug}`,
    type,
    notable,
    hasProperties: false,
  };
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateOffsetInput(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function nextDateInput(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateOffsetInput(1);
  date.setDate(date.getDate() + 1);
  return toDateInputValue(date);
}

function summaryDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function orderedAreas(list: AreaOption[]): AreaOption[] {
  return [...list].sort((a, b) => {
    const priorityA = Number(b.notable) - Number(a.notable);
    if (priorityA !== 0) return priorityA;
    const withStays = Number(b.hasProperties) - Number(a.hasProperties);
    if (withStays !== 0) return withStays;
    return a.name.localeCompare(b.name);
  });
}

// Mobile-first search. City + area sit up top; dates/guests live in a collapsible
// "More options" disclosure so the form stays light on small screens.
export function SearchPanel({ defaults }: { defaults?: Defaults }) {
  const router = useRouter();
  const optionsId = useId();

  const [city, setCity] = useState(defaults?.city ?? "");
  const [area, setArea] = useState(defaults?.area ?? "");
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [checkIn, setCheckIn] = useState(() => defaults?.checkIn ?? dateOffsetInput(0));
  const [checkOut, setCheckOut] = useState(() => defaults?.checkOut ?? dateOffsetInput(1));
  const [guests, setGuests] = useState<GuestCounts>(() => ({
    adults: Math.max(1, toCount(defaults?.adults, 2)),
    children: toCount(defaults?.children, 0),
    infants: toCount(defaults?.infants, 0),
  }));
  const [showMore, setShowMore] = useState(
    Boolean(
      defaults?.checkIn ||
        defaults?.checkOut ||
        defaults?.adults ||
        defaults?.children ||
        defaults?.infants,
    ),
  );

  useEffect(() => {
    let active = true;
    if (!city) {
      setAreas([]);
      setLoadingAreas(false);
      return;
    }
    setLoadingAreas(true);
    areasApi
      .listForCity(city)
      .then((list) => {
        if (!active) return;
        setAreas(list.length > 0 ? list : (FALLBACK_AREAS[city] ?? []));
      })
      .catch(() => active && setAreas(FALLBACK_AREAS[city] ?? []))
      .finally(() => active && setLoadingAreas(false));
    return () => {
      active = false;
    };
  }, [city]);

  useEffect(() => {
    if (checkIn && (!checkOut || checkOut <= checkIn)) {
      setCheckOut(nextDateInput(checkIn));
    }
  }, [checkIn, checkOut]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!city) return;
    const qs = new URLSearchParams({ city });
    if (area) qs.set("area", area);
    if (checkIn) qs.set("checkIn", checkIn);
    if (checkOut) qs.set("checkOut", checkOut);
    qs.set("adults", String(guests.adults));
    if (guests.children > 0) qs.set("children", String(guests.children));
    if (guests.infants > 0) qs.set("infants", String(guests.infants));
    router.push(`/search?${qs.toString()}`);
  }

  const areaOptions = orderedAreas(areas);
  const areaHint = !city
    ? "Choose a city first"
    : loadingAreas
      ? "Loading areas..."
      : "Choose an area or keep all areas.";
  const dateSummary = `${summaryDate(checkIn)} - ${summaryDate(checkOut)} · ${guestSummary(guests)}`;

  return (
    <form onSubmit={submit} className="attention-border space-y-4 rounded-md p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Where to" htmlFor="city">
          <Select
            id="city"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setArea("");
            }}
            required
          >
            <option value="" disabled>
              Select a city
            </option>
            {CITIES.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Area" htmlFor="area" hint={areaHint}>
          <Select
            id="area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            disabled={!city || loadingAreas}
          >
            <option value="">All areas</option>
            {areaOptions.map((a) => (
              <option key={a.id} value={a.slug}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {showMore && (
        <div id={optionsId} className="grid gap-3 sm:grid-cols-3">
          <Field label="Check in" htmlFor="checkIn">
            <Input
              id="checkIn"
              type="date"
              value={checkIn}
              min={dateOffsetInput(0)}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </Field>
          <Field label="Check out" htmlFor="checkOut">
            <Input
              id="checkOut"
              type="date"
              value={checkOut}
              min={nextDateInput(checkIn)}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </Field>
          <Field label="Guests" htmlFor="guests">
            <GuestSelector id="guests" value={guests} onChange={setGuests} />
          </Field>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          aria-controls={optionsId}
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-left text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          <span
            aria-hidden
            className={`text-lg leading-none transition-transform ${showMore ? "rotate-90" : ""}`}
          >
            ›
          </span>
          <span>
            Dates &amp; guests
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              {dateSummary}
            </span>
          </span>
        </button>

        <Button type="submit" className="w-full sm:w-auto sm:shrink-0" disabled={!city}>
          Search stays
        </Button>
      </div>
    </form>
  );
}
