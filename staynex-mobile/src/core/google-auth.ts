// Google sign-in via expo-auth-session (JS-only — no native module, works in
// Expo Go and dev clients). The flow yields a Google ID token; the backend's
// existing POST /auth/google verifies it (aud must match GOOGLE_CLIENT_ID) and
// starts the same cookie session as password auth. No Google tokens are stored.

import { useEffect } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { GOOGLE_CLIENT_ID } from "./env";

WebBrowser.maybeCompleteAuthSession();

export function useGoogleSignIn(onIdToken: (idToken: string) => void) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    // The hook requires a client id at init; gate `ready` on the real one.
    clientId: GOOGLE_CLIENT_ID ?? "unconfigured.apps.googleusercontent.com",
  });

  useEffect(() => {
    if (response?.type === "success") {
      const idToken = (response.params as { id_token?: string }).id_token;
      if (idToken) onIdToken(idToken);
    }
  }, [response, onIdToken]);

  return {
    /** False until GOOGLE_CLIENT_ID is configured and the request is built. */
    ready: Boolean(GOOGLE_CLIENT_ID) && Boolean(request),
    prompt: () => promptAsync(),
  };
}
