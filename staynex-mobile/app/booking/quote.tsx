import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";
import { formatKoboToNGN } from "@staynex/shared";
import { bookingApi, type BookingDatesInput } from "@/data/api";
import { apiErrorMessage } from "@/core/client";
import { formatDateLabel } from "@/core/format";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { ErrorState, LoadingState } from "@/ui/states";

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function QuoteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const slug = param(params.slug);

  const input: BookingDatesInput = {
    roomTypeId: param(params.roomTypeId),
    checkIn: param(params.checkIn),
    checkOut: param(params.checkOut),
    guests: Number(param(params.guests)) || 1,
  };

  const quoteQuery = useQuery({
    queryKey: ["quote", input],
    queryFn: () => bookingApi.quote(input),
    enabled: Boolean(input.roomTypeId && input.checkIn && input.checkOut),
  });

  const holdMutation = useMutation({
    mutationFn: () => bookingApi.createHold(input),
    onSuccess: (hold) => {
      router.replace({ pathname: "/booking/checkout", params: { holdId: hold.holdId, slug } });
    },
  });

  if (quoteQuery.isLoading) {
    return (
      <Screen padded>
        <LoadingState label="Checking price & availability…" />
      </Screen>
    );
  }
  if (quoteQuery.isError || !quoteQuery.data) {
    return (
      <Screen padded>
        <ErrorState
          message={apiErrorMessage(quoteQuery.error, "Couldn't price these dates.")}
          onRetry={() => quoteQuery.refetch()}
        />
      </Screen>
    );
  }

  const quote = quoteQuery.data;
  const soldOut = quote.available <= 0;

  return (
    <Screen padded>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.property}>{quote.propertyName}</Text>
          <Text style={styles.room}>{quote.roomName}</Text>

          <View style={styles.divider} />

          <Row label="Check in" value={formatDateLabel(quote.checkIn)} />
          <Row label="Check out" value={formatDateLabel(quote.checkOut)} />
          <Row
            label={`${formatKoboToNGN(quote.nightlyPriceKobo)} × ${quote.nights} night${quote.nights === 1 ? "" : "s"}`}
            value={formatKoboToNGN(quote.totalKobo)}
          />

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatKoboToNGN(quote.totalKobo)}</Text>
          </View>
          <Text style={styles.availability}>
            {soldOut
              ? "No rooms available for these dates."
              : `${quote.available} room${quote.available === 1 ? "" : "s"} available`}
          </Text>
        </View>

        {holdMutation.isError ? (
          <Text style={styles.error}>
            {apiErrorMessage(holdMutation.error, "Couldn't hold this room. Try again.")}
          </Text>
        ) : null}

        <Button
          label="Hold this room"
          onPress={() => holdMutation.mutate()}
          loading={holdMutation.isPending}
          disabled={soldOut}
        />
        <Text style={styles.note}>
          Holding locks the price for a short window. You&apos;ll sign in and pay next.
        </Text>
      </View>
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
  container: { gap: spacing.lg },
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
  rowLabel: { fontSize: fontSize.sm, color: color.muted, flexShrink: 1 },
  rowValue: { fontSize: fontSize.sm, color: color.ink, fontWeight: fontWeight.medium },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: color.ink },
  totalValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: color.ink },
  availability: { fontSize: fontSize.xs, color: color.muted, marginTop: spacing.xs },
  error: { fontSize: fontSize.sm, color: color.error },
  note: { fontSize: fontSize.xs, color: color.muted, textAlign: "center" },
});
