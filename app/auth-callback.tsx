
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Platform } from "react-native";
import { authClient, setBearerToken, API_URL } from "@/lib/auth";

type Status = "processing" | "success" | "error";

/**
 * Web OAuth callback page.
 * This page is opened inside the popup window (from auth-popup.tsx).
 * After Better Auth completes the OAuth flow it redirects here with a token.
 * We extract the token, establish the session, and post it back to the opener window.
 */
export default function AuthCallbackScreen() {
  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState("Processing authentication...");

  useEffect(() => {
    if (Platform.OS !== "web") return;
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);

      // Better Auth may use different parameter names
      const betterAuthToken =
        urlParams.get("token") ||
        urlParams.get("better_auth_token") ||
        urlParams.get("session_token");

      const error =
        urlParams.get("error") || urlParams.get("error_description");

      console.log("[AuthCallback] URL:", window.location.href);
      console.log("[AuthCallback] Token present:", !!betterAuthToken);
      console.log("[AuthCallback] Error:", error);

      if (error) {
        setStatus("error");
        setMessage(`Authentication failed: ${error}`);
        if (window.opener) {
          window.opener.postMessage({ type: "oauth-error", error }, window.location.origin);
        }
        return;
      }

      if (betterAuthToken) {
        console.log("[AuthCallback] Token found, establishing session...");
        
        // Try to exchange the token for a session using Better Auth client
        try {
          await setBearerToken(betterAuthToken);
          const session = await authClient.getSession();
          
          if (session?.data?.user) {
            console.log("[AuthCallback] Session established via authClient");
            setStatus("success");
            setMessage("Authentication successful! Closing...");
            
            if (window.opener) {
              window.opener.postMessage({
                type: "oauth-success",
                token: session.data.session?.token || betterAuthToken,
                user: session.data.user
              }, window.location.origin);
              setTimeout(() => window.close(), 1000);
            }
            return;
          }
        } catch (err) {
          console.warn("[AuthCallback] authClient.getSession failed:", err);
        }

        // Fallback: Try direct API call to /api/auth/me
        try {
          console.log("[AuthCallback] Trying direct API call...");
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
              "Authorization": `Bearer ${betterAuthToken}`,
            },
            credentials: "include",
          });

          if (response.ok) {
            const data = await response.json();
            if (data?.user) {
              console.log("[AuthCallback] Session established via direct API");
              setStatus("success");
              setMessage("Authentication successful! Closing...");
              
              if (window.opener) {
                window.opener.postMessage({
                  type: "oauth-success",
                  token: data.session?.token || betterAuthToken,
                  user: data.user
                }, window.location.origin);
                setTimeout(() => window.close(), 1000);
              }
              return;
            }
          }
        } catch (err) {
          console.warn("[AuthCallback] Direct API call failed:", err);
        }

        // Final fallback: Send the raw token to parent
        console.log("[AuthCallback] Sending raw token to parent");
        setStatus("success");
        setMessage("Authentication successful! Closing...");
        
        if (window.opener) {
          window.opener.postMessage({
            type: "oauth-success",
            token: betterAuthToken
          }, window.location.origin);
          setTimeout(() => window.close(), 1000);
        } else {
          // No opener - store token and redirect
          try {
            localStorage.setItem("cheshbon_bearer_token", betterAuthToken);
          } catch {}
          setTimeout(() => {
            window.location.href = "/";
          }, 1000);
        }
      } else {
        // No token in query params - check if Better Auth set a cookie session
        console.log("[AuthCallback] No token in URL, checking for session cookie...");
        
        try {
          const session = await authClient.getSession();
          if (session?.data?.user) {
            console.log("[AuthCallback] Session found via cookie");
            setStatus("success");
            setMessage("Authentication complete! Closing...");
            
            if (window.opener) {
              window.opener.postMessage({
                type: "oauth-success",
                token: session.data.session?.token || "cookie-auth",
                user: session.data.user
              }, window.location.origin);
              setTimeout(() => window.close(), 1000);
            } else {
              setTimeout(() => {
                window.location.href = "/";
              }, 1000);
            }
            return;
          }
        } catch (err) {
          console.warn("[AuthCallback] Cookie session check failed:", err);
        }

        // No token and no session
        setStatus("error");
        setMessage("No authentication token received");
        if (window.opener) {
          window.opener.postMessage({
            type: "oauth-error",
            error: "No token received"
          }, window.location.origin);
        }
      }
    } catch (err) {
      setStatus("error");
      setMessage("Failed to process authentication");
      console.error("[AuthCallback] Error:", err);
      if (window.opener) {
        window.opener.postMessage(
          { type: "oauth-error", error: "Processing failed" },
          window.location.origin
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
