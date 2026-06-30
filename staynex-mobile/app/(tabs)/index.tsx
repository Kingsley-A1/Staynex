import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { PropertySummary } from "@staynex/backend/types";
import { color, fontSize, fontWeight, spacing } from "@staynex/shared";
import { areasApi, catalogApi, type SearchInput } from "@/data/api";
import { apiErrorMessage } from "@/core/client";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { PropertyCard } from "@/ui/PropertyCard";
import { DateField, Field, Select, Stepper, type Option } from "@/ui/form";
import { EmptyState, ErrorState, LoadingState } from "@/ui/states";

export default function SearchScreen() {
  const router = useRouter();

  const [city, setCity] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const [submitted, setSubmitted] = useState<SearchInput | null>(null);

  const citiesQuery = useQuery({
    queryKey: ["cities"],
    queryFn: catalogApi.cities,
  });

  const areasQuery = useQuery({
    queryKey: ["areas", city],
    queryFn: () => areasApi.listForCity(city as string),
    enabled: Boolean(city),
  });

  const searchQuery = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => catalogApi.search(submitted as SearchInput),
    enabled: Boolean(submitted),
  });

  const cityOptions: Option[] = useMemo(
    () => (citiesQuery.data ?? []).map((c) => ({ label: c.name, value: c.name })),
    [citiesQuery.data],
  );
  const areaOptions: Option[] = useMemo(
    () => (areasQuery.data ?? []).map((a) => ({ label: a.name, value: a.slug })),
    [areasQuery.data],
  );

  const datesValid = (!checkIn && !checkOut) || Boolean(checkIn && checkOut);
  const canSearch = Boolean(city) && datesValid;

  function runSearch() {
    if (!city) return;
    setSubmitted({
      city,
      area: area ?? undefined,
      checkIn: checkIn ?? undefined,
      checkOut: checkOut ?? undefined,
      guests,
    });
  }

  function openStay(property: PropertySummary) {
    router.push({
      pathname: "/stays/[slug]",
      params: {
        slug: property.slug,
        checkIn: checkIn ?? "",
        checkOut: checkOut ?? "",
        guests: String(guests),
      },
    });
  }

  const minCheckOut = checkIn ? addDays(checkIn, 1) : undefined;

  const header = (
    <View style={styles.form}>
      <Text style={styles.heading}>Book trusted stays</Text>
      <Text style={styles.subheading}>Search verified stays across Nigeria.</Text>

      <Field label="Where to" hint={citiesQuery.isError ? "Couldn't load cities — type-ahead unavailable" : undefined}>
        <Select
          value={city}
          options={cityOptions}
          placeholder={citiesQuery.isLoading ? "Loading cities…" : "Select a city"}
          onChange={(v) => {
            setCity(v);
            setArea(null);
          }}
        />
      </Field>

      <Field label="Area" hint={!city ? "Choose a city first" : undefined}>
        <Select
          value={area}
          options={areaOptions}
          disabled={!city || areasQuery.isLoading}
          placeholder={areasQuery.isLoading ? "Loading areas…" : "All areas"}
          onChange={setArea}
        />
      </Field>

      <View style={styles.row}>
        <View style={styles.col}>
          <Field label="Check in">
            <DateField value={checkIn} onChange={setCheckIn} minimumDate={new Date()} />
          </Field>
        </View>
        <View style={styles.col}>
          <Field label="Check out" hint={!datesValid ? "Add both dates" : undefined}>
            <DateField
              value={checkOut}
              onChange={setCheckOut}
              minimumDate={minCheckOut}
              placeholder="Select a date"
            />
          </Field>
        </View>
      </View>

      <Field label="Guests">
        <Stepper value={guests} onChange={setGuests} min={1} max={20} />
      </Field>

      <Button label="Search stays" onPress={runSearch} disabled={!canSearch} />
    </View>
  );

  return (
    <Screen edges={["top"]}>
      <FlatList
        data={searchQuery.data ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <PropertyCard property={item} onPress={() => openStay(item)} />
          </View>
        )}
        ListFooterComponent={
          <SearchFooter
            submitted={Boolean(submitted)}
            isLoading={searchQuery.isLoading}
            isError={searchQuery.isError}
            isEmpty={Boolean(submitted) && (searchQuery.data?.length ?? 0) === 0}
            errorMessage={apiErrorMessage(searchQuery.error, "Couldn't load stays.")}
            onRetry={() => searchQuery.refetch()}
          />
        }
      />
    </Screen>
  );
}

function SearchFooter({
  submitted,
  isLoading,
  isError,
  isEmpty,
  errorMessage,
  onRetry,
}: {
  submitted: boolean;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  errorMessage: string;
  onRetry: () => void;
}) {
  if (!submitted) {
    return (
      <View style={styles.footer}>
        <EmptyState title="Find your stay" message="Pick a city and dates, then search." />
      </View>
    );
  }
  if (isLoading) {
    return (
      <View style={styles.footer}>
        <LoadingState label="Searching stays…" />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={styles.footer}>
        <ErrorState message={errorMessage} onRetry={onRetry} />
      </View>
    );
  }
  if (isEmpty) {
    return (
      <View style={styles.footer}>
        <EmptyState
          title="No stays found"
          message="Try a different city, area, or dates."
        />
      </View>
    );
  }
  return null;
}

/** Day arithmetic for the check-out picker's minimum bound (UI constraint only). */
function addDays(iso: string, days: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  form: { gap: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.md },
  heading: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: color.ink },
  subheading: { fontSize: fontSize.sm, color: color.muted, marginTop: -spacing.xs, marginBottom: spacing.sm },
  row: { flexDirection: "row", gap: spacing.md },
  col: { flex: 1 },
  cardWrap: { marginBottom: spacing.lg },
  footer: { minHeight: 220 },
});
