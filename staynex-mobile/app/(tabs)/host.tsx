// Host tab — the mobile mirror of the web `/host/bookings` dashboard page:
// the same KPI strip, the same booking rows, backed by the same owner-scoped
// endpoint. Adds the two on-the-go actions this phase ships: scan-to-check-in
// and availability quick actions.

import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { BookingRow } from "@staynex/backend/types";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TONE,
  PAYMENT_STATE_LABELS,
  PAYMENT_STATE_TONE,
  color,
  fontSize,
  fontWeight,
  formatKoboToNGN,
  radius,
  spacing,
} from "@staynex/shared";
import { hostApi } from "@/data/api";
import { apiErrorMessage } from "@/core/client";
import { isOwner } from "@/core/capabilities";
import { formatDateLabel } from "@/core/format";
import { useSession } from "@/core/session";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { StatusPill } from "@/ui/StatusPill";
import { EmptyState, ErrorState, LoadingState } from "@/ui/states";

export default function HostScreen() {
  const router = useRouter();
  const { user, status } = useSession();
  const owner = isOwner(user);

  const bookingsQuery = useQuery({
    queryKey: ["host-bookings", user?.id],
    queryFn: hostApi.bookings,
    enabled: owner,
  });

  if (status !== "ready") {
    return (
      <Screen edges={["top"]} padded>
        <LoadingState label="Checking your session…" />
      </Screen>
    );
  }

  // The tab is hidden for non-owners; this covers direct navigation anyway.
  if (!user || !owner) {
    return (
      <Screen edges={["top"]} padded>
        <View style={styles.center}>
          <EmptyState
            title="Host workspace"
            message="This area is for property owners. List your property on staynex.com to get started."
          />
        </View>
      </Screen>
    );
  }

  if (bookingsQuery.isLoading) {
    return (
      <Screen edges={["top"]} padded>
        <LoadingState label="Loading your bookings…" />
      </Screen>
    );
  }
  if (bookingsQuery.isError || !bookingsQuery.data) {
    return (
      <Screen edges={["top"]} padded>
        <ErrorState
          message={apiErrorMessage(bookingsQuery.error, "Couldn't load your host dashboard.")}
          onRetry={() => bookingsQuery.refetch()}
        />
      </Screen>
    );
  }

  const { kpis, bookings } = bookingsQuery.data;

  return (
    <Screen edges={["top"]}>
      <FlatList
        data={bookings}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.listContent}
        refreshing={bookingsQuery.isRefetching}
        onRefresh={() => bookingsQuery.refetch()}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.kpiGrid}>
              <Kpi label="Confirmed bookings" value={String(kpis.confirmedBookings)} />
              <Kpi label="Pending payments" value={String(kpis.pendingPayments)} />
              <Kpi
                label="Net earnings"
                value={formatKoboToNGN(kpis.netEarningsKobo)}
                hint="Paid, after platform fee"
              />
              <Kpi
                label="Pending payout"
                value={formatKoboToNGN(kpis.pendingPayoutKobo)}
                hint="Awaiting settlement"
              />
            </View>
            <View style={styles.actions}>
              <Button
                label="Scan to check in"
                onPress={() => router.push("/host/scan")}
                style={styles.action}
              />
              <Button
                label="Availability"
                variant="secondary"
                onPress={() => router.push("/host/availability")}
                style={styles.action}
              />
            </View>
            <Text style={styles.sectionTitle}>Recent bookings</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No bookings yet"
            message="Once guests pay, confirmed stays appear here."
          />
        }
        renderItem={({ item }) => (
          <HostBookingCard
            booking={item}
            onPress={() => router.push({ pathname: "/host/bookings/[id]", params: { id: item.id } })}
          />
        )}
      />
    </Screen>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? <Text style={styles.kpiHint}>{hint}</Text> : null}
    </View>
  );
}

function HostBookingCard({ booking, onPress }: { booking: BookingRow; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Text style={styles.property} numberOfLines={1}>
        {booking.propertyName} · {booking.roomName}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {formatDateLabel(booking.checkIn)} → {formatDateLabel(booking.checkOut)} ·{" "}
        {booking.nights} night{booking.nights === 1 ? "" : "s"}
        {booking.guestEmail ? ` · ${booking.guestEmail}` : ""}
      </Text>
      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.payout}>{formatKoboToNGN(booking.ownerPayoutKobo)}</Text>
          <Text style={styles.gross}>{formatKoboToNGN(booking.grossAmountKobo)} gross</Text>
        </View>
        <View style={styles.pills}>
          <StatusPill
            label={BOOKING_STATUS_LABELS[booking.status]}
            tone={BOOKING_STATUS_TONE[booking.status]}
          />
          <StatusPill
            label={PAYMENT_STATE_LABELS[booking.paymentStatus]}
            tone={PAYMENT_STATE_TONE[booking.paymentStatus]}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  center: { flex: 1, justifyContent: "center" },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  kpi: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.md,
    gap: 2,
  },
  kpiLabel: { fontSize: fontSize.xs, color: color.muted },
  kpiValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: color.ink },
  kpiHint: { fontSize: fontSize.xs, color: color.muted },
  actions: { flexDirection: "row", gap: spacing.md },
  action: { flex: 1 },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: color.ink,
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
  property: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: color.ink },
  meta: { fontSize: fontSize.sm, color: color.muted },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: spacing.xs,
  },
  payout: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: color.ink },
  gross: { fontSize: fontSize.xs, color: color.muted },
  pills: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap", justifyContent: "flex-end" },
});
