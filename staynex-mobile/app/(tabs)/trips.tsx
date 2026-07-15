import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { BookingView } from "@staynex/backend/types";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TONE,
  color,
  fontSize,
  fontWeight,
  formatKoboToNGN,
  radius,
  spacing,
} from "@staynex/shared";
import { bookingApi } from "@/data/api";
import { apiErrorMessage } from "@/core/client";
import { formatDateLabel } from "@/core/format";
import { useSession } from "@/core/session";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { StatusPill } from "@/ui/StatusPill";
import { EmptyState, ErrorState, LoadingState } from "@/ui/states";

type TripSection = { title: string; trips: BookingView[] };

export default function TripsScreen() {
  const router = useRouter();
  const { user, status } = useSession();

  const tripsQuery = useQuery({
    queryKey: ["my-bookings", user?.id],
    queryFn: bookingApi.myBookings,
    enabled: Boolean(user),
  });

  // Presentation-only grouping: a trip is "upcoming" until its check-out date
  // has passed. Status/payment truth stays exactly as the API returned it.
  const sections: TripSection[] = useMemo(() => {
    const trips = tripsQuery.data ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = trips.filter((t) => t.checkOut >= today);
    const past = trips.filter((t) => t.checkOut < today);
    const out: TripSection[] = [];
    if (upcoming.length) out.push({ title: "Upcoming", trips: upcoming });
    if (past.length) out.push({ title: "Past", trips: past });
    return out;
  }, [tripsQuery.data]);

  if (status !== "ready") {
    return (
      <Screen edges={["top"]} padded>
        <LoadingState label="Checking your session…" />
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen edges={["top"]} padded>
        <View style={styles.center}>
          <EmptyState
            title="Your trips live here"
            message="Sign in to see your bookings, receipts, and check-in QR codes."
          />
          <Button
            label="Sign in"
            onPress={() => router.push({ pathname: "/(auth)/login", params: { next: "/trips" } })}
          />
        </View>
      </Screen>
    );
  }

  if (tripsQuery.isLoading) {
    return (
      <Screen edges={["top"]} padded>
        <LoadingState label="Loading your trips…" />
      </Screen>
    );
  }
  if (tripsQuery.isError) {
    return (
      <Screen edges={["top"]} padded>
        <ErrorState
          message={apiErrorMessage(tripsQuery.error, "Couldn't load your trips.")}
          onRetry={() => tripsQuery.refetch()}
        />
      </Screen>
    );
  }

  if ((tripsQuery.data?.length ?? 0) === 0) {
    return (
      <Screen edges={["top"]} padded>
        <View style={styles.center}>
          <EmptyState
            title="No trips yet"
            message="When you book a stay, it shows up here with its receipt and check-in QR."
          />
          <Button label="Find your stay" onPress={() => router.push("/(tabs)")} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]}>
      <FlatList
        data={sections}
        keyExtractor={(section) => section.title}
        contentContainerStyle={styles.listContent}
        refreshing={tripsQuery.isRefetching}
        onRefresh={() => tripsQuery.refetch()}
        renderItem={({ item: section }) => (
          <View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onPress={() =>
                  router.push({ pathname: "/trips/[id]", params: { id: trip.id } })
                }
              />
            ))}
          </View>
        )}
      />
    </Screen>
  );
}

function TripCard({ trip, onPress }: { trip: BookingView; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.property} numberOfLines={1}>
          {trip.propertyName}
        </Text>
        <StatusPill
          label={BOOKING_STATUS_LABELS[trip.status]}
          tone={BOOKING_STATUS_TONE[trip.status]}
        />
      </View>
      <Text style={styles.room} numberOfLines={1}>
        {trip.roomName} · {trip.cityName}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={styles.dates}>
          {formatDateLabel(trip.checkIn)} → {formatDateLabel(trip.checkOut)}
        </Text>
        <Text style={styles.amount}>{formatKoboToNGN(trip.amountKobo)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.md },
  center: { flex: 1, justifyContent: "center", gap: spacing.md },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: color.ink,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  cardPressed: { opacity: 0.85 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  property: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: color.ink, flexShrink: 1 },
  room: { fontSize: fontSize.sm, color: color.muted },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  dates: { fontSize: fontSize.sm, color: color.ink },
  amount: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: color.ink },
});
