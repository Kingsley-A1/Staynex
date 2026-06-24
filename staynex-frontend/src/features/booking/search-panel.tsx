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

// Mobile-first search. City + area sit up top; dates/guests live in a collapsible
// "More options" disclosure so the form stays light on small screens.
export function SearchPanel({ defaults }: { defaults?: Defaults }) {
  const router = useRouter();
  const optionsId = useId();

  const [city, setCity] = useState(defaults?.city ?? CITIES[0]?.name ?? "");
  const [area, setArea] = useState(defaults?.area ?? "");
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [checkIn, setCheckIn] = useState(defaults?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(defaults?.checkOut ?? "");
  const [guests, setGuests] = useState(defaults?.guests ?? "2");
  const [showMore, setShowMore] = useState(Boolean(defaults?.checkIn || defaults?.checkOut));

  useEffect(() => {
    let active = true;
    if (!city) {
      setAreas([]);
      return;
    }
    areasApi
      .listForCity(city)
      .then((list) => active && setAreas(list))
      .catch(() => active && setAreas([]));
    return () => {
      active = false;
    };
  }, [city]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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

  return (
    <form onSubmit={submit} className="surface-card space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Where to" htmlFor="city">
          <Select
            id="city"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setArea("");
            }}
          >
            {CITIES.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Area" htmlFor="area" hint={areas.length === 0 ? "All areas" : undefined}>
          <Select
            id="area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            disabled={areas.length === 0}
          >
            <option value="">All areas</option>
            {notable.length > 0 && (
              <optgroup label="Notable areas">
                {notable.map((a) => (
                  <option key={a.id} value={a.slug}>
                    {a.name} · {AREA_TYPE_LABELS[a.type]}
                  </option>
                ))}
              </optgroup>
            )}
            {withStays.length > 0 && (
              <optgroup label="Areas with stays">
                {withStays.map((a) => (
                  <option key={a.id} value={a.slug}>
                    {a.name} · {AREA_TYPE_LABELS[a.type]}
                  </option>
                ))}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label="All areas">
                {others.map((a) => (
                  <option key={a.id} value={a.slug}>
                    {a.name} · {AREA_TYPE_LABELS[a.type]}
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
        <span aria-hidden className={`transition-transform ${showMore ? "rotate-90" : ""}`}>
          ›
        </span>
        Dates &amp; guests
      </button>

      {showMore && (
        <div id={optionsId} className="grid gap-3 sm:grid-cols-3">
          <Field label="Check in" htmlFor="checkIn">
            <Input id="checkIn" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
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
            <Select id="guests" value={guests} onChange={(e) => setGuests(e.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "guest" : "guests"}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      <Button type="submit" className="w-full sm:w-auto">
        Search stays
      </Button>
    </form>
  );
}
