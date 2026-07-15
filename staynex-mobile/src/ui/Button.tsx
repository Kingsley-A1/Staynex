import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";

type Variant = "primary" | "secondary" | "danger";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Layout-only overrides (e.g. `flex: 1` in a row of actions). */
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  // Secondary and danger are both outline styles; only the accent differs.
  const outline = variant !== "primary";
  const accent = variant === "danger" ? color.error : color.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        outline
          ? [styles.outline, { borderColor: accent }]
          : styles.primary,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={outline ? accent : color.onPrimary} />
      ) : (
        <Text style={[styles.label, outline ? { color: accent } : styles.labelPrimary]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  primary: { backgroundColor: color.primary },
  outline: { backgroundColor: color.surface, borderWidth: 1 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  label: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  labelPrimary: { color: color.onPrimary },
});
