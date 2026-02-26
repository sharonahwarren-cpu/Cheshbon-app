
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import Toast from 'react-native-toast-message';
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
      if (!oauthInProgress.current) {
        setTimeout(() => {
          console.log("[AuthContext] 🔄 Fetching user after deep link...");
          fetchUser();
        }, 500);
      }
    });

    // POLLING: Refresh session every 5 minutes to keep SecureStore token in sync
    const intervalId = setInterval(() => {
      if (!oauthInProgress.current) {
        console.log("[AuthContext] 🔄 Auto-refreshing user session (5min interval)...");
        fetchUser();
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
      
      console.log("[AuthContext] ❌ No user found, clearing state");
      setUser(null);
      if (!oauthInProgress.current) {
        console.log("[AuthContext] 🧹 Clearing auth tokens");
        await clearAuthTokens();
      }
    } catch (error: any) {
      console.error("[AuthContext] ❌ Failed to fetch user:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      setUser(null);
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
            return;
          }
          
          const { BACKEND_URL } = await import("@/utils/api");
          console.log("[AuthContext] 🔄 Exchanging better_auth_token for session...");
          console.log("[AuthContext] Backend URL:", BACKEND_URL);
          
          // Exchange better_auth_token for a session
          let sessionData: any = null;
          
          // Store the better_auth_token as Bearer token
          await setBearerToken(betterAuthToken);
          console.log("[AuthContext] 💾 Stored better_auth_token");
          
          // Wait a brief moment to ensure token is stored
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Try authClient.getSession() first - it uses the stored Bearer token
          try {
            console.log("[AuthContext] 📞 Trying authClient.getSession() with stored token...");
            const clientSession = await authClient.getSession();
            console.log("[AuthContext] 📊 authClient.getSession() result:", {
              hasUser: !!clientSession?.data?.user,
              hasError: !!clientSession?.error,
              errorMessage: clientSession?.error?.message || "none",
            });
            
            if (clientSession?.data?.user) {
              sessionData = {
                user: clientSession.data.user,
                session: clientSession.data.session,
              };
              console.log("[AuthContext] ✅ Got session from authClient.getSession()");
            }
          } catch (err: any) {
            console.warn("[AuthContext] ⚠️ authClient.getSession() threw error:", {
              message: err.message,
              name: err.name,
            });
          }
          
          // Fallback: Direct fetch to /api/auth/get-session with Bearer token
          if (!sessionData?.user) {
            try {
              console.log("[AuthContext] 📞 Trying direct fetch to /api/auth/get-session...");
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
              console.log("[AuthContext] 📊 /api/auth/get-session response:", {
                status: sessionResponse.status,
                ok: sessionResponse.ok,
                bodyLength: rawText.length,
                bodyPreview: rawText.substring(0, 200),
              });
              
              if (sessionResponse.ok && rawText) {
                try {
                  const parsed = JSON.parse(rawText);
                  if (parsed?.user) {
                    sessionData = parsed;
                    console.log("[AuthContext] ✅ Got session from /api/auth/get-session");
                  }
                } catch (parseErr: any) {
                  console.warn("[AuthContext] ⚠️ Failed to parse get-session response:", parseErr.message);
                }
              }
            } catch (err: any) {
              console.warn("[AuthContext] ⚠️ /api/auth/get-session fetch threw error:", {
                message: err.message,
                name: err.name,
              });
            }
          }
          
          // Fallback: Try /api/auth/me with Bearer token
          if (!sessionData?.user) {
            try {
              console.log("[AuthContext] 📞 Trying /api/auth/me as final fallback...");
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
              console.log("[AuthContext] 📊 /api/auth/me response:", {
                status: meResponse.status,
                ok: meResponse.ok,
                bodyLength: rawText.length,
                bodyPreview: rawText.substring(0, 200),
              });
              
              if (meResponse.ok && rawText) {
                try {
                  const parsed = JSON.parse(rawText);
                  if (parsed?.user) {
                    sessionData = parsed;
                    console.log("[AuthContext] ✅ Got session from /api/auth/me");
                  }
                } catch (parseErr: any) {
                  console.warn("[AuthContext] ⚠️ Failed to parse /api/auth/me response:", parseErr.message);
                }
              }
            } catch (err: any) {
              console.warn("[AuthContext] ⚠️ /api/auth/me fetch threw error:", {
                message: err.message,
                name: err.name,
              });
            }
          }
          
          if (!sessionData?.user) {
            console.error("[AuthContext] ❌ All session exchange attempts failed");
            // Clear the invalid token we stored
            await clearAuthTokens();
            throw new Error("Failed to establish session after OAuth. Please try signing in again.");
          }
          
          // Store the real session token (prefer session.token over better_auth_token)
          const tokenToStore = sessionData?.session?.token || betterAuthToken;
          console.log("[AuthContext] 💾 Storing final session token (length:", tokenToStore.length, ")");
          await setBearerToken(tokenToStore);
          
          // Update user state directly
          setUser(sessionData.user as User);
          console.log("[AuthContext] ✅ OAuth sign-in successful:", sessionData.user.email);
          
        } finally {
          oauthInProgress.current = false;
        }
      } else {
        // NATIVE (iOS/Android): Use Better Auth's native OAuth flow
        console.log("[AuthContext] 📱 Using native OAuth flow for", provider);
        oauthInProgress.current = true;
        
        try {
          // Generate the callback URL for deep linking
          const callbackURL = Linking.createURL("/");
          console.log("[AuthContext] 🔗 Native OAuth callback URL:", callbackURL);
          
          // Call Better Auth's social sign-in which will open the browser
          console.log("[AuthContext] 📞 Calling authClient.signIn.social()...");
          const startTime = Date.now();
          const result = await authClient.signIn.social({
            provider,
            callbackURL,
          });
          const duration = Date.now() - startTime;
          
          console.log("[AuthContext] 📊 Native OAuth result:", {
            duration: `${duration}ms`,
            hasResult: !!result,
          });
          
          // Wait a moment for the deep link to be processed
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Fetch the user session
          console.log("[AuthContext] 🔄 Fetching user after native OAuth...");
          await fetchUser();
          
          console.log("[AuthContext] ✅ Native OAuth completed, user:", user ? "authenticated" : "not authenticated");
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
    const { BACKEND_URL } = await import("@/utils/api");
    const callbackURL = `${window.location.origin}/auth-callback`;
    const redirectUrl = `${BACKEND_URL}/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(callbackURL)}`;
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

      const { BACKEND_URL } = await import("@/utils/api");
      
      const redirectTo = Platform.OS === "web"
        ? `${window.location.origin}/reset-password`
        : `${BACKEND_URL}/reset-password`;

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
      
      const { BACKEND_URL } = await import("@/utils/api");
      console.log("[AuthContext] 🔄 Trying direct fetch to /api/auth/reset-password...");
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
