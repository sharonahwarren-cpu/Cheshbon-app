import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { authClient } from "@/lib/auth";

/**
 * Web OAuth popup page.
 * Opened by AuthContext.openOAuthPopup() in a small popup window.
 * Initiates the OAuth flow with the given provider and redirects to /auth-callback.
 */
export default function AuthPopupScreen() {
  const { provider } = useLocalSearchParams<{ provider: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const validProviders = ["google", "github", "apple"];
    if (!provider || !validProviders.includes(provider)) {
      const msg = `Invalid provider: ${provider}`;
      setError(msg);
      window.opener?.postMessage({ type: "oauth-error", error: msg }, "*");
      return;
    }

    console.log(`[AuthPopup] Starting OAuth for provider: ${provider}`);

    // Redirect to the OAuth provider via Better Auth.
    // After the user authenticates, Better Auth will redirect to /auth-callback
    // with the session token in the URL.
    authClient.signIn.social({
      provider: provider as "google" | "apple" | "github",
      callbackURL: `${window.location.origin}/auth-callback`,
    }).catch((err: any) => {
      console.error("[AuthPopup] OAuth error:", err);
      const msg = err?.message || "OAuth failed";
      setError(msg);
      window.opener?.postMessage({ type: "oauth-error", error: msg }, "*");
    });
  }, [provider]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorIcon}>✗</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

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
  errorIcon: {
    fontSize: 48,
    color: "#FF3B30",
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: "#FF3B30",
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
