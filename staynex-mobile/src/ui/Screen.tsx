import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { color } from "@staynex/shared";

/** Branded screen container with a safe-area inset and the app background. */
export function Screen({
  children,
  edges = ["bottom"],
  padded = false,
}: {
  children: ReactNode;
  edges?: Edge[];
  padded?: boolean;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View style={[styles.inner, padded && styles.padded]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.background },
  inner: { flex: 1 },
  padded: { padding: 16 },
});
