import { Tabs } from "expo-router";
import { Text } from "react-native";
import { color, fontWeight } from "@staynex/shared";

// Simple text glyphs avoid pulling an icon font into the Phase 0/1 scaffold.
function TabGlyph({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, color: focused ? color.primary : color.muted }}>{glyph}</Text>
  );
}

export default function TabsLayout() {
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
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ focused }) => <TabGlyph glyph="◉" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
