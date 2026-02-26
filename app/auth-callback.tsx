import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Platform } from "react-native";

type Status = "processing" | "success" | "error";

/**
 * Web OAuth callback page.
 * This page is opened inside the popup window (from auth-popup.tsx).
 * After Better Auth completes the OAuth flow it redirects here with a token.
 * We extract the token and post it back to the opener window, then close.
 */
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

      // Better Auth may use different parameter names
      const token =
        urlParams.get("token") ||
        urlParams.get("better_auth_token") ||
        urlParams.get("session_token");

      const error =
        urlParams.get("error") || urlParams.get("error_description");

      console.log("[AuthCallback] URL:", window.location.href);
      console.log("[AuthCallback] Token present:", !!token);
      console.log("[AuthCallback] Error:", error);

      if (error) {
        setStatus("error");
        setMessage(`Authentication failed: ${error}`);
        if (window.opener) {
          window.opener.postMessage({ type: "oauth-error", error }, "*");
        }
        return;
      }

      if (token) {
        setStatus("success");
        setMessage("Authentication successful! Closing...");
        console.log("[AuthCallback] Sending token to opener...");
        if (window.opener) {
          window.opener.postMessage({ type: "oauth-success", token }, "*");
          setTimeout(() => window.close(), 1000);
        } else {
          // No opener - this might be a direct navigation (not a popup)
          // Store the token and redirect to home
          try {
            localStorage.setItem("cheshbon_bearer_token", token);
          } catch {}
          setTimeout(() => {
            window.location.href = "/";
          }, 1000);
        }
      } else {
        // No token in query params - check if Better Auth set a cookie session
        // In this case we can just close the popup and let the parent refresh
        console.log("[AuthCallback] No token in URL, checking for session cookie...");
        setStatus("success");
        setMessage("Authentication complete! Closing...");
        if (window.opener) {
          // Signal success without a token - parent will call getSession()
          window.opener.postMessage({ type: "oauth-success-cookie" }, "*");
          setTimeout(() => window.close(), 1000);
        } else {
          setTimeout(() => {
            window.location.href = "/";
          }, 1000);
        }
      }
    } catch (err) {
      setStatus("error");
      setMessage("Failed to process authentication");
      console.error("[AuthCallback] Error:", err);
      if (window.opener) {
        window.opener.postMessage(
          { type: "oauth-error", error: "Processing failed" },
          "*"
        );
      }
    }
  };

  return (
    <View style={styles.container}>
      {status === "processing" && (
        <ActivityIndicator size="large" color="#007AFF" />
      )}
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
