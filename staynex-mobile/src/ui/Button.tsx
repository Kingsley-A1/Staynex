import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";

type Variant = "primary" | "secondary";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  const secondary = variant === "secondary";
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        secondary ? styles.secondary : styles.primary,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? color.primary : color.onPrimary} />
      ) : (
        <Text style={[styles.label, secondary ? styles.labelSecondary : styles.labelPrimary]}>
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
  secondary: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.primary },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  label: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  labelPrimary: { color: color.onPrimary },
  labelSecondary: { color: color.primary },
});
