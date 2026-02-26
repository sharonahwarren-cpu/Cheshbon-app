import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Platform } from "react-native";
import { authClient } from "@/lib/auth";

type Status = "processing" | "success" | "error";

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
      // Better Auth uses 'better_auth_token' as the query parameter name for the OAuth callback token
      const betterAuthToken = urlParams.get("better_auth_token");
      const rawToken = urlParams.get("token") || urlParams.get("access_token");
      const error = urlParams.get("error");

      console.log("[AuthCallback] URL:", window.location.href);
      console.log("[AuthCallback] URL params:", window.location.search);
      console.log("[AuthCallback] better_auth_token:", !!betterAuthToken, "raw token:", !!rawToken, "Error:", error);

      if (error) {
        setStatus("error");
        setMessage(`Authentication failed: ${error}`);
        if (window.opener) {
          window.opener.postMessage({ type: "oauth-error", error }, window.location.origin);
        }
        return;
      }

      // If we have a better_auth_token, use it to establish the session
      if (betterAuthToken) {
        console.log("[AuthCallback] better_auth_token found in URL:", betterAuthToken.substring(0, 20) + "... (length:", betterAuthToken.length, ")");
        
        const { BACKEND_URL } = await import("@/utils/api");
        
        // Try to get the session using the better_auth_token as a query parameter
        // Better Auth processes the token when it's in the URL query string
        try {
          const sessionResponse = await fetch(`${BACKEND_URL}/api/auth/get-session?better_auth_token=${betterAuthToken}`, {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
          
          console.log("[AuthCallback] Session with better_auth_token query param status:", sessionResponse.status);
          
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            console.log("[AuthCallback] Session data:", JSON.stringify(sessionData).substring(0, 300));
            
            if (sessionData?.session?.token) {
              console.log("[AuthCallback] Session token obtained, sending to parent");
              setStatus("success");
              setMessage("Authentication successful! Closing...");
              if (window.opener) {
                window.opener.postMessage(
                  { type: "oauth-success", token: sessionData.session.token },
                  window.location.origin
                );
              }
              setTimeout(() => window.close(), 1000);
              return;
            }
            
            if (sessionData?.user) {
              console.log("[AuthCallback] User found, sending better_auth_token to parent");
              setStatus("success");
              setMessage("Authentication successful! Closing...");
              if (window.opener) {
                window.opener.postMessage(
                  { type: "oauth-success", token: betterAuthToken },
                  window.location.origin
                );
              }
              setTimeout(() => window.close(), 1000);
              return;
            }
          } else {
            const errorText = await sessionResponse.text();
            console.warn("[AuthCallback] Session with query param failed:", sessionResponse.status, errorText.substring(0, 200));
          }
        } catch (queryErr) {
          console.warn("[AuthCallback] Session with query param failed:", queryErr);
        }
        
        // Try using the token as a bearer token
        try {
          const sessionResponse = await fetch(`${BACKEND_URL}/api/auth/get-session`, {
            method: "GET",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${betterAuthToken}`,
            },
          });
          
          console.log("[AuthCallback] Session with bearer token status:", sessionResponse.status);
          
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            console.log("[AuthCallback] Session data:", JSON.stringify(sessionData).substring(0, 300));
            
            if (sessionData?.session?.token) {
              console.log("[AuthCallback] Session token obtained via bearer, sending to parent");
              setStatus("success");
              setMessage("Authentication successful! Closing...");
              if (window.opener) {
                window.opener.postMessage(
                  { type: "oauth-success", token: sessionData.session.token },
                  window.location.origin
                );
              }
              setTimeout(() => window.close(), 1000);
              return;
            }
            
            if (sessionData?.user) {
              console.log("[AuthCallback] User found via bearer, sending better_auth_token to parent");
              setStatus("success");
              setMessage("Authentication successful! Closing...");
              if (window.opener) {
                window.opener.postMessage(
                  { type: "oauth-success", token: betterAuthToken },
                  window.location.origin
                );
              }
              setTimeout(() => window.close(), 1000);
              return;
            }
          } else {
            const errorText = await sessionResponse.text();
            console.warn("[AuthCallback] Session with bearer failed:", sessionResponse.status, errorText.substring(0, 200));
          }
        } catch (bearerErr) {
          console.warn("[AuthCallback] Session with bearer failed:", bearerErr);
        }
        
        // Last resort: send the better_auth_token directly to the parent
        console.log("[AuthCallback] Sending better_auth_token directly to parent as last resort");
        setStatus("success");
        setMessage("Authentication successful! Closing...");
        if (window.opener) {
          window.opener.postMessage(
            { type: "oauth-success", token: betterAuthToken },
            window.location.origin
          );
        }
        setTimeout(() => window.close(), 1000);
        return;
      }

      // No better_auth_token in URL - try to fetch the session using Better Auth client
      // Better Auth sets a cookie after OAuth, so we can verify by calling getSession
      console.log("[AuthCallback] No token in URL, attempting to fetch session via Better Auth client...");
      
      // Wait a moment for the session to be established
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Try multiple times to get the session token
      for (let attempt = 1; attempt <= 4; attempt++) {
        console.log(`[AuthCallback] Session fetch attempt ${attempt}/4...`);
        
        try {
          // Try Better Auth client first (handles cookies automatically)
          const session = await authClient.getSession();
          console.log("[AuthCallback] Better Auth session:", session?.data?.user ? "found" : "not found", "token:", session?.data?.session?.token ? "present" : "absent");
          
          if (session?.data?.session?.token) {
            console.log("[AuthCallback] Session token found via Better Auth client, sending to parent");
            setStatus("success");
            setMessage("Authentication successful! Closing...");
            if (window.opener) {
              window.opener.postMessage(
                { type: "oauth-success", token: session.data.session.token },
                window.location.origin
              );
            }
            setTimeout(() => window.close(), 1000);
            return;
          }
          
          if (session?.data?.user) {
            // User found but no token in response - use cookie-auth signal
            console.log("[AuthCallback] User found via Better Auth client (cookie-based), sending to parent");
            setStatus("success");
            setMessage("Authentication successful! Closing...");
            if (window.opener) {
              window.opener.postMessage({ type: "oauth-success", token: "cookie-auth" }, window.location.origin);
            }
            setTimeout(() => window.close(), 1000);
            return;
          }
        } catch (sessionErr) {
          console.warn(`[AuthCallback] Better Auth session fetch attempt ${attempt} failed:`, sessionErr);
        }

        // Try the backend API directly as fallback
        try {
          const { BACKEND_URL } = await import("@/utils/api");
          
          const sessionResponse = await fetch(`${BACKEND_URL}/api/auth/get-session`, {
            method: "GET",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          });

          console.log(`[AuthCallback] Backend session fetch status:`, sessionResponse.status);

          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            console.log("[AuthCallback] Backend session data:", sessionData?.user ? "user found" : "no user");

            if (sessionData?.session?.token) {
              console.log("[AuthCallback] Backend session token found, sending to parent");
              setStatus("success");
              setMessage("Authentication successful! Closing...");
              if (window.opener) {
                window.opener.postMessage(
                  { type: "oauth-success", token: sessionData.session.token },
                  window.location.origin
                );
              }
              setTimeout(() => window.close(), 1000);
              return;
            }
            
            if (sessionData?.user) {
              console.log("[AuthCallback] Backend user found (cookie-based), sending to parent");
              setStatus("success");
              setMessage("Authentication successful! Closing...");
              if (window.opener) {
                window.opener.postMessage({ type: "oauth-success", token: "cookie-auth" }, window.location.origin);
              }
              setTimeout(() => window.close(), 1000);
              return;
            }
          }
        } catch (backendErr) {
          console.warn("[AuthCallback] Backend session fetch failed:", backendErr);
        }

        if (attempt < 4) {
          const waitTime = attempt * 1000;
          console.log(`[AuthCallback] Session not found, waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // Final fallback: signal cookie-based auth success so the parent can try fetching the session
      console.log("[AuthCallback] All attempts exhausted, signaling cookie-based auth to parent (final fallback)");
      setStatus("success");
      setMessage("Authentication successful! Closing...");
      if (window.opener) {
        window.opener.postMessage({ type: "oauth-success", token: "cookie-auth" }, window.location.origin);
      }
      setTimeout(() => window.close(), 1000);
    } catch (err) {
      setStatus("error");
      setMessage("Failed to process authentication");
      console.error("[AuthCallback] Auth callback error:", err);
      if (window.opener) {
        window.opener.postMessage(
          { type: "oauth-error", error: "Failed to process authentication" },
          window.location.origin
        );
      }
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
