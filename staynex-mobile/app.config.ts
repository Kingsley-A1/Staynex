// Expo app config. All environment-specific values are sourced from EAS env /
// process.env at build/start time — never hardcoded (skill.md "No hardcoding").
//
//   STAYNEX_API_BASE_URL  required — root of the NestJS API (no trailing slash)
//   GOOGLE_CLIENT_ID      optional — Google sign-in (Phase 2)
//   EAS_PROJECT_ID        optional — set by `eas init`
//
// Local dev example:
//   STAYNEX_API_BASE_URL=http://10.0.2.2:8080 npx expo start   (Android emulator)
//   STAYNEX_API_BASE_URL=http://localhost:8080 npx expo start  (iOS simulator)

import type { ExpoConfig } from "expo/config";

const apiBaseUrl = process.env.STAYNEX_API_BASE_URL ?? "";
const googleClientId = process.env.GOOGLE_CLIENT_ID ?? null;
const easProjectId = process.env.EAS_PROJECT_ID ?? null;

const config: ExpoConfig = {
  name: "Staynex",
  slug: "staynex",
  version: "0.1.0",
  scheme: "staynex",
  orientation: "portrait",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  backgroundColor: "#F7F7FF",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.staynex.app",
  },
  android: {
    package: "com.staynex.app",
    adaptiveIcon: {
      backgroundColor: "#27187D",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    "expo-font",
  ],
  extra: {
    apiBaseUrl,
    googleClientId,
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
  },
};

export default config;
