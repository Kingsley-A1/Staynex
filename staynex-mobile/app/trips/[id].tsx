import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
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
import { API_BASE_URL } from "@/core/env";
import { formatDateLabel } from "@/core/format";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { StatusPill } from "@/ui/StatusPill";
import { ErrorState, LoadingState } from "@/ui/states";

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function TripDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = param(params.id);

  const tripQuery = useQuery({
    queryKey: ["booking", id],
    queryFn: () => bookingApi.getBooking(id),
    enabled: Boolean(id),
  });

  if (tripQuery.isLoading) {
    return (
      <Screen padded>
        <LoadingState label="Loading your trip…" />
      </Screen>
    );
  }
  if (tripQuery.isError || !tripQuery.data) {
    return (
      <Screen padded>
        <ErrorState
          message={apiErrorMessage(tripQuery.error, "Couldn't load this trip.")}
          onRetry={() => tripQuery.refetch()}
        />
      </Screen>
    );
  }

  const trip = tripQuery.data;
  const guests =
    `${trip.adults} adult${trip.adults === 1 ? "" : "s"}` +
    (trip.children ? `, ${trip.children} child${trip.children === 1 ? "" : "ren"}` : "") +
    (trip.infants ? `, ${trip.infants} infant${trip.infants === 1 ? "" : "s"}` : "");
  const hasReceipt = trip.status === "CONFIRMED" && Boolean(trip.paymentReference);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.property}>{trip.propertyName}</Text>
            <StatusPill
              label={BOOKING_STATUS_LABELS[trip.status]}
              tone={BOOKING_STATUS_TONE[trip.status]}
            />
          </View>
          <Text style={styles.room}>
            {trip.roomName} · {trip.cityName}
            {trip.unitCode ? ` · Unit ${trip.unitCode}` : ""}
          </Text>
          <View style={styles.divider} />
          <Row label="Check in" value={formatDateLabel(trip.checkIn)} />
          <Row label="Check out" value={formatDateLabel(trip.checkOut)} />
          <Row label="Nights" value={String(trip.nights)} />
          <Row label="Guests" value={guests} />
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {trip.status === "CONFIRMED" ? "Total paid" : "Total"}
            </Text>
            <Text style={styles.totalValue}>{formatKoboToNGN(trip.amountKobo)}</Text>
          </View>
          {trip.paymentReference ? (
            <Text style={styles.reference}>Ref: {trip.paymentReference}</Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          {hasReceipt ? (
            <Button
              label="View receipt & check-in QR (PDF)"
              onPress={() =>
                // The canonical Booking Confirmation & Receipt (QR embedded).
                // Served only while the booking is paid + confirmed.
                WebBrowser.openBrowserAsync(
                  `${API_BASE_URL}/vouchers/${trip.paymentReference}/pdf`,
                )
              }
            />
          ) : null}
          <Button
            label="Book this stay again"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: "/stays/[slug]", params: { slug: trip.propertySlug } })
            }
          />
        </View>
        {hasReceipt ? (
          <Text style={styles.note}>
            Show the QR on your receipt at reception — it verifies against live
            booking truth.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  property: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: color.ink, flexShrink: 1 },
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
