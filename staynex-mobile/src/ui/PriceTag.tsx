import { StyleSheet, Text, View } from "react-native";
import { color, fontSize, fontWeight } from "@staynex/shared";
import { formatKoboToNGN } from "@staynex/shared";

/**
 * Renders a kobo amount as NGN via the shared formatter. The ONLY price-display
 * primitive — screens never divide by 100 or write the currency symbol.
 */
export function PriceTag({
  kobo,
  suffix,
  size = "md",
}: {
  kobo: number | null;
  suffix?: string;
  size?: "md" | "lg";
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.amount, size === "lg" && styles.amountLg]}>
        {formatKoboToNGN(kobo)}
      </Text>
      {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  amount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: color.ink },
  amountLg: { fontSize: fontSize.xl },
  suffix: { fontSize: fontSize.xs, color: color.muted },
});
