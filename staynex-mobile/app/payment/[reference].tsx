import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { PaymentState } from "@staynex/backend/types";
import { color, fontSize, fontWeight, spacing } from "@staynex/shared";
import { PAYMENT_STATE_LABELS, PAYMENT_STATE_TONE } from "@staynex/shared";
import { bookingApi } from "@/data/api";
import { apiErrorMessage } from "@/core/client";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { StatusPill } from "@/ui/StatusPill";

const TERMINAL: PaymentState[] = ["SUCCESS", "FAILED", "REFUNDED"];
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function PaymentStatusScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const reference = param(params.reference);
  const holdId = param(params.holdId);
  const slug = param(params.slug);

  const startRef = useRef(Date.now());
  const [timedOut, setTimedOut] = useState(false);

  const query = useQuery({
    queryKey: ["payment", reference],
    queryFn: () => bookingApi.paymentStatus(reference),
    enabled: Boolean(reference),
    refetchInterval: (q) => {
      const data = q.state.data;
      if (data && TERMINAL.includes(data.paymentStatus)) return false;
      if (Date.now() - startRef.current > POLL_TIMEOUT_MS) return false;
      return POLL_INTERVAL_MS;
    },
  });

  const status = query.data?.paymentStatus;
  const bookingId = query.data?.bookingId;

  // Stop polling after the timeout window and surface a timeout state.
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), POLL_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  // On verified success, move to confirmation. CONFIRMED is read, never set here.
  useEffect(() => {
    if (status === "SUCCESS" && bookingId) {
      router.replace({ pathname: "/booking/confirmation", params: { bookingId } });
    }
  }, [status, bookingId, router]);

  function retry() {
    if (holdId) {
      router.replace({ pathname: "/booking/checkout", params: { holdId, slug } });
    } else {
      router.replace("/(tabs)");
    }
  }

  // Initial load / network error before any status is known.
  if (query.isLoading) {
    return <Pending label="Confirming your payment…" />;
  }
  if (query.isError && !query.data) {
    return (
      <Screen padded>
        <View style={styles.center}>
          <Text style={styles.title}>Couldn&apos;t reach payment status</Text>
          <Text style={styles.muted}>{apiErrorMessage(query.error, "Network error.")}</Text>
          <Button label="Retry" onPress={() => query.refetch()} />
        </View>
      </Screen>
    );
  }

  if (status === "SUCCESS") {
    return <Pending label="Payment confirmed — opening your booking…" />;
  }

  if (status === "FAILED" || status === "REFUNDED") {
    return (
      <Screen padded>
        <View style={styles.center}>
          <StatusPill label={PAYMENT_STATE_LABELS[status]} tone={PAYMENT_STATE_TONE[status]} />
          <Text style={styles.title}>
            {status === "FAILED" ? "Payment failed" : "Payment refunded"}
          </Text>
          <Text style={styles.muted}>
            No booking was confirmed. You can go back and try again.
          </Text>
          <Button label="Go back and try again" onPress={retry} />
        </View>
      </Screen>
    );
  }

  if (timedOut) {
    return (
      <Screen padded>
        <View style={styles.center}>
          <Text style={styles.title}>Still pending</Text>
          <Text style={styles.muted}>
            We&apos;re not seeing a result yet. You can keep waiting or try again.
          </Text>
          <Button label="Keep checking" onPress={() => query.refetch()} />
          <Button label="Go back" variant="secondary" onPress={retry} />
        </View>
      </Screen>
    );
  }

  // INITIATED / PENDING — actively polling.
  return <Pending label={`${status ? PAYMENT_STATE_LABELS[status] : "Pending"} — confirming your payment…`} />;
}

function Pending({ label }: { label: string }) {
  return (
    <Screen padded>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={color.primary} />
        <Text style={styles.title}>Processing</Text>
        <Text style={styles.muted}>{label}</Text>
        <Text style={styles.note}>Keep this screen open. It updates automatically.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: color.ink, textAlign: "center" },
  muted: { fontSize: fontSize.sm, color: color.muted, textAlign: "center" },
  note: { fontSize: fontSize.xs, color: color.muted, textAlign: "center" },
});
