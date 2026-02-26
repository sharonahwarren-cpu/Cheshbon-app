
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import Toast from 'react-native-toast-message';
import { authClient, setBearerToken, clearAuthTokens, getSessionWithBearerToken, API_URL } from "@/lib/auth";

// Warm up the browser for faster OAuth on native
if (Platform.OS !== "web") {
  WebBrowser.maybeCompleteAuthSession();
}

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

    console.log("[AuthContext] 🪟 Opening OAuth popup:", popupUrl);

    const popup = window.open(
      popupUrl,
      "oauth-popup",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      console.error("[AuthContext] ❌ Failed to open popup window");
      reject(new Error("Failed to open popup. Please allow popups for this site and try again."));
      return;
    }

    let resolved = false;

    const handleMessage = (event: MessageEvent) => {
      // Accept messages from same origin only
      if (event.origin !== window.location.origin) {
        console.log("[AuthContext] ⚠️ Ignoring message from different origin:", event.origin);
        return;
      }

      console.log("[AuthContext] 📨 Received message from popup:", {
        type: event.data?.type,
        hasToken: !!event.data?.token,
        hasUser: !!event.data?.user,
        error: event.data?.error || "none",
      });

      if (event.data?.type === "oauth-success") {
        if (!resolved) {
          resolved = true;
          window.removeEventListener("message", handleMessage);
          clearInterval(checkClosed);
          console.log("[AuthContext] ✅ OAuth popup success");
          // Resolve with both token and user data if available
          resolve({ token: event.data.token || "", user: event.data.user || null });
        }
      } else if (event.data?.type === "oauth-error") {
        if (!resolved) {
          resolved = true;
          window.removeEventListener("message", handleMessage);
          clearInterval(checkClosed);
          const errorMsg = event.data.error || "OAuth failed";
          console.error("[AuthContext] ❌ OAuth error from popup:", errorMsg);
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
          console.log("[AuthContext] ⚠️ Popup closed without message");
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
    console.log("[AuthContext] 🚀 AuthProvider mounted");
    console.log("[AuthContext] Platform:", Platform.OS);
    
    // Don't auto-fetch user on auth-callback page to avoid consuming better_auth_token
    // The auth-callback page handles its own token exchange
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const pathname = window.location.pathname;
      console.log("[AuthContext] Current pathname:", pathname);
      
      if (pathname === "/auth-callback" || pathname.includes("auth-callback") || pathname.includes("auth-popup")) {
        console.log("[AuthContext] ⏭️ Skipping auto-fetchUser on auth callback/popup page");
        setLoading(false);
        return;
      }
    }
    
    console.log("[AuthContext] 🔄 Starting initial fetchUser...");
    fetchUser();

    // Listen for deep links (e.g. from social auth redirects on native)
    const subscription = Linking.addEventListener("url", (event) => {
      console.log("[AuthContext] 🔗 Deep link received:", event.url);
      console.log("[AuthContext] OAuth in progress:", oauthInProgress.current);
      // Don't fetch user if OAuth is in progress - the OAuth flow will handle it
      if (!oauthInProgress.current) {
        setTimeout(() => {
          console.log("[AuthContext] 🔄 Fetching user after deep link...");
          fetchUser();
        }, 500);
      } else {
        console.log("[AuthContext] ⏸️ Skipping fetchUser - OAuth in progress");
      }
    });

    // POLLING: Refresh session every 5 minutes to keep SecureStore token in sync
    const intervalId = setInterval(() => {
      console.log("[AuthContext] 🔄 Auto-refresh check (5min interval)...");
      console.log("[AuthContext] OAuth in progress:", oauthInProgress.current);
      if (!oauthInProgress.current) {
        console.log("[AuthContext] 🔄 Auto-refreshing user session...");
        fetchUser();
      } else {
        console.log("[AuthContext] ⏸️ Skipping auto-refresh - OAuth in progress");
      }
    }, 5 * 60 * 1000);

    return () => {
      console.log("[AuthContext] 🛑 AuthProvider unmounting");
      subscription.remove();
      clearInterval(intervalId);
    };
  }, []);

  const fetchUser = async () => {
    try {
      console.log("[AuthContext] 🔍 fetchUser() called");
      console.log("[AuthContext] OAuth in progress:", oauthInProgress.current);
      setLoading(true);
      
      // First try the authClient.getSession() which handles cookies/native storage
      let session: any = null;
      try {
        console.log("[AuthContext] 📞 Calling authClient.getSession()...");
        session = await authClient.getSession();
        console.log("[AuthContext] 📊 authClient.getSession() result:", {
          hasUser: !!session?.data?.user,
          hasSession: !!session?.data?.session,
          hasError: !!session?.error,
          errorMessage: session?.error?.message || "none",
        });
      } catch (sessionErr: any) {
        console.warn("[AuthContext] ⚠️ authClient.getSession() threw error:", {
          message: sessionErr.message,
          name: sessionErr.name,
        });
      }
      
      if (session?.data?.user) {
        console.log("[AuthContext] ✅ User found via authClient.getSession():", session.data.user.email);
        setUser(session.data.user as User);
        if (session.data.session?.token) {
          console.log("[AuthContext] 💾 Storing session token from authClient");
          await setBearerToken(session.data.session.token);
        }
        return;
      }
      
      // Fallback: Try using stored Bearer token to fetch session from /api/auth/me
      // This handles the case where OAuth set a Bearer token but no cookie
      console.log("[AuthContext] 🔄 No cookie session, trying Bearer token from storage...");
      try {
        const bearerSession = await getSessionWithBearerToken();
        console.log("[AuthContext] 📊 Bearer token session result:", {
          hasUser: !!bearerSession?.user,
          userEmail: bearerSession?.user?.email || "none",
        });
        
        if (bearerSession?.user) {
          console.log("[AuthContext] ✅ User found via Bearer token:", bearerSession.user.email);
          setUser(bearerSession.user as User);
          // Update stored token if a newer one is provided
          if (bearerSession?.session?.token) {
            console.log("[AuthContext] 💾 Updating stored token from Bearer session");
            await setBearerToken(bearerSession.session.token);
          }
          return;
        }
      } catch (err: any) {
        console.warn("[AuthContext] ⚠️ Bearer token fallback failed:", {
          message: err.message,
          name: err.name,
        });
      }
      
      // Don't clear user state if OAuth is in progress - the OAuth flow will set it
      if (oauthInProgress.current) {
        console.log("[AuthContext] ⏸️ OAuth in progress, skipping user state clear");
        return;
      }
      
      console.log("[AuthContext] ❌ No user found, clearing state");
      setUser(null);
      console.log("[AuthContext] 🧹 Clearing auth tokens");
      await clearAuthTokens();
    } catch (error: any) {
      console.error("[AuthContext] ❌ Failed to fetch user:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      // Don't clear user state if OAuth is in progress
      if (!oauthInProgress.current) {
        setUser(null);
      }
    } finally {
      setLoading(false);
      console.log("[AuthContext] ✅ fetchUser() completed");
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log("[AuthContext] 📧 signInWithEmail() called for:", email);
      await authClient.signIn.email({ email, password });
      console.log("[AuthContext] ✅ Email sign-in successful");
      await fetchUser();
    } catch (error: any) {
      console.error("[AuthContext] ❌ Email sign in failed:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      console.log("[AuthContext] 📧 signUpWithEmail() called for:", email);
      await authClient.signUp.email({
        email,
        password,
        name,
      });
      console.log("[AuthContext] ✅ Email sign-up successful");
      await fetchUser();
    } catch (error: any) {
      console.error("[AuthContext] ❌ Email sign up failed:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      throw error;
    }
  };

  const signInWithSocial = async (provider: "google" | "apple" | "github") => {
    try {
      console.log(`[AuthContext] 🔐 signInWithSocial(${provider}) called`);
      console.log("[AuthContext] Platform:", Platform.OS);
      
      if (Platform.OS === "web") {
        // WEB: Use popup-based OAuth flow
        console.log("[AuthContext] 🌐 Using web popup OAuth flow");
        oauthInProgress.current = true;
        
        try {
          console.log("[AuthContext] 🪟 Opening OAuth popup for provider:", provider);
          const startTime = Date.now();
          const popupResult = await openOAuthPopup(provider);
          const duration = Date.now() - startTime;
          
          const betterAuthToken = popupResult.token;
          const popupUser = popupResult.user;
          
          console.log("[AuthContext] 📊 Popup result:", {
            duration: `${duration}ms`,
            hasToken: !!betterAuthToken,
            tokenLength: betterAuthToken?.length || 0,
            hasUser: !!popupUser,
            userEmail: popupUser?.email || "none",
          });
          
          if (!betterAuthToken) {
            throw new Error("No authentication token received from OAuth");
          }
          
          // If the popup already resolved the user (exchanged the token successfully), use it directly
          if (popupUser) {
            console.log("[AuthContext] ✅ Using user data from popup:", popupUser.email);
            await setBearerToken(betterAuthToken);
            setUser(popupUser as User);
            console.log("[AuthContext] ✅ OAuth sign-in successful (from popup)");
            Toast.show({
              type: 'success',
              text1: 'Signed In',
              text2: `Welcome back, ${popupUser.name || popupUser.email}!`,
            });
            return;
          }
          
          // Store the token and fetch user
          console.log("[AuthContext] 💾 Storing better_auth_token");
          await setBearerToken(betterAuthToken);
          
          // Wait a moment for token to be stored
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Now fetch the user using the stored token
          console.log("[AuthContext] 🔄 Fetching user with stored token...");
          await fetchUser();
          
          // Check if user was set
          if (!user) {
            console.error("[AuthContext] ❌ Failed to establish session after token exchange");
            await clearAuthTokens();
            throw new Error("Failed to establish session after OAuth. Please try again.");
          }
          
          console.log("[AuthContext] ✅ OAuth sign-in successful");
          Toast.show({
            type: 'success',
            text1: 'Signed In',
            text2: 'Welcome back!',
          });
          
        } finally {
          oauthInProgress.current = false;
        }
      } else {
        // NATIVE (iOS/Android): Use WebBrowser-based OAuth flow
        // This is more reliable than the Better Auth client's built-in flow
        console.log("[AuthContext] 📱 Using native WebBrowser OAuth flow for", provider);
        oauthInProgress.current = true;
        
        try {
          // Generate the callback URL for deep linking
          const redirectUri = Linking.createURL("/");
          console.log("[AuthContext] 🔗 Native OAuth redirect URI:", redirectUri);
          
          // Build the OAuth URL
          const oauthUrl = `${API_URL}/api/auth/sign-in/social?provider=${provider}&callbackURL=${encodeURIComponent(redirectUri)}`;
          console.log("[AuthContext] 🌐 Opening browser for OAuth:", oauthUrl);
          
          // Open the browser for OAuth
          const result = await WebBrowser.openAuthSessionAsync(
            oauthUrl,
            redirectUri
          );
          
          console.log("[AuthContext] 📊 WebBrowser result:", {
            type: result.type,
            url: result.type === "success" ? result.url : "N/A",
          });
          
          if (result.type === "cancel") {
            throw new Error("Sign-in was cancelled");
          }
          
          if (result.type !== "success" || !result.url) {
            throw new Error("OAuth failed - no redirect URL received");
          }
          
          // Extract the better_auth_token from the redirect URL
          const url = new URL(result.url);
          const betterAuthToken = url.searchParams.get("better_auth_token");
          const error = url.searchParams.get("error");
          
          console.log("[AuthContext] 📊 Redirect URL params:", {
            hasToken: !!betterAuthToken,
            tokenLength: betterAuthToken?.length || 0,
            error: error || "none",
          });
          
          if (error) {
            throw new Error(`OAuth error: ${error}`);
          }
          
          if (!betterAuthToken) {
            throw new Error("No authentication token received from OAuth");
          }
          
          // Store the token
          console.log("[AuthContext] 💾 Storing better_auth_token");
          await setBearerToken(betterAuthToken);
          
          // Try multiple times to fetch the user session (with retries)
          console.log("[AuthContext] 🔄 Fetching user after native OAuth (with retries)...");
          let retries = 0;
          const maxRetries = 15;
          let sessionEstablished = false;
          
          while (retries < maxRetries && !sessionEstablished) {
            console.log(`[AuthContext] 🔄 Fetch attempt ${retries + 1}/${maxRetries}...`);
            
            // Try getSessionWithBearerToken
            try {
              const bearerSession = await getSessionWithBearerToken();
              console.log(`[AuthContext] 📊 Bearer token session attempt ${retries + 1}:`, {
                hasUser: !!bearerSession?.user,
                userEmail: bearerSession?.user?.email || "none",
              });
              
              if (bearerSession?.user) {
                console.log("[AuthContext] ✅ Session found via Bearer token on attempt", retries + 1);
                setUser(bearerSession.user as User);
                if (bearerSession?.session?.token) {
                  await setBearerToken(bearerSession.session.token);
                }
                sessionEstablished = true;
                Toast.show({
                  type: 'success',
                  text1: 'Signed In',
                  text2: `Welcome back, ${bearerSession.user.name || bearerSession.user.email}!`,
                });
                break;
              }
            } catch (err: any) {
              console.warn(`[AuthContext] ⚠️ Bearer token session attempt ${retries + 1} failed:`, {
                message: err.message,
                name: err.name,
              });
            }
            
            // If not found, wait and retry with increasing backoff
            if (!sessionEstablished && retries < maxRetries - 1) {
              const waitTime = retries < 3 ? 1000 : retries < 6 ? 2000 : retries < 10 ? 3000 : 4000;
              console.log(`[AuthContext] ⏳ Waiting ${waitTime}ms before retry ${retries + 2}/${maxRetries}...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            
            retries++;
          }
          
          if (!sessionEstablished) {
            console.error("[AuthContext] ❌ Failed to establish session after", maxRetries, "attempts");
            throw new Error(`Failed to establish session after ${provider} sign-in. Please try again or use email/password sign-in.`);
          }
          
          console.log("[AuthContext] ✅ Native OAuth completed successfully");
        } catch (nativeErr: any) {
          console.error("[AuthContext] ❌ Native OAuth failed:", {
            message: nativeErr.message,
            name: nativeErr.name,
            stack: nativeErr.stack,
          });
          throw new Error(nativeErr.message || `Failed to sign in with ${provider}. Please try again.`);
        } finally {
          oauthInProgress.current = false;
        }
      }
    } catch (error: any) {
      console.error(`[AuthContext] ❌ ${provider} sign in failed:`, {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      oauthInProgress.current = false;
      throw error;
    }
  };

  const signInWithGoogle = () => signInWithSocial("google");
  const signInWithApple = () => signInWithSocial("apple");
  const signInWithGitHub = () => signInWithSocial("github");

  // Redirect-based OAuth (fallback for when popup fails)
  const signInWithGoogleRedirect = async (): Promise<void> => {
    console.log("[AuthContext] 🔄 signInWithGoogleRedirect() called");
    if (Platform.OS !== "web") {
      return signInWithSocial("google");
    }
    const callbackURL = `${window.location.origin}/auth-callback`;
    const redirectUrl = `${API_URL}/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(callbackURL)}`;
    console.log("[AuthContext] 🌐 Redirecting to:", redirectUrl);
    window.location.href = redirectUrl;
  };

  const signOut = async () => {
    try {
      console.log("[AuthContext] 🚪 signOut() called");
      await authClient.signOut();
      console.log("[AuthContext] ✅ Sign out API call successful");
    } catch (error: any) {
      console.error("[AuthContext] ⚠️ Sign out API failed:", {
        message: error.message,
        name: error.name,
      });
    } finally {
      console.log("[AuthContext] 🧹 Clearing local user state and tokens");
      setUser(null);
      await clearAuthTokens();
      console.log("[AuthContext] ✅ Sign out completed");
    }
  };

  const requestPasswordReset = async (email: string) => {
    try {
      console.log("[AuthContext] 🔑 requestPasswordReset() called for:", email);
      const emailString = String(email).trim();
      if (!emailString) {
        throw new Error("Email address is required");
      }

      const redirectTo = Platform.OS === "web"
        ? `${window.location.origin}/reset-password`
        : `${API_URL}/reset-password`;

      console.log("[AuthContext] 📧 Calling Better Auth forget-password endpoint");
      console.log("[AuthContext] Redirect URL:", redirectTo);
      
      try {
        const result = await authClient.forgetPassword({
          email: emailString,
          redirectTo,
        });
        console.log("[AuthContext] 📊 Better Auth forgetPassword result:", {
          hasError: !!result?.error,
          errorMessage: result?.error?.message || "none",
        });
        
        if (!result?.error) {
          console.log("[AuthContext] ✅ Password reset email sent successfully");
          return;
        }
        console.warn("[AuthContext] ⚠️ Better Auth forgetPassword returned error:", result.error);
      } catch (clientErr: any) {
        console.warn("[AuthContext] ⚠️ Better Auth client forgetPassword failed:", {
          message: clientErr.message,
          name: clientErr.name,
        });
      }
      
      console.log("[AuthContext] 🔄 Trying direct fetch to /api/auth/forget-password...");
      const response = await fetch(`${API_URL}/api/auth/forget-password`, {
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

      console.log("[AuthContext] 📊 forget-password response:", {
        status: response.status,
        ok: response.ok,
        data,
      });

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to send reset email");
      }

      console.log("[AuthContext] ✅ Password reset email sent successfully");
    } catch (error: any) {
      console.error("[AuthContext] ❌ Password reset request failed:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      throw error;
    }
  };

  const resetPassword = async (token: string, newPassword: string) => {
    try {
      console.log("[AuthContext] 🔑 resetPassword() called");
      
      try {
        const result = await authClient.resetPassword({
          newPassword,
          token,
        });
        console.log("[AuthContext] 📊 Better Auth resetPassword result:", {
          hasError: !!result?.error,
          errorMessage: result?.error?.message || "none",
        });
        
        if (!result?.error) {
          console.log("[AuthContext] ✅ Password reset successful");
          return;
        }
        
        const errMsg = result.error?.message || "Failed to reset password";
        if (errMsg.toLowerCase().includes("expired") || errMsg.toLowerCase().includes("invalid")) {
          throw new Error("Reset link has expired or is invalid. Please request a new one.");
        }
        throw new Error(errMsg);
      } catch (clientErr: any) {
        if (clientErr.message && !clientErr.message.includes("forgetPassword") && !clientErr.message.includes("resetPassword")) {
          throw clientErr;
        }
        console.warn("[AuthContext] ⚠️ Better Auth client resetPassword failed:", {
          message: clientErr.message,
          name: clientErr.name,
        });
      }
      
      console.log("[AuthContext] 🔄 Trying direct fetch to /api/auth/reset-password...");
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
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

      console.log("[AuthContext] 📊 reset-password response:", {
        status: response.status,
        ok: response.ok,
        data,
      });

      if (!response.ok) {
        const errorMsg = data.error || data.message || "Failed to reset password";
        if (response.status === 400) {
          throw new Error(errorMsg.toLowerCase().includes("expired") || errorMsg.toLowerCase().includes("invalid")
            ? "Reset link has expired or is invalid. Please request a new one."
            : errorMsg);
        }
        throw new Error(errorMsg);
      }

      console.log("[AuthContext] ✅ Password reset successful");
    } catch (error: any) {
      console.error("[AuthContext] ❌ Password reset failed:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
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
