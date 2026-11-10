import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";
import { formatKoboToNGN } from "@staynex/shared";
import { bookingApi } from "@/data/api";
import { apiErrorMessage } from "@/core/client";
import { formatDateLabel } from "@/core/format";
import { useSession } from "@/core/session";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { ErrorState, LoadingState } from "@/ui/states";

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const holdId = param(params.holdId);
  const slug = param(params.slug);
  const user = useSession((s) => s.user);

  const holdQuery = useQuery({
    queryKey: ["hold", holdId],
    queryFn: () => bookingApi.getHold(holdId),
    enabled: Boolean(holdId),
  });

  const checkoutMutation = useMutation({
    mutationFn: async (email: string) => {
      const result = await bookingApi.checkout({ holdId, email });
      // Paystack hosted flow — the only card-data surface. We open it, then poll
      // payment status on return (no client-side confirmation).
      await WebBrowser.openAuthSessionAsync(result.authorizationUrl, Linking.createURL("payment"));
      return result;
    },
    onSuccess: (result) => {
      router.replace({
        pathname: "/payment/[reference]",
        params: { reference: result.reference, bookingId: result.bookingId, holdId, slug },
      });
    },
  });

  if (holdQuery.isLoading) {
    return (
      <Screen padded>
        <LoadingState label="Loading your hold…" />
      </Screen>
    );
  }
  if (holdQuery.isError || !holdQuery.data) {
    return (
      <Screen padded>
        <ErrorState
          message={apiErrorMessage(holdQuery.error, "Couldn't load this hold.")}
          onRetry={() => holdQuery.refetch()}
        />
      </Screen>
    );
  }

  const hold = holdQuery.data;

  // Constraint 9 / criterion (b): an expired hold stops the checkout path and
  // routes back to re-quote. No booking is created for an expired hold.
  if (hold.expired) {
    return (
      <Screen padded>
        <View style={styles.center}>
          <Text style={styles.expiredTitle}>This hold has expired</Text>
          <Text style={styles.muted}>
            Holds are short-lived to keep availability accurate. Re-check your dates to continue.
          </Text>
          <Button
            label="Re-check dates"
            onPress={() =>
              slug
                ? router.replace({ pathname: "/stays/[slug]", params: { slug } })
                : router.replace("/(tabs)")
            }
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.property}>{hold.propertyName}</Text>
          <Text style={styles.room}>{hold.roomName}</Text>
          <View style={styles.divider} />
          <Row label="Check in" value={formatDateLabel(hold.checkIn)} />
          <Row label="Check out" value={formatDateLabel(hold.checkOut)} />
          <Row
            label={`${formatKoboToNGN(hold.nightlyPriceKobo)} × ${hold.nights} night${hold.nights === 1 ? "" : "s"}`}
            value={formatKoboToNGN(hold.totalKobo)}
          />
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total to pay</Text>
            <Text style={styles.totalValue}>{formatKoboToNGN(hold.totalKobo)}</Text>
          </View>
        </View>

        <Countdown expiresAt={hold.expiresAt} onExpire={() => holdQuery.refetch()} />

        {checkoutMutation.isError ? (
          <Text style={styles.error}>
            {apiErrorMessage(checkoutMutation.error, "Couldn't start payment. Try again.")}
          </Text>
        ) : null}

        {user ? (
          user.email ? (
            <Button
              label={`Pay ${formatKoboToNGN(hold.totalKobo)} with Paystack`}
              loading={checkoutMutation.isPending}
              onPress={() => checkoutMutation.mutate(user.email as string)}
            />
          ) : (
            <Text style={styles.error}>
              Your account has no email on file. Add one before paying.
            </Text>
          )
        ) : (
          <>
            <Text style={styles.muted}>Sign in or create an account to pay securely.</Text>
            <Button
              label="Sign in to pay"
              onPress={() =>
                router.push({
                  pathname: "/(auth)/login",
                  params: { next: "/booking/checkout", holdId, slug },
                })
              }
            />
            <Button
              label="Create an account"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/(auth)/register",
                  params: { next: "/booking/checkout", holdId, slug },
                })
              }
            />
          </>
        )}
        <Text style={styles.note}>
          Payment is processed by Paystack. Staynex never sees your card details.
        </Text>
      </View>
    </Screen>
  );
}

function Countdown({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(() => secondsUntil(expiresAt));

  useEffect(() => {
    const id = setInterval(() => {
      const next = secondsUntil(expiresAt);
      setRemaining(next);
      if (next <= 0) {
        clearInterval(id);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  if (remaining <= 0) {
    return <Text style={styles.countdownExpired}>Hold expired — re-checking…</Text>;
  }
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <Text style={styles.countdown}>
      Held for {mins}:{`${secs}`.padStart(2, "0")} — complete payment before it expires.
    </Text>
  );
}

function secondsUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
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
  countdown: { fontSize: fontSize.sm, color: color.warning, textAlign: "center", fontWeight: fontWeight.medium },
  countdownExpired: { fontSize: fontSize.sm, color: color.error, textAlign: "center" },
  expiredTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: color.ink, textAlign: "center" },
  muted: { fontSize: fontSize.sm, color: color.muted, textAlign: "center" },
  error: { fontSize: fontSize.sm, color: color.error, textAlign: "center" },
  note: { fontSize: fontSize.xs, color: color.muted, textAlign: "center" },
});
