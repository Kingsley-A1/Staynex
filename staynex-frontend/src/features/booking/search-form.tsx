import { Button, Field, Input, Select } from "@/ui";
import { CITIES } from "@/features/properties/fixtures";

// Server component: a native GET form that navigates to /search with query params
// (works without client JS). Cities submit by name; the backend matches name/slug.
export function SearchForm({
  defaults,
}: {
  defaults?: { city?: string; checkIn?: string; checkOut?: string; guests?: string };
}) {
  return (
    <form
      action="/search"
      className="surface-card grid gap-3 p-4 sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto] sm:items-end"
    >
      <Field label="Where to" htmlFor="city">
        <Select id="city" name="city" defaultValue={defaults?.city ?? CITIES[0]?.name}>
          {CITIES.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Check in" htmlFor="checkIn">
        <Input id="checkIn" name="checkIn" type="date" defaultValue={defaults?.checkIn} />
      </Field>
      <Field label="Check out" htmlFor="checkOut">
        <Input id="checkOut" name="checkOut" type="date" defaultValue={defaults?.checkOut} />
      </Field>
      <Field label="Guests" htmlFor="guests">
        <Select id="guests" name="guests" defaultValue={defaults?.guests ?? "2"}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit">Search</Button>
    </form>
  );
}
