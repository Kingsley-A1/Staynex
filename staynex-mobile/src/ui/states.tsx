// The three states every screen must handle (loading / empty / error). Centralized
// so no screen ever renders blank on a slow network, no results, or an API failure.

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={color.primary} size="large" />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message?: string;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.muted}>{message}</Text> : null}
    </View>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.muted}>{message}</Text> : null}
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <Text style={styles.retryLabel}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: color.ink,
    textAlign: "center",
  },
  muted: {
    fontSize: fontSize.sm,
    color: color.muted,
    textAlign: "center",
  },
  retry: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.primary,
  },
  pressed: { opacity: 0.6 },
  retryLabel: {
    color: color.primary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
  },
});
