import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";
import { authApi } from "@/data/api";
import { apiErrorMessage, clearSessionCookie } from "@/core/client";
import { unregisterPush } from "@/core/push";
import { useSession } from "@/core/session";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { LoadingState } from "@/ui/states";

export default function AccountScreen() {
  const router = useRouter();
  const { user, status, signOut, setUser } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  const revokeMutation = useMutation({
    mutationFn: authApi.revokeOtherSessions,
    onSuccess: () => Alert.alert("Done", "Every other device has been signed out."),
    onError: (err) =>
      Alert.alert("Couldn't sign out other devices", apiErrorMessage(err, "Try again.")),
  });

  const deleteMutation = useMutation({
    mutationFn: authApi.deleteAccount,
    onSuccess: async () => {
      await clearSessionCookie();
      setUser(null);
      router.replace("/(tabs)");
    },
    onError: (err) =>
      Alert.alert(
        "Couldn't delete your account",
        apiErrorMessage(err, "Try again or contact support."),
      ),
  });

  function confirmDelete() {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your Staynex account. Confirmed bookings and their receipts remain valid records, but you'll lose access to them here.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  }

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
      // Deregister the push token first — it needs the session to still exist.
      await unregisterPush();
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
              {user.phone ? <Text style={styles.muted}>{user.phone}</Text> : null}
            </View>

            <View style={styles.actions}>
              <Button
                label="Notifications"
                variant="secondary"
                onPress={() => router.push("/notifications")}
              />
              <Button
                label="Edit profile"
                variant="secondary"
                onPress={() => router.push("/account/profile")}
              />
              <Button
                label="Sign out other devices"
                variant="secondary"
                loading={revokeMutation.isPending}
                onPress={() => revokeMutation.mutate()}
              />
              <Button
                label="Sign out"
                variant="secondary"
                loading={signingOut}
                onPress={handleSignOut}
              />
              <Button
                label="Delete account"
                variant="danger"
                loading={deleteMutation.isPending}
                onPress={confirmDelete}
              />
            </View>
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
  actions: { gap: spacing.md },
});
