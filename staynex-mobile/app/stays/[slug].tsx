import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { MediaItem, RoomTypeDetail } from "@staynex/backend/types";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";
import { availabilityApi, catalogApi } from "@/data/api";
import { apiErrorMessage } from "@/core/client";
import { toDateParam } from "@/core/format";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { PriceTag } from "@/ui/PriceTag";
import { DateField, Field, Stepper } from "@/ui/form";
import { ErrorState, LoadingState } from "@/ui/states";

function param(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default function StayDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const slug = param(params.slug) ?? "";

  const [checkIn, setCheckIn] = useState<string | null>(param(params.checkIn) || null);
  const [checkOut, setCheckOut] = useState<string | null>(param(params.checkOut) || null);
  const [guests, setGuests] = useState(Number(param(params.guests)) || 2);

  const stayQuery = useQuery({
    queryKey: ["stay", slug],
    queryFn: () => catalogApi.stay(slug),
    enabled: Boolean(slug),
  });

  if (stayQuery.isLoading) {
    return (
      <Screen padded>
        <LoadingState label="Loading stay…" />
      </Screen>
    );
  }
  if (stayQuery.isError || !stayQuery.data) {
    return (
      <Screen padded>
        <ErrorState
          message={apiErrorMessage(stayQuery.error, "Couldn't load this stay.")}
          onRetry={() => stayQuery.refetch()}
        />
      </Screen>
    );
  }

  const stay = stayQuery.data;
  const datesValid = Boolean(checkIn && checkOut);
  const minCheckOut = checkIn ? addDays(checkIn, 1) : undefined;

  function book(room: RoomTypeDetail) {
    if (!checkIn || !checkOut) return;
    router.push({
      pathname: "/booking/quote",
      params: { roomTypeId: room.id, slug, checkIn, checkOut, guests: String(guests) },
    });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Gallery media={stay.media} />

        <View style={styles.section}>
          <Text style={styles.name}>{stay.name}</Text>
          <Text style={styles.city}>{stay.cityName}</Text>
          {stay.description ? <Text style={styles.description}>{stay.description}</Text> : null}
        </View>

        <View style={[styles.section, styles.dateCard]}>
          <Text style={styles.sectionTitle}>Your dates</Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <Field label="Check in">
                <DateField value={checkIn} onChange={setCheckIn} minimumDate={new Date()} />
              </Field>
            </View>
            <View style={styles.col}>
              <Field label="Check out">
                <DateField value={checkOut} onChange={setCheckOut} minimumDate={minCheckOut} />
              </Field>
            </View>
          </View>
          <Field label="Guests">
            <Stepper value={guests} onChange={setGuests} min={1} max={20} />
          </Field>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rooms</Text>
          {stay.roomTypes.length === 0 ? (
            <Text style={styles.muted}>No rooms are listed for this stay yet.</Text>
          ) : (
            stay.roomTypes.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                checkIn={checkIn}
                datesValid={datesValid}
                onBook={() => book(room)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Gallery({ media }: { media: MediaItem[] }) {
  if (media.length === 0) {
    return (
      <View style={[styles.galleryItem, styles.galleryFallback]}>
        <Text style={styles.muted}>No photos yet</Text>
      </View>
    );
  }
  return (
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
      {media.map((item) => (
        <Image
          key={item.id}
          source={{ uri: item.url }}
          style={styles.galleryItem}
          resizeMode="cover"
          accessibilityLabel={item.altText ?? undefined}
          accessibilityIgnoresInvertColors
        />
      ))}
    </ScrollView>
  );
}

function RoomCard({
  room,
  checkIn,
  datesValid,
  onBook,
}: {
  room: RoomTypeDetail;
  checkIn: string | null;
  datesValid: boolean;
  onBook: () => void;
}) {
  return (
    <View style={styles.roomCard}>
      <Text style={styles.roomName}>{room.name}</Text>
      <Text style={styles.muted}>Up to {room.maxGuests} guests</Text>
      {room.description ? (
        <Text style={styles.roomDescription} numberOfLines={3}>
          {room.description}
        </Text>
      ) : null}
      <AvailabilityStrip roomTypeId={room.id} checkIn={checkIn} />
      <View style={styles.roomFooter}>
        <PriceTag kobo={room.basePriceKobo} suffix="/ night" size="lg" />
        <View style={styles.bookBtn}>
          <Button label={datesValid ? "Book" : "Pick dates"} onPress={onBook} disabled={!datesValid} />
        </View>
      </View>
    </View>
  );
}

/** Read-only 14-day availability preview from the API. Never derived locally. */
function AvailabilityStrip({
  roomTypeId,
  checkIn,
}: {
  roomTypeId: string;
  checkIn: string | null;
}) {
  const from = checkIn ?? toDateParam(new Date());
  const to = addDaysParam(from, 13);

  const query = useQuery({
    queryKey: ["availability", roomTypeId, from, to],
    queryFn: () => availabilityApi.calendar(roomTypeId, from, to),
  });

  if (query.isLoading) {
    return <Text style={styles.availabilityHint}>Checking availability…</Text>;
  }
  if (query.isError || !query.data) {
    return <Text style={styles.availabilityHint}>Availability unavailable right now.</Text>;
  }
  if (query.data.length === 0) {
    return <Text style={styles.availabilityHint}>No availability published for these dates.</Text>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
      {query.data.map((day) => {
        const open = day.availableUnits > 0;
        return (
          <View key={day.date} style={[styles.dayCell, open ? styles.dayOpen : styles.dayFull]}>
            <Text style={styles.dayLabel}>{day.date.slice(8)}</Text>
            <Text style={[styles.dayCount, open ? styles.dayCountOpen : styles.dayCountFull]}>
              {open ? day.availableUnits : "—"}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function addDays(iso: string, days: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}
function addDaysParam(iso: string, days: number): string {
  return toDateParam(addDays(iso, days));
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  galleryItem: { width: 320, height: 200, backgroundColor: color.subtle },
  galleryFallback: { width: "100%", alignItems: "center", justifyContent: "center" },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: color.ink },
  name: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: color.ink },
  city: { fontSize: fontSize.sm, color: color.muted },
  description: { fontSize: fontSize.sm, color: color.ink, lineHeight: 20 },
  dateCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
  },
  row: { flexDirection: "row", gap: spacing.md },
  col: { flex: 1 },
  muted: { fontSize: fontSize.sm, color: color.muted },
  roomCard: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  roomName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: color.ink },
  roomDescription: { fontSize: fontSize.sm, color: color.muted, marginTop: spacing.xs },
  roomFooter: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bookBtn: { minWidth: 120 },
  availabilityHint: { fontSize: fontSize.xs, color: color.muted, marginTop: spacing.sm },
  strip: { marginTop: spacing.sm },
  dayCell: {
    width: 40,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
    borderRadius: radius.sm,
    alignItems: "center",
    borderWidth: 1,
  },
  dayOpen: { borderColor: color.border, backgroundColor: color.surface },
  dayFull: { borderColor: color.border, backgroundColor: color.subtle },
  dayLabel: { fontSize: fontSize.xs, color: color.muted },
  dayCount: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  dayCountOpen: { color: color.success },
  dayCountFull: { color: color.muted },
});
