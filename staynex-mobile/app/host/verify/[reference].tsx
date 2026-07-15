// Live booking verification — the native render of the web `/verify/[reference]`
// page a guest's QR points to. Same statuses, same tones, same copy: reception
// trusts this card because it reflects live server truth, never a screenshot.

import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { VoucherVerification } from "@staynex/backend/types";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";
import { voucherApi } from "@/data/api";
import { formatDateLabel } from "@/core/format";
import { Screen } from "@/ui/Screen";
import { ErrorState, LoadingState } from "@/ui/states";

type Status = VoucherVerification["status"];

// Mirrors the web page's TONE map — the copy is deliberately identical so a
// receptionist sees one consistent verdict regardless of which client renders it.
const TONE: Record<
  Status,
  { surface: string; border: string; text: string; icon: string; title: string; note: string }
> = {
  CONFIRMED: {
    surface: color.successSurface,
    border: color.successBorder,
    text: color.success,
    icon: "✓",
    title: "Valid booking",
    note: "Paid & confirmed on Staynex.",
  },
  PENDING: {
    surface: color.warningSurface,
    border: color.warningBorder,
    text: color.warning,
    icon: "…",
    title: "Payment pending",
    note: "Not confirmed yet — do not check the guest in on this alone.",
  },
  CANCELLED: {
    surface: color.errorSurface,
    border: color.errorBorder,
    text: color.error,
    icon: "✕",
    title: "Not valid",
    note: "This booking was cancelled or refunded.",
  },
  NOT_FOUND: {
    surface: color.errorSurface,
    border: color.errorBorder,
    text: color.error,
    icon: "✕",
    title: "No booking found",
    note: "We couldn't find a Staynex booking for this code.",
  },
};

export default function VerifyScreen() {
  const { reference } = useLocalSearchParams<{ reference: string }>();

  const verifyQuery = useQuery({
    queryKey: ["verify", reference],
    queryFn: () => voucherApi.verify(reference),
    enabled: Boolean(reference),
    // Check-in decisions need live truth — never a cached verdict.
    staleTime: 0,
    gcTime: 0,
  });

  if (verifyQuery.isLoading) {
    return (
      <Screen padded>
        <LoadingState label="Checking this booking…" />
      </Screen>
    );
  }
  if (verifyQuery.isError || !verifyQuery.data) {
    return (
      <Screen padded>
        <ErrorState
          title="Couldn't verify right now"
          message="We couldn't reach Staynex to check this booking. Check the connection and try again."
          onRetry={() => verifyQuery.refetch()}
        />
      </Screen>
    );
  }

  const v = verifyQuery.data;
  const tone = TONE[v.status];
  const showDetails = v.status !== "NOT_FOUND";

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.wordmark}>STAYNEX</Text>

        <View style={styles.card}>
          <View
            style={[styles.verdict, { backgroundColor: tone.surface, borderBottomColor: tone.border }]}
          >
            <View style={styles.iconWrap}>
              <Text style={[styles.icon, { color: tone.text }]}>{tone.icon}</Text>
            </View>
            <View style={styles.verdictText}>
              <Text style={[styles.verdictTitle, { color: tone.text }]}>{tone.title}</Text>
              <Text style={[styles.verdictNote, { color: tone.text }]}>{tone.note}</Text>
            </View>
          </View>

          {showDetails ? (
            <View style={styles.details}>
              {v.guestName || v.guestEmailMasked ? (
                <Row label="Guest" value={v.guestName ?? v.guestEmailMasked ?? "—"} />
              ) : null}
              {v.propertyName ? (
                <Row
                  label="Property"
                  value={[v.propertyName, v.areaName ?? v.cityName].filter(Boolean).join(" · ")}
                />
              ) : null}
              {v.roomTypeName ? (
                <Row
                  label="Room"
                  value={v.unitCode ? `${v.roomTypeName} · Unit ${v.unitCode}` : v.roomTypeName}
                />
              ) : null}
              {v.checkIn ? <Row label="Check-in" value={formatDateLabel(v.checkIn)} /> : null}
              {v.checkOut ? <Row label="Check-out" value={formatDateLabel(v.checkOut)} /> : null}
              {v.nights != null ? (
                <Row label="Nights" value={`${v.nights} night${v.nights === 1 ? "" : "s"}`} />
              ) : null}
              {v.guests ? (
                <Row
                  label="Guests"
                  value={`${v.guests.adults} adult${v.guests.adults === 1 ? "" : "s"}${
                    v.guests.children ? `, ${v.guests.children} child${v.guests.children === 1 ? "" : "ren"}` : ""
                  }${v.guests.infants ? `, ${v.guests.infants} infant${v.guests.infants === 1 ? "" : "s"}` : ""}`}
                />
              ) : null}
              <Row label="Reference" value={v.reference} last />
            </View>
          ) : null}
        </View>

        <Text style={styles.footnote}>Live status from Staynex records · not a screenshot.</Text>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  wordmark: {
    textAlign: "center",
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
    color: color.primary,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    overflow: "hidden",
  },
  verdict: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  verdictText: { flex: 1, gap: 2 },
  verdictTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  verdictNote: { fontSize: fontSize.sm, opacity: 0.9 },
  details: { paddingHorizontal: spacing.lg },
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
  rowValue: {
    fontSize: fontSize.sm,
    color: color.ink,
    fontWeight: fontWeight.medium,
    flexShrink: 1,
    textAlign: "right",
  },
  footnote: { textAlign: "center", fontSize: fontSize.xs, color: color.muted },
});
