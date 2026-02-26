
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { authClient, setBearerToken, clearAuthTokens, getSessionWithBearerToken } from "@/lib/auth";

interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signInWithGoogleRedirect: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchUser: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function openOAuthPopup(provider: string): Promise<{ token: string; user: any | null }> {
  return new Promise((resolve, reject) => {
    const popupUrl = `${window.location.origin}/auth-popup?provider=${provider}`;
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    console.log("[Auth] Opening OAuth popup:", popupUrl);

    const popup = window.open(
      popupUrl,
      "oauth-popup",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      reject(new Error("Failed to open popup. Please allow popups for this site and try again."));
      return;
    }

    let resolved = false;

    const handleMessage = (event: MessageEvent) => {
      // Accept messages from same origin only
      if (event.origin !== window.location.origin) {
        console.log("[Auth] Ignoring message from different origin:", event.origin);
        return;
      }

      console.log("[Auth] Received message from popup:", event.data?.type, event.data?.error || "");

      if (event.data?.type === "oauth-success") {
        if (!resolved) {
          resolved = true;
          window.removeEventListener("message", handleMessage);
          clearInterval(checkClosed);
          // Resolve with both token and user data if available
          resolve({ token: event.data.token || "", user: event.data.user || null });
        }
      } else if (event.data?.type === "oauth-error") {
        if (!resolved) {
          resolved = true;
          window.removeEventListener("message", handleMessage);
          clearInterval(checkClosed);
          const errorMsg = event.data.error || "OAuth failed";
          console.error("[Auth] OAuth error from popup:", errorMsg);
          reject(new Error(errorMsg));
        }
      }
    };

    window.addEventListener("message", handleMessage);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        if (!resolved) {
          resolved = true;
          console.log("[Auth] Popup closed without message");
          reject(new Error("Authentication window was closed"));
        }
      }
    }, 500);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const oauthInProgress = React.useRef(false);

  useEffect(() => {
    // Don't auto-fetch user on auth-callback page to avoid consuming better_auth_token
    // The auth-callback page handles its own token exchange
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const pathname = window.location.pathname;
      if (pathname === "/auth-callback" || pathname.includes("auth-callback") || pathname.includes("auth-popup")) {
        console.log("[Auth] Skipping auto-fetchUser on auth callback/popup page");
        setLoading(false);
        return;
      }
    }
    
    fetchUser();

    // Listen for deep links (e.g. from social auth redirects on native)
    const subscription = Linking.addEventListener("url", (event) => {
      console.log("Deep link received, refreshing user session");
      if (!oauthInProgress.current) {
        setTimeout(() => fetchUser(), 500);
      }
    });

    // POLLING: Refresh session every 5 minutes to keep SecureStore token in sync
    const intervalId = setInterval(() => {
      if (!oauthInProgress.current) {
        console.log("Auto-refreshing user session to sync token...");
        fetchUser();
      }
    }, 5 * 60 * 1000);

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, []);

  const fetchUser = async () => {
    try {
      setLoading(true);
      
      // First try the authClient.getSession() which handles cookies/native storage
      let session: any = null;
      try {
        session = await authClient.getSession();
      } catch (sessionErr) {
        console.warn("[Auth] authClient.getSession() threw error:", sessionErr);
      }
      
      console.log("Session fetched:", session?.data?.user ? "User found" : "No user");
      
      if (session?.data?.user) {
        setUser(session.data.user as User);
        if (session.data.session?.token) {
          await setBearerToken(session.data.session.token);
        }
        return;
      }
      
      // Fallback: Try using stored Bearer token to fetch session from /api/auth/me
      // This handles the case where OAuth set a Bearer token but no cookie
      console.log("[Auth] No cookie session, trying Bearer token from storage...");
      try {
        const bearerSession = await getSessionWithBearerToken();
        if (bearerSession?.user) {
          console.log("[Auth] User found via Bearer token:", bearerSession.user.email);
          setUser(bearerSession.user as User);
          // Update stored token if a newer one is provided
          if (bearerSession?.session?.token) {
            await setBearerToken(bearerSession.session.token);
          }
          return;
        }
      } catch (err) {
        console.warn("[Auth] Bearer token fallback failed:", err);
      }
      
      setUser(null);
      if (!oauthInProgress.current) {
        await clearAuthTokens();
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log("Signing in with email:", email);
      await authClient.signIn.email({ email, password });
      await fetchUser();
    } catch (error) {
      console.error("Email sign in failed:", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      console.log("Signing up with email:", email);
      await authClient.signUp.email({
        email,
        password,
        name,
      });
      await fetchUser();
    } catch (error) {
      console.error("Email sign up failed:", error);
      throw error;
    }
  };

  const signInWithSocial = async (provider: "google" | "apple" | "github") => {
    try {
      console.log(`[Auth] Starting ${provider} sign in on platform:`, Platform.OS);
      if (Platform.OS === "web") {
        oauthInProgress.current = true;
        
        try {
          console.log("[Auth] Opening OAuth popup for provider:", provider);
          const popupResult = await openOAuthPopup(provider);
          const betterAuthToken = popupResult.token;
          const popupUser = popupResult.user;
          
          if (!betterAuthToken) {
            throw new Error("No authentication token received from OAuth");
          }
          
          console.log("[Auth] Received token from popup (length:", betterAuthToken.length, "), user from popup:", popupUser ? "yes" : "no");
          
          // If the popup already resolved the user (exchanged the token successfully), use it directly
          if (popupUser) {
            console.log("[Auth] Using user data from popup:", popupUser.email);
            await setBearerToken(betterAuthToken);
            setUser(popupUser as User);
            console.log("[Auth] OAuth sign-in successful (from popup):", popupUser.email);
            return;
          }
          
          const { BACKEND_URL } = await import("@/utils/api");
          
          // Exchange better_auth_token for a session
          // Better Auth's better_auth_token is a one-time token that must be exchanged
          // via the /api/auth/get-session endpoint with the token in the Authorization header
          console.log("[Auth] Exchanging better_auth_token for session...");
          
          let sessionData: any = null;
          
          // The correct Better Auth flow:
          // 1. Store the better_auth_token as Bearer token
          // 2. Call authClient.getSession() which sends it in Authorization header
          // 3. Better Auth exchanges it for a real session and returns user data
          await setBearerToken(betterAuthToken);
          
          // Wait a brief moment to ensure token is stored
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Try authClient.getSession() first - it uses the stored Bearer token
          try {
            const clientSession = await authClient.getSession();
            console.log("[Auth] authClient.getSession() result:", 
              clientSession?.data?.user ? "user found" : "no user",
              "error:", clientSession?.error?.message || "none"
            );
            
            if (clientSession?.data?.user) {
              sessionData = {
                user: clientSession.data.user,
                session: clientSession.data.session,
              };
            }
          } catch (err) {
            console.warn("[Auth] authClient.getSession() threw error:", err);
          }
          
          // Fallback: Direct fetch to /api/auth/get-session with Bearer token
          if (!sessionData?.user) {
            try {
              const sessionResponse = await fetch(
                `${BACKEND_URL}/api/auth/get-session`,
                {
                  method: "GET",
                  credentials: "include",
                  headers: {
                    "Authorization": `Bearer ${betterAuthToken}`,
                  },
                }
              );
              
              const rawText = await sessionResponse.text();
              console.log("[Auth] /api/auth/get-session status:", sessionResponse.status, "body:", rawText.substring(0, 300));
              
              if (sessionResponse.ok && rawText) {
                try {
                  const parsed = JSON.parse(rawText);
                  // Better Auth returns { session: {...}, user: {...} }
                  if (parsed?.user) {
                    sessionData = parsed;
                  } else if (parsed?.session?.token) {
                    // Session exists but user might be nested differently
                    sessionData = parsed;
                  }
                } catch (parseErr) {
                  console.warn("[Auth] Failed to parse get-session response:", parseErr);
                }
              }
            } catch (err) {
              console.warn("[Auth] /api/auth/get-session fetch threw error:", err);
            }
          }
          
          // Fallback: Try /api/auth/me with Bearer token
          if (!sessionData?.user) {
            try {
              const meResponse = await fetch(
                `${BACKEND_URL}/api/auth/me`,
                {
                  method: "GET",
                  credentials: "include",
                  headers: {
                    "Authorization": `Bearer ${betterAuthToken}`,
                  },
                }
              );
              
              const rawText = await meResponse.text();
              console.log("[Auth] /api/auth/me status:", meResponse.status, "body:", rawText.substring(0, 300));
              
              if (meResponse.ok && rawText) {
                try {
                  const parsed = JSON.parse(rawText);
                  if (parsed?.user) {
                    sessionData = parsed;
                  }
                } catch (parseErr) {
                  console.warn("[Auth] Failed to parse /api/auth/me response:", parseErr);
                }
              }
            } catch (err) {
              console.warn("[Auth] /api/auth/me fetch threw error:", err);
            }
          }
          
          if (!sessionData?.user) {
            // Clear the invalid token we stored
            await clearAuthTokens();
            throw new Error("Failed to establish session after OAuth. Please try signing in again.");
          }
          
          // Store the real session token (prefer session.token over better_auth_token)
          const tokenToStore = sessionData?.session?.token || betterAuthToken;
          console.log("[Auth] Storing final session token (length:", tokenToStore.length, ")");
          await setBearerToken(tokenToStore);
          
          // Update user state directly
          setUser(sessionData.user as User);
          console.log("[Auth] OAuth sign-in successful:", sessionData.user.email);
          
        } finally {
          oauthInProgress.current = false;
        }
      } else {
        // Native (iOS/Android): Use Better Auth's native OAuth flow
        console.log("[Auth] Starting native OAuth flow for", provider);
        oauthInProgress.current = true;
        
        try {
          // Generate the callback URL for deep linking
          const callbackURL = Linking.createURL("/");
          console.log("[Auth] Native OAuth callback URL:", callbackURL);
          
          // Call Better Auth's social sign-in which will open the browser
          const result = await authClient.signIn.social({
            provider,
            callbackURL,
          });
          
          console.log("[Auth] Native OAuth result:", result ? "success" : "no result");
          
          // Wait a moment for the deep link to be processed
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Fetch the user session
          await fetchUser();
          
          console.log("[Auth] Native OAuth completed, user:", user ? "authenticated" : "not authenticated");
        } finally {
          oauthInProgress.current = false;
        }
      }
    } catch (error) {
      console.error(`[Auth] ${provider} sign in failed:`, error);
      oauthInProgress.current = false;
      throw error;
    }
  };

  const signInWithGoogle = () => signInWithSocial("google");
  const signInWithApple = () => signInWithSocial("apple");
  const signInWithGitHub = () => signInWithSocial("github");

  // Redirect-based OAuth (fallback for when popup fails)
  // This navigates away from the current page
  const signInWithGoogleRedirect = async (): Promise<void> => {
    if (Platform.OS !== "web") {
      return signInWithSocial("google");
    }
    const { BACKEND_URL } = await import("@/utils/api");
    const callbackURL = `${window.location.origin}/auth-callback`;
    window.location.href = `${BACKEND_URL}/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(callbackURL)}`;
  };

  const signOut = async () => {
    try {
      console.log("Signing out...");
      await authClient.signOut();
    } catch (error) {
      console.error("Sign out failed (API):", error);
    } finally {
       setUser(null);
       await clearAuthTokens();
    }
  };

  const requestPasswordReset = async (email: string) => {
    try {
      console.log("[Auth] Requesting password reset for:", email);
      const emailString = String(email).trim();
      if (!emailString) {
        throw new Error("Email address is required");
      }

      const { BACKEND_URL } = await import("@/utils/api");
      
      const redirectTo = Platform.OS === "web"
        ? `${window.location.origin}/reset-password`
        : `${BACKEND_URL}/reset-password`;

      console.log("[Auth] Calling Better Auth forget-password endpoint, redirectTo:", redirectTo);
      
      try {
        const result = await authClient.forgetPassword({
          email: emailString,
          redirectTo,
        });
        console.log("[Auth] Better Auth forgetPassword result:", result);
        if (!result?.error) {
          console.log("[Auth] Password reset email sent successfully via Better Auth client");
          return;
        }
        console.warn("[Auth] Better Auth forgetPassword returned error:", result.error);
      } catch (clientErr) {
        console.warn("[Auth] Better Auth client forgetPassword failed, trying direct fetch:", clientErr);
      }
      
      const response = await fetch(`${BACKEND_URL}/api/auth/forget-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email: emailString, redirectTo }),
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch {
        // ignore parse errors
      }

      console.log("[Auth] forget-password response:", response.status, data);

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to send reset email");
      }

      console.log("[Auth] Password reset email sent successfully");
    } catch (error) {
      console.error("[Auth] Password reset request failed:", error);
      throw error;
    }
  };

  const resetPassword = async (token: string, newPassword: string) => {
    try {
      console.log("[Auth] Resetting password with token");
      
      try {
        const result = await authClient.resetPassword({
          newPassword,
          token,
        });
        console.log("[Auth] Better Auth resetPassword result:", result);
        if (!result?.error) {
          console.log("[Auth] Password reset successful via Better Auth client");
          return;
        }
        console.warn("[Auth] Better Auth resetPassword returned error:", result.error);
        const errMsg = result.error?.message || "Failed to reset password";
        if (errMsg.toLowerCase().includes("expired") || errMsg.toLowerCase().includes("invalid")) {
          throw new Error("Reset link has expired or is invalid. Please request a new one.");
        }
        throw new Error(errMsg);
      } catch (clientErr: any) {
        if (clientErr.message && !clientErr.message.includes("forgetPassword") && !clientErr.message.includes("resetPassword")) {
          throw clientErr;
        }
        console.warn("[Auth] Better Auth client resetPassword failed, trying direct fetch:", clientErr);
      }
      
      const { BACKEND_URL } = await import("@/utils/api");
      const response = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ token, newPassword }),
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch {
        // ignore parse errors
      }

      console.log("[Auth] reset-password response:", response.status, data);

      if (!response.ok) {
        const errorMsg = data.error || data.message || "Failed to reset password";
        if (response.status === 400) {
          throw new Error(errorMsg.toLowerCase().includes("expired") || errorMsg.toLowerCase().includes("invalid")
            ? "Reset link has expired or is invalid. Please request a new one."
            : errorMsg);
        }
        throw new Error(errorMsg);
      }

      console.log("[Auth] Password reset successful");
    } catch (error) {
      console.error("[Auth] Password reset failed:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithApple,
        signInWithGitHub,
        signInWithGoogleRedirect,
        signOut,
        fetchUser,
        requestPasswordReset,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
