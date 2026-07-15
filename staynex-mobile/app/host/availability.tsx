// Availability quick actions — the mobile mirror of the web AvailabilityEditor:
// pick a room type, open the next 30/60/90/180/365 days (the web's own quick
// options), or close them (0 rooms). The backend stays the sole authority —
// it validates ownership, range, and capacity, and keeps booked/held nights
// protected no matter what this screen sends.

import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";
import { availabilityApi, hostApi } from "@/data/api";
import { apiErrorMessage } from "@/core/client";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { Field, Select, Stepper } from "@/ui/form";
import { EmptyState, ErrorState, LoadingState } from "@/ui/states";

// Same quick options as the web editor's select (custom ranges stay on the web).
const DAY_OPTIONS = [30, 60, 90, 180, 365] as const;

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function AvailabilityScreen() {
  const queryClient = useQueryClient();
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [days, setDays] = useState<number>(30);
  const [units, setUnits] = useState<number>(0);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const propertiesQuery = useQuery({
    queryKey: ["host-properties"],
    queryFn: hostApi.properties,
  });

  const properties = propertiesQuery.data ?? [];
  const selectedPropertyId = propertyId ?? properties[0]?.id ?? null;

  const propertyQuery = useQuery({
    queryKey: ["host-property", selectedPropertyId],
    queryFn: () => hostApi.property(selectedPropertyId as string),
    enabled: Boolean(selectedPropertyId),
  });

  const roomTypes = propertyQuery.data?.roomTypes ?? [];
  const selectedRoomId = roomTypeId ?? roomTypes[0]?.id ?? null;
  const selectedRoom = roomTypes.find((room) => room.id === selectedRoomId) ?? null;

  // New room selection ⇒ default to selling every physical room it has.
  useEffect(() => {
    if (selectedRoom) setUnits(selectedRoom.unitCount);
  }, [selectedRoom?.id, selectedRoom?.unitCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const from = utcToday();
  const to = addDays(from, days - 1);

  const calendarQuery = useQuery({
    queryKey: ["host-calendar", selectedRoomId, from, to],
    queryFn: () => availabilityApi.calendar(selectedRoomId as string, from, to),
    enabled: Boolean(selectedRoomId),
  });

  // Presentation-only summary over the server's calendar (same buckets as web).
  const summary = useMemo(() => {
    const calendar = calendarQuery.data;
    if (!calendar) return null;
    const open = calendar.filter((day) => day.availableUnits > 0).length;
    const closed = calendar.filter((day) => day.totalUnits === 0).length;
    const committed = calendar.filter(
      (day) => day.totalUnits > 0 && day.availableUnits === 0,
    ).length;
    const notOpened = Math.max(0, days - calendar.length);
    const parts = [`${open} day${open === 1 ? "" : "s"} currently open`];
    if (notOpened > 0) parts.push(`${notOpened} not opened yet`);
    if (closed > 0) parts.push(`${closed} deliberately closed`);
    if (committed > 0) parts.push(`${committed} fully booked or held`);
    return `${parts.join(" · ")}.`;
  }, [calendarQuery.data, days]);

  const saveMutation = useMutation({
    mutationFn: () =>
      hostApi.setCapacity({
        roomTypeId: selectedRoomId as string,
        from,
        to,
        totalUnits: units,
      }),
    onSuccess: (result) => {
      const name = selectedRoom?.name ?? "Room";
      setSavedMessage(
        units === 0
          ? `${name} is closed for ${result.updatedDays} day${result.updatedDays === 1 ? "" : "s"}.`
          : `${name} is open for ${result.updatedDays} day${result.updatedDays === 1 ? "" : "s"}, with ${units} room${units === 1 ? "" : "s"} available each night.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["host-calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["host-property"] });
    },
  });

  if (propertiesQuery.isLoading) {
    return (
      <Screen padded>
        <LoadingState label="Loading your properties…" />
      </Screen>
    );
  }
  if (propertiesQuery.isError) {
    return (
      <Screen padded>
        <ErrorState
          message={apiErrorMessage(propertiesQuery.error, "Couldn't load your properties.")}
          onRetry={() => propertiesQuery.refetch()}
        />
      </Screen>
    );
  }
  if (properties.length === 0) {
    return (
      <Screen padded>
        <EmptyState
          title="No properties yet"
          message="Create your property on staynex.com first, then open its dates here."
        />
      </Screen>
    );
  }

  const roomCount = selectedRoom?.unitCount ?? 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lede}>
          Choose the room type and how many upcoming days to open. At least 30 open days are
          required before a listing can go live.
        </Text>

        <Field label="Property">
          <Select
            value={selectedPropertyId}
            options={properties.map((p) => ({ value: p.id, label: `${p.name} · ${p.cityName}` }))}
            onChange={(next) => {
              setPropertyId(next);
              setRoomTypeId(null);
              setSavedMessage(null);
            }}
          />
        </Field>

        <Field label="Room type">
          <Select
            value={selectedRoomId}
            options={roomTypes.map((room) => ({
              value: room.id,
              label: `${room.name} · ${room.unitCount} room${room.unitCount === 1 ? "" : "s"}`,
            }))}
            placeholder={propertyQuery.isLoading ? "Loading rooms…" : "Select a room type"}
            disabled={propertyQuery.isLoading || roomTypes.length === 0}
            onChange={(next) => {
              setRoomTypeId(next);
              setSavedMessage(null);
            }}
          />
        </Field>

        <Field label="Availability days" hint="Opens consecutive calendar days, starting today.">
          <View style={styles.chips}>
            {DAY_OPTIONS.map((option) => {
              const active = days === option;
              return (
                <Text
                  key={option}
                  accessibilityRole="button"
                  onPress={() => {
                    setDays(option);
                    setSavedMessage(null);
                  }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  {option} days
                </Text>
              );
            })}
          </View>
        </Field>

        <Field
          label="Rooms available each night"
          hint={
            selectedRoom
              ? `You have ${roomCount} active physical room${roomCount === 1 ? "" : "s"}. Zero closes the selected dates.`
              : undefined
          }
        >
          <Stepper value={units} onChange={setUnits} min={0} max={Math.max(roomCount, 0)} />
        </Field>

        <View style={styles.plan}>
          <Text style={styles.planTitle}>
            {selectedRoom?.name ?? "Room"} · {days} days selected
          </Text>
          <Text style={styles.planNote}>
            {units === 0
              ? "These dates will be closed to new bookings."
              : `${units === roomCount ? `All ${roomCount}` : `${units} of ${roomCount}`} physical room${roomCount === 1 ? "" : "s"} will be available each night. Existing bookings and holds stay protected.`}
          </Text>
          <Text style={styles.planSummary}>
            {calendarQuery.isLoading
              ? "Checking the current calendar…"
              : summary ?? `${days} days selected.`}
          </Text>
        </View>

        <Button
          label={
            saveMutation.isPending
              ? "Saving availability…"
              : units === 0
                ? "Close selected days"
                : "Open selected days"
          }
          loading={saveMutation.isPending}
          disabled={!selectedRoom || roomCount === 0}
          onPress={() => {
            setSavedMessage(null);
            saveMutation.mutate();
          }}
        />

        {selectedRoom && roomCount === 0 ? (
          <Text style={styles.warning}>
            This room type has no physical rooms available to sell yet. Manage rooms on
            staynex.com first.
          </Text>
        ) : null}
        {savedMessage ? (
          <Text accessibilityRole="alert" style={styles.saved}>
            {savedMessage}
          </Text>
        ) : null}
        {saveMutation.isError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {apiErrorMessage(
              saveMutation.error,
              "Couldn't save availability. Review the range and try again.",
            )}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  lede: { fontSize: fontSize.sm, color: color.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    color: color.ink,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    overflow: "hidden",
  },
  chipActive: {
    borderColor: color.primary,
    backgroundColor: color.primary,
    color: color.onPrimary,
  },
  plan: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  planTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: color.ink },
  planNote: { fontSize: fontSize.xs, color: color.muted },
  planSummary: { fontSize: fontSize.xs, color: color.ink, marginTop: spacing.xs },
  warning: { fontSize: fontSize.sm, color: color.warning },
  saved: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: color.success,
    backgroundColor: color.successSurface,
    borderWidth: 1,
    borderColor: color.successBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    overflow: "hidden",
  },
  error: { fontSize: fontSize.sm, color: color.error },
});
