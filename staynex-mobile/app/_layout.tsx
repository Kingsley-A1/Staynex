import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { color, fontWeight } from "@staynex/shared";
import { refreshPushRegistrationIfGranted, routeForPushLink } from "@/core/push";
import { useSession } from "@/core/session";

// Foreground notifications show as a banner instead of being swallowed.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const router = useRouter();
  const hydrate = useSession((s) => s.hydrate);
  const user = useSession((s) => s.user);

  // Restore the session from the persisted cookie on cold start (criterion h).
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Keep the backend's push token current once signed in (never prompts).
  useEffect(() => {
    if (user) void refreshPushRegistrationIfGranted();
  }, [user]);

  // A tapped push deep-links via its `data.link`; the inbox is the fallback.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const link = response.notification.request.content.data?.link;
      const target = routeForPushLink(typeof link === "string" ? link : undefined);
      router.push({ pathname: target.pathname as never, params: target.params });
    });
    return () => sub.remove();
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="dark" backgroundColor={color.background} />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: color.background },
              headerTintColor: color.ink,
              headerTitleStyle: { fontWeight: fontWeight.semibold },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: color.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="stays/[slug]" options={{ title: "Stay" }} />
            <Stack.Screen name="trips/[id]" options={{ title: "Trip" }} />
            <Stack.Screen name="account/profile" options={{ title: "Edit profile" }} />
            <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
            <Stack.Screen name="assistant/history" options={{ title: "Conversations" }} />
            <Stack.Screen name="booking/quote" options={{ title: "Review dates" }} />
            <Stack.Screen name="booking/checkout" options={{ title: "Checkout" }} />
            <Stack.Screen
              name="booking/confirmation"
              options={{ title: "Booking confirmed", headerBackVisible: false }}
            />
            <Stack.Screen name="payment/[reference]" options={{ title: "Payment", headerBackVisible: false }} />
            <Stack.Screen name="(auth)/login" options={{ title: "Sign in", presentation: "modal" }} />
            <Stack.Screen name="(auth)/register" options={{ title: "Create account", presentation: "modal" }} />
          </Stack>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
