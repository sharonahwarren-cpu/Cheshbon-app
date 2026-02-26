
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
          reject(new Error("Authentication cancelled"));
        }
      }
    }, 500);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();

    // Listen for deep links (e.g. from social auth redirects)
    const subscription = Linking.addEventListener("url", (event) => {
      console.log("Deep link received, refreshing user session");
      // Allow time for the client to process the token if needed
      setTimeout(() => fetchUser(), 500);
    });

    // POLLING: Refresh session every 5 minutes to keep SecureStore token in sync
    // This prevents 401 errors when the session token rotates
    const intervalId = setInterval(() => {
      console.log("Auto-refreshing user session to sync token...");
      fetchUser();
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
      console.log(`[Auth] Starting ${provider} sign in...`);
      if (Platform.OS === "web") {
        console.log("[Auth] Opening OAuth popup for provider:", provider);
        const token = await openOAuthPopup(provider);
        console.log("[Auth] OAuth popup closed, token received:", token === "cookie-auth" ? "cookie-based" : token ? "bearer token" : "no token");
        
        // If we received a real bearer token, store it
        if (token && token !== "cookie-auth") {
          console.log("[Auth] Setting bearer token from OAuth response");
          await setBearerToken(token);
        }
        
        // Give the backend time to process the session
        console.log("[Auth] Waiting for backend to process session...");
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Retry fetchUser up to 6 times to handle timing issues
        let retries = 6;
        while (retries > 0) {
          console.log(`[Auth] Fetching user session (attempt ${7 - retries}/6)...`);
          
          try {
            // Try to get session directly from Better Auth client
            const session = await authClient.getSession();
            if (session?.data?.user) {
              console.log("[Auth] Social sign in successful, user found:", session.data.user.email);
              setUser(session.data.user as User);
              // Sync token to storage
              if (session.data.session?.token) {
                await setBearerToken(session.data.session.token);
              }
              return;
            }
          } catch (sessionErr) {
            console.warn("[Auth] Session fetch attempt failed:", sessionErr);
          }
          
          retries--;
          if (retries > 0) {
            const waitTime = retries > 3 ? 1000 : 2000;
            console.log(`[Auth] User not found yet, retrying in ${waitTime}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
        
        // Final attempt with full fetchUser
        await fetchUser();
        
        // Check one more time
        const finalSession = await authClient.getSession();
        if (!finalSession?.data?.user) {
          console.error("[Auth] Could not confirm user session after OAuth");
          throw new Error("Authentication completed but session could not be established. Please try again.");
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
      const redirectTo = Platform.OS === "web"
        ? `${window.location.origin}/reset-password`
        : `${BACKEND_URL}/reset-password`;

      console.log("[Auth] Calling Better Auth forget-password endpoint, redirectTo:", redirectTo);
      const response = await fetch(`${BACKEND_URL}/api/auth/forget-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      // Use Better Auth's built-in reset-password endpoint
      const { BACKEND_URL } = await import("@/utils/api");
      const response = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
          throw new Error(errorMsg.includes("expired") ? "Reset link has expired. Please request a new one." : errorMsg);
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
