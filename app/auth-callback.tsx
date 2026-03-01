
import React, { useEffect, useState, useRef } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useURL } from "expo-linking";
import { authClient, setBearerToken, API_URL } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import Toast from "react-native-toast-message";

type Status = "processing" | "success" | "error";

/**
 * OAuth callback handler for both web and native platforms.
 *
 * WEB: This page is opened inside the popup window (from auth-popup.tsx).
 * After Better Auth completes the OAuth flow it redirects here with a token.
 * We extract the token, establish the session, and post it back to the opener window.
 *
 * NATIVE: This screen is opened via deep link (cheshbon://auth-callback?token=...).
 * We extract the token from the URL, establish the session, and navigate to home.
 * Note: On iOS/Android, WebBrowser.openAuthSessionAsync intercepts the deep link
 * and returns it in browserResult.url - this screen handles the fallback case
 * where the app was backgrounded or the deep link arrives independently.
 */
export default function AuthCallbackScreen() {
  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState("Processing authentication...");
  const router = useRouter();
  const url = useURL(); // Get the deep link URL on native
  const { setUser, fetchUser } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      if (!handledRef.current) {
        handledRef.current = true;
        handleWebCallback();
      }
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" && url && !handledRef.current) {
      handledRef.current = true;
      handleNativeCallback(url);
    }
  }, [url]);

  const handleWebCallback = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);

      // Better Auth may use different parameter names
      const betterAuthToken =
        urlParams.get("token") ||
        urlParams.get("better_auth_token") ||
        urlParams.get("session_token");

      const error =
        urlParams.get("error") || urlParams.get("error_description");

      console.log("[AuthCallback Web] URL:", window.location.href);
      console.log("[AuthCallback Web] Token present:", !!betterAuthToken);
      console.log("[AuthCallback Web] Error:", error);

      if (error) {
        setStatus("error");
        setMessage(`Authentication failed: ${error}`);
        if (window.opener) {
          window.opener.postMessage({ type: "oauth-error", error }, window.location.origin);
        }
        return;
      }

      if (betterAuthToken) {
        console.log("[AuthCallback Web] Token found, establishing session...");

        // Save the token first
        await setBearerToken(betterAuthToken);

        // Try to exchange the token for a session using Better Auth client
        try {
          const session = await authClient.getSession();

          if (session?.data?.user) {
            console.log("[AuthCallback Web] Session established via authClient");
            setStatus("success");
            setMessage("Authentication successful! Closing...");

            if (window.opener) {
              window.opener.postMessage({
                type: "oauth-success",
                token: session.data.session?.token || betterAuthToken,
                user: session.data.user,
              }, window.location.origin);
              setTimeout(() => window.close(), 1000);
            }
            return;
          }
        } catch (err) {
          console.warn("[AuthCallback Web] authClient.getSession failed:", err);
        }

        // Fallback: Try direct API call to /api/auth/me
        try {
          console.log("[AuthCallback Web] Trying direct API call to /api/auth/me...");
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${betterAuthToken}`,
            },
            credentials: "include",
          });

          if (response.ok) {
            const data = await response.json();
            if (data?.user) {
              console.log("[AuthCallback Web] Session established via /api/auth/me");
              setStatus("success");
              setMessage("Authentication successful! Closing...");

              if (window.opener) {
                window.opener.postMessage({
                  type: "oauth-success",
                  token: data.session?.token || betterAuthToken,
                  user: data.user,
                }, window.location.origin);
                setTimeout(() => window.close(), 1000);
              }
              return;
            }
          }
        } catch (err) {
          console.warn("[AuthCallback Web] Direct API call failed:", err);
        }

        // Final fallback: Send the raw token to parent
        console.log("[AuthCallback Web] Sending raw token to parent");
        setStatus("success");
        setMessage("Authentication successful! Closing...");

        if (window.opener) {
          window.opener.postMessage({
            type: "oauth-success",
            token: betterAuthToken,
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
        console.log("[AuthCallback Web] No token in URL, checking for session cookie...");

        try {
          const session = await authClient.getSession();
          if (session?.data?.user) {
            console.log("[AuthCallback Web] Session found via cookie");
            setStatus("success");
            setMessage("Authentication complete! Closing...");

            if (window.opener) {
              window.opener.postMessage({
                type: "oauth-success",
                token: session.data.session?.token || "cookie-auth",
                user: session.data.user,
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
          console.warn("[AuthCallback Web] Cookie session check failed:", err);
        }

        // No token and no session
        setStatus("error");
        setMessage("No authentication token received");
        if (window.opener) {
          window.opener.postMessage({
            type: "oauth-error",
            error: "No token received",
          }, window.location.origin);
        }
      }
    } catch (err) {
      setStatus("error");
      setMessage("Failed to process authentication");
      console.error("[AuthCallback Web] Error:", err);
      if (window.opener) {
        window.opener.postMessage(
          { type: "oauth-error", error: "Processing failed" },
          window.location.origin
        );
      }
    }
  };

  const handleNativeCallback = async (deepLinkUrl: string) => {
    try {
      console.log("[AuthCallback Native] Deep link URL:", deepLinkUrl);

      // Parse the deep link URL - handle both cheshbon://auth-callback?token=... format
      let params: URLSearchParams;
      try {
        const parsedUrl = new URL(deepLinkUrl);
        params = parsedUrl.searchParams;
      } catch {
        // Fallback: manually parse query string
        const queryStart = deepLinkUrl.indexOf("?");
        params = new URLSearchParams(queryStart >= 0 ? deepLinkUrl.slice(queryStart + 1) : "");
      }

      // Extract token from multiple possible parameter names
      const token =
        params.get("token") ||
        params.get("better_auth_token") ||
        params.get("session_token") ||
        params.get("access_token");

      const error = params.get("error") || params.get("error_description");

      console.log("[AuthCallback Native] Token present:", !!token);
      console.log("[AuthCallback Native] Error:", error);

      if (error) {
        setStatus("error");
        setMessage(`Authentication failed: ${error}`);
        Toast.show({
          type: "error",
          text1: "Authentication Failed",
          text2: error,
        });
        setTimeout(() => {
          router.replace("/auth");
        }, 2000);
        return;
      }

      if (!token) {
        console.error("[AuthCallback Native] No token in deep link URL");
        setStatus("error");
        setMessage("No authentication token received");
        Toast.show({
          type: "error",
          text1: "Authentication Failed",
          text2: "No token received from server",
        });
        setTimeout(() => {
          router.replace("/auth");
        }, 2000);
        return;
      }

      console.log("[AuthCallback Native] Token found, saving and establishing session...");
      setMessage("Establishing session...");

      // Save the token
      await setBearerToken(token);

      // Give the backend a moment to process
      await new Promise(resolve => setTimeout(resolve, 500));

      // Try to establish session with retries
      let sessionEstablished = false;
      const maxRetries = 5;

      for (let i = 0; i < maxRetries && !sessionEstablished; i++) {
        console.log(`[AuthCallback Native] Attempting to establish session (${i + 1}/${maxRetries})...`);

        try {
          // Try authClient.getSession first
          const session = await authClient.getSession();
          if (session?.data?.user) {
            console.log("[AuthCallback Native] Session established via authClient");
            setUser(session.data.user as any);
            sessionEstablished = true;
            break;
          }
        } catch (sessionError) {
          console.warn("[AuthCallback Native] authClient.getSession failed:", sessionError);
        }

        // Try bearer token fallback via /api/auth/me (correct endpoint)
        try {
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            credentials: "include",
          });

          if (response.ok) {
            const data = await response.json();
            if (data?.user) {
              console.log("[AuthCallback Native] Session established via /api/auth/me");
              setUser(data.user);
              sessionEstablished = true;
              break;
            }
          }
        } catch (bearerError) {
          console.warn("[AuthCallback Native] Bearer token session failed:", bearerError);
        }

        if (i < maxRetries - 1) {
          const delay = 1000 * Math.pow(2, i); // Exponential backoff
          console.log(`[AuthCallback Native] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!sessionEstablished) {
        // Last resort: try fetchUser which will use the saved token
        console.log("[AuthCallback Native] Trying fetchUser as last resort...");
        try {
          await fetchUser();
          sessionEstablished = true;
        } catch (fetchErr) {
          console.warn("[AuthCallback Native] fetchUser failed:", fetchErr);
        }
      }

      if (!sessionEstablished) {
        console.error("[AuthCallback Native] Could not establish session after retries");
        setStatus("error");
        setMessage("Could not establish session");
        Toast.show({
          type: "error",
          text1: "Session Failed",
          text2: "Could not establish session. Please try again.",
        });
        setTimeout(() => {
          router.replace("/auth");
        }, 2000);
        return;
      }

      // Success!
      setStatus("success");
      setMessage("Authentication successful!");
      Toast.show({
        type: "success",
        text1: "Welcome!",
        text2: "You've successfully signed in.",
      });

      // Navigate to home
      setTimeout(() => {
        router.replace("/(tabs)/(home)");
      }, 1000);
    } catch (err: any) {
      console.error("[AuthCallback Native] Error:", err);
      setStatus("error");
      setMessage("Failed to process authentication");
      Toast.show({
        type: "error",
        text1: "Authentication Failed",
        text2: err.message || "An error occurred",
      });
      setTimeout(() => {
        router.replace("/auth");
      }, 2000);
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
