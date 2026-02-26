import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Platform } from "react-native";

type Status = "processing" | "success" | "error";

export default function AuthCallbackScreen() {
  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState("Processing authentication...");

  useEffect(() => {
    if (Platform.OS !== "web") return;
    handleCallback();
  }, []);

  const handleCallback = () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      // Better Auth may use different token parameter names
      const token =
        urlParams.get("better_auth_token") ||
        urlParams.get("token") ||
        urlParams.get("access_token");
      const error = urlParams.get("error");

      console.log("[AuthCallback] URL params:", window.location.search);
      console.log("[AuthCallback] Token found:", !!token, "Error:", error);

      if (error) {
        setStatus("error");
        setMessage(`Authentication failed: ${error}`);
        window.opener?.postMessage({ type: "oauth-error", error }, "*");
        return;
      }

      if (token) {
        setStatus("success");
        setMessage("Authentication successful! Closing...");
        window.opener?.postMessage({ type: "oauth-success", token }, "*");
        setTimeout(() => window.close(), 1000);
      } else {
        // No token in URL - the session may have been set via cookie
        // Signal success without a token so the parent can try fetching the session
        console.log("[AuthCallback] No token in URL, signaling cookie-based auth success");
        setStatus("success");
        setMessage("Authentication successful! Closing...");
        window.opener?.postMessage({ type: "oauth-success", token: "cookie-auth" }, "*");
        setTimeout(() => window.close(), 1000);
      }
    } catch (err) {
      setStatus("error");
      setMessage("Failed to process authentication");
      console.error("[AuthCallback] Auth callback error:", err);
    }
  };

  return (
    <View style={styles.container}>
      {status === "processing" && <ActivityIndicator size="large" color="#007AFF" />}
      {status === "success" && <Text style={styles.successIcon}>✓</Text>}
      {status === "error" && <Text style={styles.errorIcon}>✗</Text>}
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  successIcon: {
    fontSize: 48,
    color: "#34C759",
  },
  errorIcon: {
    fontSize: 48,
    color: "#FF3B30",
  },
  message: {
    fontSize: 18,
    marginTop: 20,
    textAlign: "center",
    color: "#333",
  },
});
