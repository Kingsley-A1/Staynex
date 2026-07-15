import { Tabs } from "expo-router";
import { Text } from "react-native";
import { color, fontWeight } from "@staynex/shared";
import { isOwner } from "@/core/capabilities";
import { useSession } from "@/core/session";

// Simple text glyphs avoid pulling an icon font into the Phase 0/1 scaffold.
function TabGlyph({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, color: focused ? color.primary : color.muted }}>{glyph}</Text>
  );
}

export default function TabsLayout() {
  // Capability-gated navigation: the Host tab exists only when the server-issued
  // session says OWNER (`href: null` unregisters the tab). The backend enforces
  // the same capability on every /host request, so the tab is presentation only.
  const user = useSession((s) => s.user);
  const showHost = isOwner(user);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.muted,
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.border },
        tabBarLabelStyle: { fontWeight: fontWeight.medium },
        headerStyle: { backgroundColor: color.background },
        headerTintColor: color.ink,
        headerTitleStyle: { fontWeight: fontWeight.semibold },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Search",
          tabBarIcon: ({ focused }) => <TabGlyph glyph="⌕" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Trips",
          tabBarIcon: ({ focused }) => <TabGlyph glyph="⌂" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="host"
        options={{
          title: "Host",
          href: showHost ? undefined : null,
          tabBarIcon: ({ focused }) => <TabGlyph glyph="⌘" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: "Staynex AI",
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabGlyph glyph="✦" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ focused }) => <TabGlyph glyph="◉" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
