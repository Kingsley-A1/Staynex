import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_TONE, formatKoboToNGN } from "@staynex/shared";
import { bookingApi } from "@/data/api";
import { apiErrorMessage } from "@/core/client";
import { formatDateLabel } from "@/core/format";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { StatusPill } from "@/ui/StatusPill";
import { ErrorState, LoadingState } from "@/ui/states";

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function ConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const bookingId = param(params.bookingId);

  const bookingQuery = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => bookingApi.getBooking(bookingId),
    enabled: Boolean(bookingId),
  });

  if (bookingQuery.isLoading) {
    return (
      <Screen padded>
        <LoadingState label="Loading your booking…" />
      </Screen>
    );
  }
  if (bookingQuery.isError || !bookingQuery.data) {
    return (
      <Screen padded>
        <ErrorState
          message={apiErrorMessage(bookingQuery.error, "Couldn't load your booking.")}
          onRetry={() => bookingQuery.refetch()}
        />
      </Screen>
    );
  }

  const booking = bookingQuery.data;

  return (
    <Screen padded>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.checkCircle}>
            <Text style={styles.check}>✓</Text>
          </View>
          <Text style={styles.title}>You&apos;re booked</Text>
          <StatusPill
            label={BOOKING_STATUS_LABELS[booking.status]}
            tone={BOOKING_STATUS_TONE[booking.status]}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.property}>{booking.propertyName}</Text>
          <Text style={styles.room}>
            {booking.roomName} · {booking.cityName}
          </Text>
          <View style={styles.divider} />
          <Row label="Check in" value={formatDateLabel(booking.checkIn)} />
          <Row label="Check out" value={formatDateLabel(booking.checkOut)} />
          <Row
            label={`${booking.nights} night${booking.nights === 1 ? "" : "s"}`}
            value=""
          />
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total paid</Text>
            <Text style={styles.totalValue}>{formatKoboToNGN(booking.amountKobo)}</Text>
          </View>
          {booking.paymentReference ? (
            <Text style={styles.reference}>Ref: {booking.paymentReference}</Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button label="Done" onPress={() => router.replace("/(tabs)")} />
          <Button
            label="View trips"
            variant="secondary"
            disabled
            onPress={() => undefined /* Phase 2 — out of scope */}
          />
        </View>
        <Text style={styles.note}>My trips arrives in Phase 2.{/* Phase 2 — out of scope */}</Text>
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  hero: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: color.success,
    alignItems: "center",
    justifyContent: "center",
  },
  check: { color: color.onPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: color.ink },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  property: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: color.ink },
  room: { fontSize: fontSize.sm, color: color.muted },
  divider: { height: 1, backgroundColor: color.border, marginVertical: spacing.sm },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  rowLabel: { fontSize: fontSize.sm, color: color.muted },
  rowValue: { fontSize: fontSize.sm, color: color.ink, fontWeight: fontWeight.medium },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: color.ink },
  totalValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: color.ink },
  reference: { fontSize: fontSize.xs, color: color.muted, marginTop: spacing.xs },
  actions: { gap: spacing.md },
  note: { fontSize: fontSize.xs, color: color.muted, textAlign: "center" },
});
