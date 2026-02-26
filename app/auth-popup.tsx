import React, { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { authClient } from "@/lib/auth";

export default function AuthPopupScreen() {
  const { provider } = useLocalSearchParams<{ provider: string }>();

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const initiateOAuth = async () => {
      if (!provider || !["google", "github", "apple"].includes(provider)) {
        window.opener?.postMessage({ type: "oauth-error", error: "Invalid provider" }, window.location.origin);
        window.close();
        return;
      }

      try {
        console.log("[AuthPopup] Initiating OAuth for provider:", provider);
        // Import BACKEND_URL dynamically
        const { BACKEND_URL } = await import("@/utils/api");
        
        // The callbackURL is where Better Auth will redirect after OAuth completes.
        // Better Auth appends better_auth_token=<token> to this URL so the frontend can capture it.
        const callbackURL = `${window.location.origin}/auth-callback`;
        
        console.log("[AuthPopup] Callback URL:", callbackURL);
        console.log("[AuthPopup] Posting to Better Auth social sign-in endpoint...");
        
        // Better Auth's social sign-in endpoint accepts POST with JSON body
        // It returns a redirect URL in the response
        const response = await fetch(`${BACKEND_URL}/api/auth/sign-in/social`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            provider,
            callbackURL,
            errorCallbackURL: `${window.location.origin}/auth-callback?error=oauth_failed`,
          }),
        });

        console.log("[AuthPopup] OAuth response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[AuthPopup] OAuth initiation failed:", response.status, errorText);
          window.opener?.postMessage({ 
            type: "oauth-error", 
            error: `OAuth initiation failed (${response.status}): ${errorText}` 
          }, window.location.origin);
          window.close();
          return;
        }

        const data = await response.json();
        console.log("[AuthPopup] OAuth response data:", JSON.stringify(data));
        
        // Better Auth returns { url: "https://accounts.google.com/..." }
        const redirectUrl = data?.url || data?.redirectUrl || data?.redirect;
        if (redirectUrl) {
          console.log("[AuthPopup] Redirecting to OAuth provider:", redirectUrl);
          window.location.href = redirectUrl;
          return;
        }

        // If no redirect URL in response, try fallback GET method
        // Better Auth also supports GET for social sign-in
        console.log("[AuthPopup] No redirect URL in response, trying fallback GET method");
        const oauthURL = `${BACKEND_URL}/api/auth/sign-in/social?provider=${provider}&callbackURL=${encodeURIComponent(callbackURL)}`;
        console.log("[AuthPopup] Fallback redirect to:", oauthURL);
        window.location.href = oauthURL;
      } catch (error) {
        console.error("[AuthPopup] OAuth initiation failed:", error);
        window.opener?.postMessage({ type: "oauth-error", error: "Failed to initiate OAuth" }, window.location.origin);
        window.close();
      }
    };

    initiateOAuth();
  }, [provider]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.text}>Redirecting to sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    color: "#333",
  },
});
