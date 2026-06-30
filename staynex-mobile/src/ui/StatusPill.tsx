import { StyleSheet, Text, View } from "react-native";
import { color, fontSize, fontWeight, radius, type StatusTone } from "@staynex/shared";

const TONE_COLOR: Record<StatusTone, string> = {
  neutral: color.muted,
  success: color.success,
  warning: color.warning,
  error: color.error,
};

/**
 * Presentational status badge. Callers resolve a status to a `label` + `tone`
 * using the shared maps (`*_LABELS` / `*_TONE`), so this stays decoupled from the
 * API contract enums.
 */
export function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  const tint = TONE_COLOR[tone];
  return (
    <View style={[styles.pill, { borderColor: tint }]}>
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  label: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
});
