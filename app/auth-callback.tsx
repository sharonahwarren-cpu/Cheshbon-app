
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Platform } from "react-native";
import { authClient, setBearerToken, API_URL } from "@/lib/auth";
import { useRouter } from "expo-router";

type Status = "processing" | "success" | "error";

/**
 * OAuth callback handler for both web and native platforms.
 * 
 * WEB: This page is opened inside the popup window (from auth-popup.tsx).
 * After Better Auth completes the OAuth flow it redirects here with a token.
 * We extract the token, establish the session, and post it back to the opener window.
 * 
 * NATIVE: This page is opened via deep link after OAuth redirect.
 * We extract the token from the URL and establish the session.
 */
export default function AuthCallbackScreen() {
  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState("Processing authentication...");
  const router = useRouter();

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      console.log("[AuthCallback] Starting callback handler...");
      console.log("[AuthCallback] Platform:", Platform.OS);
      console.log("[AuthCallback] URL:", Platform.OS === "web" ? window.location.href : "N/A (native)");

      let urlParams: URLSearchParams;
      
      if (Platform.OS === "web") {
        urlParams = new URLSearchParams(window.location.search);
      } else {
        // On native, the URL params are passed via the deep link
        // We need to get them from the current URL
        const url = window.location?.href || "";
        urlParams = new URLSearchParams(url.split("?")[1] || "");
      }

      // Better Auth may use different parameter names
      const token =
        urlParams.get("token") ||
        urlParams.get("better_auth_token") ||
        urlParams.get("session_token") ||
        urlParams.get("access_token");

      const error =
        urlParams.get("error") || urlParams.get("error_description");

      console.log("[AuthCallback] Token present:", !!token);
      console.log("[AuthCallback] Error:", error);
      console.log("[AuthCallback] All URL params:", Array.from(urlParams.entries()));

      if (error) {
        console.error("[AuthCallback] OAuth error:", error);
        setStatus("error");
        setMessage(`Authentication failed: ${error}`);
        
        if (Platform.OS === "web" && window.opener) {
          window.opener.postMessage({ type: "oauth-error", error }, window.location.origin);
          setTimeout(() => window.close(), 2000);
        } else {
          // On native, navigate back to auth screen
          setTimeout(() => router.replace("/auth"), 2000);
        }
        return;
      }

      if (token) {
        console.log("[AuthCallback] Token found, establishing session...");
        
        // Save the token first
        await setBearerToken(token);
        console.log("[AuthCallback] Token saved to storage");
        
        // Try to establish session using Better Auth client
        let sessionUser = null;
        try {
          const session = await authClient.getSession();
          console.log("[AuthCallback] authClient.getSession() response:", session?.data?.user ? "User found" : "No user");
          
          if (session?.data?.user) {
            sessionUser = session.data.user;
            console.log("[AuthCallback] Session established via authClient");
            
            // Save the session token if different from the one we have
            if (session.data.session?.token && session.data.session.token !== token) {
              await setBearerToken(session.data.session.token);
              console.log("[AuthCallback] Updated token from session");
            }
          }
        } catch (err) {
          console.warn("[AuthCallback] authClient.getSession failed:", err);
        }

        // Fallback: Try direct API call to /api/auth/get-session
        if (!sessionUser) {
          try {
            console.log("[AuthCallback] Trying direct API call to /api/auth/get-session...");
            const response = await fetch(`${API_URL}/api/auth/get-session`, {
              headers: {
                "Authorization": `Bearer ${token}`,
              },
              credentials: "include",
            });

            console.log("[AuthCallback] API response status:", response.status);

            if (response.ok) {
              const data = await response.json();
              console.log("[AuthCallback] API response data:", data?.user ? "User found" : "No user");
              
              if (data?.user) {
                sessionUser = data.user;
                console.log("[AuthCallback] Session established via direct API");
                
                // Save the session token if available
                if (data.session?.token) {
                  await setBearerToken(data.session.token);
                }
              }
            } else {
              const errorText = await response.text();
              console.error("[AuthCallback] API error:", response.status, errorText);
            }
          } catch (err) {
            console.warn("[AuthCallback] Direct API call failed:", err);
          }
        }

        if (sessionUser) {
          setStatus("success");
          setMessage("Authentication successful!");
          
          if (Platform.OS === "web" && window.opener) {
            console.log("[AuthCallback] Posting success message to opener window");
            window.opener.postMessage({
              type: "oauth-success",
              token: token,
              user: sessionUser
            }, window.location.origin);
            setTimeout(() => window.close(), 1000);
          } else {
            // On native, navigate to home
            console.log("[AuthCallback] Navigating to home screen");
            setTimeout(() => router.replace("/(tabs)/(home)"), 1000);
          }
        } else {
          // We have a token but couldn't establish a session
          console.warn("[AuthCallback] Token found but session establishment failed");
          
          if (Platform.OS === "web" && window.opener) {
            // Still send the token to the parent - it will retry session establishment
            console.log("[AuthCallback] Sending token to opener (session establishment will be retried)");
            window.opener.postMessage({
              type: "oauth-success",
              token: token
            }, window.location.origin);
            setTimeout(() => window.close(), 1000);
          } else {
            // On native, the AuthContext will retry session establishment
            console.log("[AuthCallback] Navigating to home (session will be established by AuthContext)");
            setTimeout(() => router.replace("/(tabs)/(home)"), 1000);
          }
        }
      } else {
        // No token in query params - check if Better Auth set a cookie session
        console.log("[AuthCallback] No token in URL, checking for session cookie...");
        
        try {
          const session = await authClient.getSession();
          if (session?.data?.user) {
            console.log("[AuthCallback] Session found via cookie");
            setStatus("success");
            setMessage("Authentication complete!");
            
            if (Platform.OS === "web" && window.opener) {
              window.opener.postMessage({
                type: "oauth-success",
                token: session.data.session?.token || "cookie-auth",
                user: session.data.user
              }, window.location.origin);
              setTimeout(() => window.close(), 1000);
            } else {
              setTimeout(() => router.replace("/(tabs)/(home)"), 1000);
            }
            return;
          }
        } catch (err) {
          console.warn("[AuthCallback] Cookie session check failed:", err);
        }

        // No token and no session
        console.error("[AuthCallback] No authentication token or session found");
        setStatus("error");
        setMessage("No authentication token received. Please try again.");
        
        if (Platform.OS === "web" && window.opener) {
          window.opener.postMessage({
            type: "oauth-error",
            error: "No token received"
          }, window.location.origin);
          setTimeout(() => window.close(), 2000);
        } else {
          setTimeout(() => router.replace("/auth"), 2000);
        }
      }
    } catch (err) {
      console.error("[AuthCallback] Unexpected error:", err);
      setStatus("error");
      setMessage("Failed to process authentication");
      
      if (Platform.OS === "web" && window.opener) {
        window.opener.postMessage(
          { type: "oauth-error", error: "Processing failed" },
          window.location.origin
        );
        setTimeout(() => window.close(), 2000);
      } else {
        setTimeout(() => router.replace("/auth"), 2000);
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
      {status === "error" && (
        <Text style={styles.subMessage}>
          Redirecting back...
        </Text>
      )}
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
  subMessage: {
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
    color: "#666",
  },
});
