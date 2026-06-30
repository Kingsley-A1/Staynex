import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";
import { useSession } from "@/core/session";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { LoadingState } from "@/ui/states";

export default function AccountScreen() {
  const router = useRouter();
  const { user, status, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  if (status !== "ready") {
    return (
      <Screen edges={["top"]} padded>
        <LoadingState label="Checking your session…" />
      </Screen>
    );
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Screen edges={["top"]} padded>
      <View style={styles.container}>
        <Text style={styles.heading}>Account</Text>

        {user ? (
          <>
            <View style={styles.card}>
              <Text style={styles.name}>{user.name ?? "Guest"}</Text>
              {user.email ? <Text style={styles.muted}>{user.email}</Text> : null}
            </View>
            <Text style={styles.hint}>
              My trips and reviews arrive in Phase 2.{/* Phase 2 — out of scope */}
            </Text>
            <Button
              label="Sign out"
              variant="secondary"
              loading={signingOut}
              onPress={handleSignOut}
            />
          </>
        ) : (
          <>
            <Text style={styles.muted}>
              Sign in to manage your bookings, or continue browsing and sign in at checkout.
            </Text>
            <View style={styles.actions}>
              <Button label="Sign in" onPress={() => router.push("/(auth)/login")} />
              <Button
                label="Create account"
                variant="secondary"
                onPress={() => router.push("/(auth)/register")}
              />
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  heading: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: color.ink },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: color.ink },
  muted: { fontSize: fontSize.sm, color: color.muted },
  hint: { fontSize: fontSize.xs, color: color.muted },
  actions: { gap: spacing.md },
});
