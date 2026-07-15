// Host booking detail — the mobile mirror of web `/host/bookings/[id]`:
// same status pills, the same "Verified booking" check-in card (opening the
// same live verify card the guest's QR points to), the same detail rows and
// settlement math — all rendered from the server's BookingRow, never derived.

import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TONE,
  PAYMENT_STATE_LABELS,
  PAYMENT_STATE_TONE,
  PAYOUT_STATUS_LABELS,
  PAYOUT_STATUS_TONE,
  color,
  fontSize,
  fontWeight,
  formatKoboToNGN,
  radius,
  spacing,
} from "@staynex/shared";
import { hostApi } from "@/data/api";
import { apiErrorMessage } from "@/core/client";
import { formatDateLabel } from "@/core/format";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { StatusPill } from "@/ui/StatusPill";
import { ErrorState, LoadingState } from "@/ui/states";

export default function HostBookingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const bookingQuery = useQuery({
    queryKey: ["host-booking", id],
    queryFn: () => hostApi.booking(id),
    enabled: Boolean(id),
  });

  if (bookingQuery.isLoading) {
    return (
      <Screen padded>
        <LoadingState label="Loading booking…" />
      </Screen>
    );
  }
  if (bookingQuery.isError || !bookingQuery.data) {
    return (
      <Screen padded>
        <ErrorState
          message={apiErrorMessage(
            bookingQuery.error,
            "This booking wasn't found in your properties.",
          )}
          onRetry={() => bookingQuery.refetch()}
        />
      </Screen>
    );
  }

  const booking = bookingQuery.data;
  // Same rule as the web page: "verified" means paid AND confirmed — both from
  // the server. There is no client-side promotion of either state.
  const verified = booking.status === "CONFIRMED" && booking.paymentStatus === "SUCCESS";

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{booking.propertyName}</Text>
        <View style={styles.pills}>
          <StatusPill
            label={BOOKING_STATUS_LABELS[booking.status]}
            tone={BOOKING_STATUS_TONE[booking.status]}
          />
          <StatusPill
            label={PAYMENT_STATE_LABELS[booking.paymentStatus]}
            tone={PAYMENT_STATE_TONE[booking.paymentStatus]}
          />
          {verified ? <StatusPill label="✓ Verified" tone="success" /> : null}
        </View>

        {verified && booking.paymentReference ? (
          <View style={styles.verifyCard}>
            <Text style={styles.verifyTitle}>Verified booking</Text>
            <Text style={styles.verifyNote}>
              Payment is confirmed on Staynex. Open the live card to check the guest in — it's
              the same one the guest's QR opens.
            </Text>
            <Button
              label="Open verification"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/host/verify/[reference]",
                  params: { reference: booking.paymentReference as string },
                })
              }
            />
          </View>
        ) : null}

        <View style={styles.card}>
          <Row label="Room" value={booking.roomName} />
          <Row label="City" value={booking.cityName} />
          <Row
            label="Dates"
            value={`${formatDateLabel(booking.checkIn)} → ${formatDateLabel(booking.checkOut)} (${booking.nights} night${booking.nights === 1 ? "" : "s"})`}
          />
          <Row
            label="Guests"
            value={`${booking.adults} adult${booking.adults === 1 ? "" : "s"}${
              booking.children ? `, ${booking.children} child${booking.children === 1 ? "" : "ren"}` : ""
            }${booking.infants ? `, ${booking.infants} infant${booking.infants === 1 ? "" : "s"}` : ""}`}
          />
          <Row label="Guest" value={booking.guestEmail ?? "—"} />
          <Row label="Reference" value={booking.paymentReference ?? "—"} />
          <Row label="Created" value={formatDateLabel(booking.createdAt)} last />
        </View>

        <Text style={styles.sectionTitle}>Settlement</Text>
        <View style={styles.card}>
          <Row label="Guest paid (gross)" value={formatKoboToNGN(booking.grossAmountKobo)} />
          <Row label="Platform fee" value={`− ${formatKoboToNGN(booking.platformFeeKobo)}`} />
          <Row label="Your payout" value={formatKoboToNGN(booking.ownerPayoutKobo)} strong />
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.rowLabel}>Payout status</Text>
            {booking.payoutStatus ? (
              <StatusPill
                label={PAYOUT_STATUS_LABELS[booking.payoutStatus]}
                tone={PAYOUT_STATUS_TONE[booking.payoutStatus]}
              />
            ) : (
              <Text style={styles.rowValue}>—</Text>
            )}
          </View>
        </View>
        <Text style={styles.footnote}>
          Payouts are settled after check-in. Net of the Staynex platform fee.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Row({
  label,
  value,
  strong = false,
  last = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={[styles.rowLabel, strong && styles.rowLabelStrong]}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: color.ink },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  verifyCard: {
    backgroundColor: color.successSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.successBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  verifyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: color.success },
  verifyNote: { fontSize: fontSize.sm, color: color.ink },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: color.ink,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: fontSize.sm, color: color.muted, flexShrink: 0 },
  rowLabelStrong: { color: color.ink, fontWeight: fontWeight.semibold },
  rowValue: {
    fontSize: fontSize.sm,
    color: color.ink,
    fontWeight: fontWeight.medium,
    flexShrink: 1,
    textAlign: "right",
  },
  rowValueStrong: { fontWeight: fontWeight.bold },
  footnote: { fontSize: fontSize.xs, color: color.muted },
});
