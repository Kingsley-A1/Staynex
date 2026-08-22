"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Field,
  Input,
  Select,
  GuestSelector,
  guestSummary,
  type GuestCounts,
} from "@/ui";
import { RecoveryNotice } from "@/components/recovery-notice";
import { apiErrorMessage, areasApi, catalogApi } from "@/lib/api";
import { type AreaOption, type CityOption } from "@/lib/types";

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
  const [cities, setCities] = useState<CityOption[]>([]);
  const [cityLoadError, setCityLoadError] = useState<string | null>(null);
  const [cityLoadRun, setCityLoadRun] = useState(0);
  const [area, setArea] = useState(defaults?.area ?? "");
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [areaLoadError, setAreaLoadError] = useState<string | null>(null);
  const [areaLoadRun, setAreaLoadRun] = useState(0);
  const [checkIn, setCheckIn] = useState(
    () => defaults?.checkIn ?? dateOffsetInput(0),
  );
  const [checkOut, setCheckOut] = useState(
    () => defaults?.checkOut ?? dateOffsetInput(1),
  );
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
    setCityLoadError(null);
    catalogApi
      .cities()
      .then((list) => {
        if (!active) return;
        setCities(list);
        if (list.length === 0) {
          setCityLoadError(
            "No live destinations are published yet, so stay search is paused.",
          );
        }
      })
      .catch((error) => {
        if (!active) return;
        setCities([]);
        setCityLoadError(
          apiErrorMessage(
            error,
            "Staynex could not reach the live destination service.",
          ),
        );
      });
    return () => {
      active = false;
    };
  }, [cityLoadRun]);

  useEffect(() => {
    let active = true;
    if (!city) {
      setAreas([]);
      setLoadingAreas(false);
      return;
    }
    setLoadingAreas(true);
    setAreaLoadError(null);
    areasApi
      .listForCity(city)
      .then((list) => {
        if (!active) return;
        setAreas(list);
      })
      .catch((error) => {
        if (!active) return;
        setAreas([]);
        setAreaLoadError(
          apiErrorMessage(
            error,
            "Staynex could not refresh live areas. You can retry or search the whole city.",
          ),
        );
      })
      .finally(() => active && setLoadingAreas(false));
    return () => {
      active = false;
    };
  }, [city, areaLoadRun]);

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
      : areaLoadError
        ? "Areas are unavailable; search the whole city or retry."
        : "Choose an area or keep all areas.";
  const dateSummary = `${summaryDate(checkIn)} - ${summaryDate(checkOut)} · ${guestSummary(guests)}`;

  return (
    <form
      onSubmit={submit}
      className="attention-border space-y-4 rounded-md p-4 sm:p-5"
    >
      {cityLoadError && (
        <RecoveryNotice
          compact
          title="Live destinations are unavailable"
          reason={`${cityLoadError} Search stays is disabled until a live destination list is available.`}
          onRetry={() => setCityLoadRun((run) => run + 1)}
          secondaryAction={{
            label: "Clear selection",
            onSelect: () => {
              setCity("");
              setArea("");
            },
          }}
        />
      )}
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
            disabled={cities.length === 0}
          >
            <option value="" disabled>
              Select a city
            </option>
            {cities.map((c) => (
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

      {areaLoadError && (
        <RecoveryNotice
          compact
          title="Live areas could not be refreshed"
          reason={areaLoadError}
          onRetry={() => setAreaLoadRun((run) => run + 1)}
          secondaryAction={{
            label: "Search all city areas",
            onSelect: () => {
              setArea("");
              setAreaLoadError(null);
            },
          }}
        />
      )}

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

        <Button
          type="submit"
          className="w-full sm:w-auto sm:shrink-0"
          disabled={!city || cities.length === 0}
        >
          Search stays
        </Button>
      </div>
    </form>
  );
}
