"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/ui";
import { CITIES } from "@/features/properties/fixtures";
import { areasApi } from "@/lib/api";
import { AREA_TYPE_LABELS, type AreaOption } from "@/lib/types";

interface Defaults {
  city?: string;
  area?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
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

// Mobile-first search. City + area sit up top; dates/guests live in a collapsible
// "More options" disclosure so the form stays light on small screens.
export function SearchPanel({ defaults }: { defaults?: Defaults }) {
  const router = useRouter();
  const optionsId = useId();

  const [city, setCity] = useState(defaults?.city ?? "");
  const [area, setArea] = useState(defaults?.area ?? "");
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [checkIn, setCheckIn] = useState(defaults?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(defaults?.checkOut ?? "");
  const [guests, setGuests] = useState(defaults?.guests ?? "2");
  const [showMore, setShowMore] = useState(
    Boolean(defaults?.checkIn || defaults?.checkOut || defaults?.guests),
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

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!city) return;
    const qs = new URLSearchParams({ city });
    if (area) qs.set("area", area);
    if (checkIn) qs.set("checkIn", checkIn);
    if (checkOut) qs.set("checkOut", checkOut);
    if (guests) qs.set("guests", guests);
    router.push(`/search?${qs.toString()}`);
  }

  const notable = areas.filter((a) => a.notable);
  const withStays = areas.filter((a) => !a.notable && a.hasProperties);
  const others = areas.filter((a) => !a.notable && !a.hasProperties);
  const areaHint = !city
    ? "Choose a city first"
    : loadingAreas
      ? "Loading areas..."
      : "All areas";

  return (
    <div className="attention-border rounded-2xl p-0.5 shadow-sm">
      <form
        onSubmit={submit}
        className="space-y-3 rounded-[14px] bg-surface-raised p-4 sm:p-5"
      >
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
              {notable.length > 0 && (
                <optgroup label="Notable areas">
                  {notable.map((a) => (
                    <option key={a.id} value={a.slug}>
                      {a.name} - {AREA_TYPE_LABELS[a.type]}
                    </option>
                  ))}
                </optgroup>
              )}
              {withStays.length > 0 && (
                <optgroup label="Areas with stays">
                  {withStays.map((a) => (
                    <option key={a.id} value={a.slug}>
                      {a.name} - {AREA_TYPE_LABELS[a.type]}
                    </option>
                  ))}
                </optgroup>
              )}
              {others.length > 0 && (
                <optgroup label="All areas">
                  {others.map((a) => (
                    <option key={a.id} value={a.slug}>
                      {a.name} - {AREA_TYPE_LABELS[a.type]}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          </Field>
        </div>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          aria-controls={optionsId}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
        >
          <span
            aria-hidden
            className={`transition-transform ${showMore ? "rotate-90" : ""}`}
          >
            ›
          </span>
          Dates &amp; guests
        </button>

        {showMore && (
          <div id={optionsId} className="grid gap-3 sm:grid-cols-3">
            <Field label="Check in" htmlFor="checkIn">
              <Input
                id="checkIn"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </Field>
            <Field label="Check out" htmlFor="checkOut">
              <Input
                id="checkOut"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </Field>
            <Field label="Guests" htmlFor="guests">
              <Select
                id="guests"
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "guest" : "guests"}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        <Button type="submit" className="w-full sm:w-auto" disabled={!city}>
          Search stays
        </Button>
      </form>
    </div>
  );
}
