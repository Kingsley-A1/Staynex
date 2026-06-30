import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { color, fontWeight } from "@staynex/shared";
import { useSession } from "@/core/session";

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
  const hydrate = useSession((s) => s.hydrate);

  // Restore the session from the persisted cookie on cold start (criterion h).
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

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
