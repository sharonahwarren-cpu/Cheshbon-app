
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { authClient, setBearerToken, clearAuthTokens } from "@/lib/auth";

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
  signOut: () => Promise<void>;
  fetchUser: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function openOAuthPopup(provider: string): Promise<string> {
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
          resolve(event.data.token || "cookie-auth");
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
          // Popup closed without sending a message - resolve with cookie-auth
          // The session might have been established via cookie
          console.log("[Auth] Popup closed without message, resolving with cookie-auth");
          resolve("cookie-auth");
        }
      }
    }, 500);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Track if we're in the middle of an OAuth flow to prevent fetchUser from clearing tokens
  const oauthInProgress = React.useRef(false);

  useEffect(() => {
    fetchUser();

    // Listen for deep links (e.g. from social auth redirects on native)
    const subscription = Linking.addEventListener("url", (event) => {
      console.log("Deep link received, refreshing user session");
      // Only refresh if not in the middle of an OAuth flow
      if (!oauthInProgress.current) {
        setTimeout(() => fetchUser(), 500);
      }
    });

    // POLLING: Refresh session every 5 minutes to keep SecureStore token in sync
    // This prevents 401 errors when the session token rotates
    const intervalId = setInterval(() => {
      if (!oauthInProgress.current) {
        console.log("Auto-refreshing user session to sync token...");
        fetchUser();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, []);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const session = await authClient.getSession();
      console.log("Session fetched:", session?.data?.user ? "User found" : "No user");
      if (session?.data?.user) {
        setUser(session.data.user as User);
        // Sync token to SecureStore for utils/api.ts
        if (session.data.session?.token) {
          await setBearerToken(session.data.session.token);
        }
      } else {
        setUser(null);
        // Only clear tokens if we're not in the middle of an OAuth flow
        // During OAuth, the token might not be valid yet but will be set shortly
        if (!oauthInProgress.current) {
          await clearAuthTokens();
        }
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

  const fetchSessionFromBackend = async (): Promise<{ user: User; token: string } | null> => {
    try {
      const { BACKEND_URL } = await import("@/utils/api");
      // Try the /api/auth/get-session endpoint (Better Auth built-in)
      const endpoints = [
        `${BACKEND_URL}/api/auth/get-session`,
        `${BACKEND_URL}/api/auth/session`,
      ];
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log(`[Auth] Backend session from ${endpoint}:`, data?.user ? "user found" : "no user");
            if (data?.user && data?.session?.token) {
              return { user: data.user as User, token: data.session.token };
            }
            if (data?.user) {
              return { user: data.user as User, token: "" };
            }
          }
        } catch (err) {
          console.warn(`[Auth] Failed to fetch session from ${endpoint}:`, err);
        }
      }
    } catch (err) {
      console.warn("[Auth] fetchSessionFromBackend failed:", err);
    }
    return null;
  };

  const signInWithSocial = async (provider: "google" | "apple" | "github") => {
    try {
      console.log(`[Auth] Starting ${provider} sign in...`);
      if (Platform.OS === "web") {
        // Set flag to prevent fetchUser from clearing tokens during OAuth flow
        oauthInProgress.current = true;
        console.log("[Auth] Opening OAuth popup for provider:", provider);
        const token = await openOAuthPopup(provider);
        console.log("[Auth] OAuth popup closed, token received:", token === "cookie-auth" ? "cookie-based" : token ? "bearer token (" + token.substring(0, 20) + "... length:" + token.length + ")" : "no token");
        
        // If we received a real token from the popup, try to use it
        if (token && token !== "cookie-auth") {
          console.log("[Auth] Token received from OAuth popup, attempting session establishment...");
          
          const { BACKEND_URL } = await import("@/utils/api");
          
          // Try to use the token as a bearer token directly
          // Better Auth session tokens can be used as bearer tokens
          try {
            const sessionResponse = await fetch(`${BACKEND_URL}/api/auth/get-session`, {
              method: "GET",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
              },
            });
            
            console.log(`[Auth] Backend /api/auth/get-session with popup token status:`, sessionResponse.status);
            
            if (sessionResponse.ok) {
              const sessionData = await sessionResponse.json();
              console.log(`[Auth] Backend session data:`, JSON.stringify(sessionData).substring(0, 300));
              
              const userData = sessionData?.user || sessionData?.data?.user;
              const sessionToken = sessionData?.session?.token || sessionData?.data?.session?.token;
              
              if (userData) {
                console.log("[Auth] Session established via backend with popup token:", userData.email);
                setUser(userData as User);
                await setBearerToken(sessionToken || token);
                oauthInProgress.current = false;
                return;
              }
            } else {
              const errorText = await sessionResponse.text();
              console.warn("[Auth] Backend session fetch failed:", sessionResponse.status, errorText.substring(0, 200));
            }
          } catch (backendErr) {
            console.warn("[Auth] Backend session fetch with popup token failed:", backendErr);
          }
          
          // Store the token and try the Better Auth client
          await setBearerToken(token);
          
          try {
            const session = await authClient.getSession();
            console.log("[Auth] Better Auth session with popup token:", session?.data?.user ? "found" : "not found");
            if (session?.data?.user) {
              console.log("[Auth] Social sign in successful with token via Better Auth client:", session.data.user.email);
              setUser(session.data.user as User);
              if (session.data.session?.token) {
                await setBearerToken(session.data.session.token);
              }
              oauthInProgress.current = false;
              return;
            }
          } catch (sessionErr) {
            console.warn("[Auth] Session fetch with popup token via Better Auth client failed:", sessionErr);
          }
          
          // Clear the temporary token since it didn't work as a bearer token
          await clearAuthTokens();
        }
        
        // Give the backend time to process the session
        console.log("[Auth] Waiting for backend to process session...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Retry fetching session up to 5 times
        for (let attempt = 1; attempt <= 5; attempt++) {
          console.log(`[Auth] Fetching user session (attempt ${attempt}/5)...`);
          
          try {
            // Try Better Auth client first
            const session = await authClient.getSession();
            if (session?.data?.user) {
              console.log("[Auth] Social sign in successful, user found:", session.data.user.email);
              setUser(session.data.user as User);
              if (session.data.session?.token) {
                await setBearerToken(session.data.session.token);
              }
              oauthInProgress.current = false;
              return;
            }
          } catch (sessionErr) {
            console.warn("[Auth] Better Auth session fetch attempt failed:", sessionErr);
          }
          
          // Try direct backend API call with credentials
          try {
            const backendSession = await fetchSessionFromBackend();
            if (backendSession?.user) {
              console.log("[Auth] Social sign in successful via backend API:", backendSession.user.email);
              setUser(backendSession.user);
              if (backendSession.token) {
                await setBearerToken(backendSession.token);
              }
              oauthInProgress.current = false;
              return;
            }
          } catch (backendErr) {
            console.warn("[Auth] Backend session fetch attempt failed:", backendErr);
          }
          
          if (attempt < 5) {
            const waitTime = attempt <= 2 ? 1500 : 2500;
            console.log(`[Auth] User not found yet, retrying in ${waitTime}ms... (${5 - attempt} retries left)`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
        
        // Final attempt with full fetchUser
        oauthInProgress.current = false;
        await fetchUser();
        
        // Check one more time
        const finalSession = await authClient.getSession();
        if (!finalSession?.data?.user) {
          console.error("[Auth] Could not confirm user session after OAuth");
          throw new Error(
            "Authentication completed but session could not be established.\n\n" +
            "This may be due to third-party cookie restrictions in your browser.\n\n" +
            "Please try:\n" +
            "1. Signing in with email/password instead\n" +
            "2. Checking your browser's cookie settings\n" +
            "3. Trying a different browser (Chrome or Firefox recommended)"
          );
        }
      } else {
        // Native: Use expo-linking to generate a proper deep link
        const callbackURL = Linking.createURL("/");
        console.log("[Auth] Native OAuth callback URL:", callbackURL);
        await authClient.signIn.social({
          provider,
          callbackURL,
        });
        // Wait for the redirect and session to be established
        await new Promise(resolve => setTimeout(resolve, 2000));
        await fetchUser();
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

  const signOut = async () => {
    try {
      console.log("Signing out...");
      await authClient.signOut();
    } catch (error) {
      console.error("Sign out failed (API):", error);
    } finally {
       // Always clear local state
       setUser(null);
       await clearAuthTokens();
    }
  };

  const requestPasswordReset = async (email: string) => {
    try {
      console.log("[Auth] Requesting password reset for:", email);
      // Ensure email is a string
      const emailString = String(email).trim();
      if (!emailString) {
        throw new Error("Email address is required");
      }

      // Use Better Auth's built-in forget-password endpoint
      // This triggers the sendResetPassword callback configured in the backend
      const { BACKEND_URL } = await import("@/utils/api");
      
      // The redirectTo tells Better Auth where to send the user after clicking the reset link.
      // The backend's sendResetPassword callback uses process.env.FRONTEND_URL for the reset link,
      // but we also pass redirectTo so Better Auth can use it if configured to do so.
      const redirectTo = Platform.OS === "web"
        ? `${window.location.origin}/reset-password`
        : `${BACKEND_URL}/reset-password`;

      console.log("[Auth] Calling Better Auth forget-password endpoint, redirectTo:", redirectTo);
      
      // First try using the Better Auth client's built-in method
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
      
      // Fallback: direct fetch to the endpoint
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
      
      // First try using the Better Auth client's built-in method
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
        // If the client returned an error, throw it
        const errMsg = result.error?.message || "Failed to reset password";
        if (errMsg.toLowerCase().includes("expired") || errMsg.toLowerCase().includes("invalid")) {
          throw new Error("Reset link has expired or is invalid. Please request a new one.");
        }
        throw new Error(errMsg);
      } catch (clientErr: any) {
        // If it's our own thrown error, re-throw it
        if (clientErr.message && !clientErr.message.includes("forgetPassword") && !clientErr.message.includes("resetPassword")) {
          throw clientErr;
        }
        console.warn("[Auth] Better Auth client resetPassword failed, trying direct fetch:", clientErr);
      }
      
      // Fallback: Use Better Auth's built-in reset-password endpoint directly
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
        // Better Auth returns specific error messages
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
