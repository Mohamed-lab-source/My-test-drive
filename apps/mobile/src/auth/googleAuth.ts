import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

// Required once per app so the in-app browser closes itself after Google
// redirects back, instead of leaving a blank tab open.
WebBrowser.maybeCompleteAuthSession();

// Google's "Web application" OAuth client type only accepts http(s) redirect
// URIs (not a custom app scheme like cookmate://), so we route through
// Expo's hosted auth proxy, which relays the redirect back into the app.
// This must be added as an Authorized redirect URI on the Google Cloud
// OAuth client — see README's "Google sign-in setup".
const GOOGLE_REDIRECT_URI = "https://auth.expo.io/@toukhys-team/cookmate";

export function useGoogleAuthRequest() {
  return Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    redirectUri: GOOGLE_REDIRECT_URI,
    responseType: "id_token",
    scopes: ["openid", "profile", "email"],
  });
}

export function isGoogleSignInConfigured(): boolean {
  return !!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
}
