// Host workspace stack — the mobile counterpart of the web's `(host)/host/layout.tsx`.
// One gate guards every screen beneath it: the session must exist and carry the
// server-issued OWNER capability. The backend re-enforces this on each request;
// this layout just keeps non-hosts from seeing owner chrome.

import { Stack, useRouter } from "expo-router";
import { View, StyleSheet } from "react-native";
import { color, fontWeight, spacing } from "@staynex/shared";
import { isOwner } from "@/core/capabilities";
import { useSession } from "@/core/session";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { EmptyState, LoadingState } from "@/ui/states";

export default function HostLayout() {
  const router = useRouter();
  const { user, status } = useSession();

  if (status !== "ready") {
    return (
      <Screen padded>
        <LoadingState label="Checking your session…" />
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen padded>
        <View style={styles.center}>
          <EmptyState
            title="Host workspace"
            message="Sign in with your host account to manage bookings and availability."
          />
          <Button
            label="Sign in"
            onPress={() =>
              router.push({ pathname: "/(auth)/login", params: { next: "/(tabs)/host" } })
            }
          />
        </View>
      </Screen>
    );
  }

  if (!isOwner(user)) {
    return (
      <Screen padded>
        <View style={styles.center}>
          <EmptyState
            title="Host workspace"
            message="This area is for property owners. List your property on staynex.com to get started."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.background },
        headerTintColor: color.ink,
        headerTitleStyle: { fontWeight: fontWeight.semibold },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: color.background },
      }}
    >
      <Stack.Screen name="bookings/[id]" options={{ title: "Booking" }} />
      <Stack.Screen name="scan" options={{ title: "Scan to check in" }} />
      <Stack.Screen name="verify/[reference]" options={{ title: "Verify booking" }} />
      <Stack.Screen name="availability" options={{ title: "Availability" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", gap: spacing.md },
});
