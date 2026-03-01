
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { Platform, Alert } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useRouter, usePathname } from "expo-router";
import { authClient, setBearerToken, clearAuthTokens, getSessionWithBearerToken, API_URL } from "@/lib/auth";
import Toast from "react-native-toast-message";

// Complete the auth session for native OAuth flows
WebBrowser.maybeCompleteAuthSession();

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Maximum retries for session establishment after OAuth
const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 1000;

function openOAuthPopup(provider: string): Promise<{ token: string | null; user: any }> {
  return new Promise((resolve, reject) => {
    const popupUrl = `${window.location.origin}/auth-popup?provider=${provider}`;
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      popupUrl,
      "oauth-popup",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup) {
      reject(new Error("Failed to open popup. Please allow popups."));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "oauth-success") {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        resolve({ token: event.data.token || null, user: event.data.user || null });
      } else if (event.data?.type === "oauth-error") {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        reject(new Error(event.data.error || "OAuth failed"));
      }
    };

    window.addEventListener("message", handleMessage);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        reject(new Error("Authentication cancelled"));
      }
    }, 500);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const oauthInProgress = useRef(false);
  const lastOAuthAttempt = useRef<number>(0);
  const oauthTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUser = async () => {
    // Don't interfere with OAuth flow
    if (oauthInProgress.current) {
      console.log("⏸️ Skipping fetchUser - OAuth in progress");
      return;
    }

    try {
      setLoading(true);
      console.log("🔍 Fetching user session...");

      // Try Better Auth client first
      const session = await authClient.getSession();
      console.log("📦 Session response:", session?.data?.user ? `User found: ${session.data.user.email}` : "No user");

      if (session?.data?.user) {
        console.log("✅ User authenticated via authClient:", session.data.user.email);
        setUser(session.data.user as User);

        // Sync token to storage for utils/api.ts
        if (session.data.session?.token) {
          await setBearerToken(session.data.session.token);
          console.log("💾 Bearer token saved from session");
        }
        return;
      }

      // Try bearer token fallback
      console.log("🔄 Trying bearer token fallback...");
      const bearerSession = await getSessionWithBearerToken();
      if (bearerSession?.user) {
        console.log("✅ User authenticated via bearer token:", bearerSession.user.email);
        setUser(bearerSession.user as User);
        if (bearerSession.session?.token) {
          await setBearerToken(bearerSession.session.token);
        }
        return;
      }

      // No session found
      console.log("❌ No user session found");
      setUser(null);
      // Only clear tokens if not in OAuth flow
      if (!oauthInProgress.current) {
        await clearAuthTokens();
      }
    } catch (error) {
      console.error("❌ Failed to fetch user:", error);
      setUser(null);
      // Don't clear tokens on error - might be temporary network issue
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Skip auth check on callback pages to avoid consuming the token
    if (pathname === "/auth-callback" || pathname === "/auth-popup") {
      setLoading(false);
      return;
    }

    // Only fetch user on initial mount, not on every pathname change
    // This prevents interrupting navigation
    fetchUser();
  }, []); // Empty dependency array - only run once on mount

  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log("📧 Signing in with email:", email);
      const result = await authClient.signIn.email({ email, password });
      console.log("📧 Email sign in result:", result?.data ? "Success" : "Failed");

      // Save token if returned directly
      if ((result?.data as any)?.token) {
        await setBearerToken((result.data as any).token);
      }

      await fetchUser();
      Toast.show({
        type: "success",
        text1: "Welcome back!",
        text2: "You've successfully signed in.",
      });
    } catch (error: any) {
      console.error("❌ Email sign in failed:", error);
      Toast.show({
        type: "error",
        text1: "Sign In Failed",
        text2: error.message || "Please check your credentials and try again.",
      });
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      console.log("📝 Signing up with email:", email);
      const result = await authClient.signUp.email({
        email,
        password,
        name,
      });
      console.log("📝 Email sign up result:", result?.data ? "Success" : "Failed");

      // Save token if returned directly
      if ((result?.data as any)?.token) {
        await setBearerToken((result.data as any).token);
      }

      await fetchUser();
      Toast.show({
        type: "success",
        text1: "Account Created!",
        text2: "Welcome to Cheshbon.",
      });
    } catch (error: any) {
      console.error("❌ Email sign up failed:", error);
      Toast.show({
        type: "error",
        text1: "Sign Up Failed",
        text2: error.message || "Please try again.",
      });
      throw error;
    }
  };

  const signInWithSocial = async (provider: "google" | "apple" | "github") => {
    // Prevent multiple simultaneous OAuth attempts
    const now = Date.now();
    if (oauthInProgress.current) {
      console.log(`⏸️ OAuth already in progress, ignoring ${provider} sign in request`);
      Toast.show({
        type: "info",
        text1: "Please wait",
        text2: "Authentication is already in progress.",
      });
      return;
    }

    // Prevent rapid successive attempts (debounce) - iOS needs shorter debounce
    const debounceTime = Platform.OS === "ios" ? 1000 : (Platform.OS === "android" ? 3000 : 2000);
    if (now - lastOAuthAttempt.current < debounceTime) {
      console.log(`⏸️ Too soon after last OAuth attempt (${now - lastOAuthAttempt.current}ms), ignoring ${provider} sign in request`);
      Toast.show({
        type: "info",
        text1: "Please wait",
        text2: "Please wait a moment before trying again.",
      });
      return;
    }

    lastOAuthAttempt.current = now;
    oauthInProgress.current = true;
    console.log(`🔐 [${provider.toUpperCase()}] OAuth flag set to true`);
    console.log(`🔐 [${provider.toUpperCase()}] Platform: ${Platform.OS}`);
    console.log(`🔐 [${provider.toUpperCase()}] API URL: ${API_URL}`);
    
    // Safety timeout: Reset OAuth flag after 2 minutes if it gets stuck
    if (oauthTimeoutRef.current) {
      clearTimeout(oauthTimeoutRef.current);
    }
    oauthTimeoutRef.current = setTimeout(() => {
      if (oauthInProgress.current) {
        console.warn(`⚠️ [${provider.toUpperCase()}] OAuth timeout - resetting stuck flag`);
        oauthInProgress.current = false;
        Toast.show({
          type: "error",
          text1: "Authentication Timeout",
          text2: "The authentication process took too long. Please try again.",
        });
      }
    }, 120000); // 2 minutes
    
    try {
      console.log(`🔐 [${provider.toUpperCase()}] Starting OAuth flow...`);

      if (Platform.OS === "web") {
        // Web: Use popup flow
        console.log(`🌐 [${provider.toUpperCase()}] Using web popup flow`);
        const { token, user: oauthUser } = await openOAuthPopup(provider);
        console.log(`🌐 [${provider.toUpperCase()}] Popup returned - Token: ${token ? "present" : "missing"}, User: ${oauthUser ? "present" : "missing"}`);
        
        if (token) {
          console.log(`💾 [${provider.toUpperCase()}] Saving bearer token...`);
          await setBearerToken(token);
        }

        // Retry session establishment
        let sessionEstablished = false;
        for (let i = 0; i < MAX_RETRIES && !sessionEstablished; i++) {
          console.log(`🔄 [${provider.toUpperCase()}] Attempting to establish session (${i + 1}/${MAX_RETRIES})...`);
          const session = await authClient.getSession();
          if (session?.data?.user) {
            setUser(session.data.user as User);
            sessionEstablished = true;
            console.log(`✅ [${provider.toUpperCase()}] Session established successfully`);
            break;
          }
          if (i < MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS * (i + 1)));
          }
        }

        if (!sessionEstablished) {
          console.error(`❌ [${provider.toUpperCase()}] Could not establish session after ${MAX_RETRIES} retries`);
          throw new Error("Session establishment failed: Could not verify authentication. Please try again.");
        }

        Toast.show({
          type: "success",
          text1: "Welcome!",
          text2: `Signed in with ${provider}.`,
        });
        router.replace("/(tabs)/(home)");
      } else {
        // Native (iOS / Android): Use WebBrowser for OAuth
        const isIOS = Platform.OS === "ios";
        const isAndroid = Platform.OS === "android";
        
        console.log(`📱 [${provider.toUpperCase()}] Using native WebBrowser flow`);
        console.log(`📱 [${provider.toUpperCase()}] iOS: ${isIOS}, Android: ${isAndroid}`);
        
        // CRITICAL: Ensure any previous browser session is dismissed first
        try {
          console.log(`🧹 [${provider.toUpperCase()}] Attempting to dismiss any previous browser session...`);
          await WebBrowser.dismissBrowser();
          console.log(`✅ [${provider.toUpperCase()}] Previous browser session dismissed successfully`);
          
          // Platform-specific cleanup delays
          const cleanupDelay = isAndroid ? 800 : (isIOS ? 500 : 300);
          console.log(`⏳ [${provider.toUpperCase()}] Waiting ${cleanupDelay}ms for cleanup...`);
          await new Promise(resolve => setTimeout(resolve, cleanupDelay));
        } catch (dismissError: any) {
          // This is expected if no browser was open
          console.log(`ℹ️ [${provider.toUpperCase()}] No previous browser session to dismiss:`, dismissError.message);
          
          // Platform-specific wait times even when no browser was open
          if (isAndroid) {
            await new Promise(resolve => setTimeout(resolve, 500));
          } else if (isIOS) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        // Construct the native callback URL
        const nativeCallbackURL = Linking.createURL("/auth-callback");
        console.log(`📱 [${provider.toUpperCase()}] Native callback URL: ${nativeCallbackURL}`);

        // Show user feedback
        Toast.show({
          type: "info",
          text1: "Opening browser...",
          text2: `Sign in with ${provider}`,
          visibilityTime: 3000,
        });

        // CRITICAL FIX: Construct the OAuth URL directly
        // The Better Auth endpoint expects: /api/auth/sign-in/social?provider=X&callbackURL=Y
        const oauthUrl = `${API_URL}/api/auth/sign-in/social?provider=${provider}&callbackURL=${encodeURIComponent(nativeCallbackURL)}`;
        console.log(`📱 [${provider.toUpperCase()}] OAuth URL: ${oauthUrl}`);
        console.log(`📱 [${provider.toUpperCase()}] Opening OAuth URL in browser...`);
        
        // Platform-specific: Add extra safeguard with try-catch
        let browserResult;
        try {
          console.log(`🌐 [${provider.toUpperCase()}] Calling WebBrowser.openAuthSessionAsync...`);
          browserResult = await WebBrowser.openAuthSessionAsync(
            oauthUrl,
            nativeCallbackURL
          );
          console.log(`📱 [${provider.toUpperCase()}] Browser session completed`);
          console.log(`📱 [${provider.toUpperCase()}] Browser result:`, JSON.stringify(browserResult, null, 2));
        } catch (browserError: any) {
          console.error(`❌ [${provider.toUpperCase()}] WebBrowser error:`, browserError);
          console.error(`❌ [${provider.toUpperCase()}] Error message:`, browserError.message);
          console.error(`❌ [${provider.toUpperCase()}] Error code:`, browserError.code);
          console.error(`❌ [${provider.toUpperCase()}] Error stack:`, browserError.stack);
          
          // Check if it's the "already open" error (common on Android and iOS)
          if (
            browserError.message?.toLowerCase().includes("webbrowser") && 
            (browserError.message?.toLowerCase().includes("already open") ||
             browserError.message?.toLowerCase().includes("in progress"))
          ) {
            console.error(`❌ [${provider.toUpperCase()}] WebBrowser already open - forcing cleanup and retry`);
            
            // Force dismiss and retry once
            try {
              await WebBrowser.dismissBrowser();
              const retryDelay = isAndroid ? 1000 : (isIOS ? 800 : 500);
              console.log(`⏳ [${provider.toUpperCase()}] Waiting ${retryDelay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              
              console.log(`🔄 [${provider.toUpperCase()}] Retrying browser open after cleanup...`);
              browserResult = await WebBrowser.openAuthSessionAsync(
                oauthUrl,
                nativeCallbackURL
              );
            } catch (retryError: any) {
              console.error(`❌ [${provider.toUpperCase()}] Retry failed:`, retryError);
              throw new Error("Browser is busy. Please close any open browser windows and try again.");
            }
          } else {
            // Re-throw the original error
            throw browserError;
          }
        }

        console.log(`📱 [${provider.toUpperCase()}] Browser result type: ${browserResult.type}`);
        if (browserResult.url) {
          console.log(`📱 [${provider.toUpperCase()}] Browser result URL: ${browserResult.url}`);
        }

        if (browserResult.type === "success" && browserResult.url) {
          console.log(`📱 [${provider.toUpperCase()}] Browser redirect URL received`);

          // CRITICAL FIX: Extract token from the redirect URL
          // Better Auth may return the token in different parameter names
          const url = new URL(browserResult.url);
          const token = 
            url.searchParams.get("token") ||
            url.searchParams.get("better_auth_token") ||
            url.searchParams.get("session_token") ||
            url.searchParams.get("access_token");

          console.log(`📱 [${provider.toUpperCase()}] Token extraction - Found: ${token ? "YES" : "NO"}`);
          console.log(`📱 [${provider.toUpperCase()}] URL search params:`, Array.from(url.searchParams.entries()));

          if (token) {
            console.log(`💾 [${provider.toUpperCase()}] Saving bearer token...`);
            await setBearerToken(token);
            console.log(`✅ [${provider.toUpperCase()}] Bearer token saved`);
            
            // Give the backend a moment to process
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.warn(`⚠️ [${provider.toUpperCase()}] No token found in redirect URL - will try session establishment anyway`);
          }

          // CRITICAL FIX: Retry session establishment with exponential backoff
          let sessionEstablished = false;
          for (let i = 0; i < MAX_RETRIES && !sessionEstablished; i++) {
            console.log(`🔄 [${provider.toUpperCase()}] Attempting to establish session (${i + 1}/${MAX_RETRIES})...`);
            
            // Try Better Auth client first
            try {
              const session = await authClient.getSession();
              console.log(`📦 [${provider.toUpperCase()}] authClient.getSession() response:`, session?.data?.user ? "User found" : "No user");
              
              if (session?.data?.user) {
                setUser(session.data.user as User);
                sessionEstablished = true;
                console.log(`✅ [${provider.toUpperCase()}] Session established via authClient`);
                
                // Save the session token if available
                if (session.data.session?.token) {
                  await setBearerToken(session.data.session.token);
                  console.log(`💾 [${provider.toUpperCase()}] Session token saved`);
                }
                break;
              }
            } catch (sessionError) {
              console.warn(`⚠️ [${provider.toUpperCase()}] authClient.getSession() failed:`, sessionError);
            }

            // Try bearer token fallback
            try {
              console.log(`🔄 [${provider.toUpperCase()}] Trying bearer token fallback...`);
              const bearerSession = await getSessionWithBearerToken();
              console.log(`📦 [${provider.toUpperCase()}] Bearer token session response:`, bearerSession?.user ? "User found" : "No user");
              
              if (bearerSession?.user) {
                setUser(bearerSession.user as User);
                sessionEstablished = true;
                console.log(`✅ [${provider.toUpperCase()}] Session established via bearer token`);
                
                if (bearerSession.session?.token) {
                  await setBearerToken(bearerSession.session.token);
                }
                break;
              }
            } catch (bearerError) {
              console.warn(`⚠️ [${provider.toUpperCase()}] Bearer token session failed:`, bearerError);
            }

            if (i < MAX_RETRIES - 1) {
              const delay = RETRY_INTERVAL_MS * (i + 1);
              console.log(`⏳ [${provider.toUpperCase()}] Waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }

          if (!sessionEstablished) {
            console.error(`❌ [${provider.toUpperCase()}] Could not establish session after ${MAX_RETRIES} retries`);
            console.error(`❌ [${provider.toUpperCase()}] This usually means:`);
            console.error(`   1. The OAuth provider is not configured on the backend`);
            console.error(`   2. The redirect URL doesn't match the backend configuration`);
            console.error(`   3. The backend didn't return a valid token`);
            throw new Error(`Session establishment failed: Could not verify ${provider} authentication. Please check your OAuth configuration.`);
          }

          Toast.show({
            type: "success",
            text1: "Welcome!",
            text2: `Signed in with ${provider}.`,
          });
          router.replace("/(tabs)/(home)");
        } else if (browserResult.type === "cancel" || browserResult.type === "dismiss") {
          console.log(`ℹ️ [${provider.toUpperCase()}] OAuth browser was dismissed by user`);
          // User cancelled - no error toast needed, just reset the flag
          return;
        } else {
          console.log(`⚠️ [${provider.toUpperCase()}] Unexpected browser result type: ${(browserResult as any).type}`);
          throw new Error("Authentication was not completed");
        }
      }
    } catch (error: any) {
      console.error(`❌ [${provider.toUpperCase()}] OAuth flow failed:`, error);
      console.error(`❌ [${provider.toUpperCase()}] Error details:`, {
        message: error.message,
        code: error.code,
        stack: error.stack
      });

      // Don't show error for user cancellation
      if (
        error.message?.includes("cancelled") ||
        error.message?.includes("canceled") ||
        error.message?.includes("dismissed")
      ) {
        console.log(`ℹ️ [${provider.toUpperCase()}] Sign in was cancelled by user`);
        return;
      }

      // Check for "WebBrowser already open" error - this is the Android issue
      if (
        error.message?.toLowerCase().includes("webbrowser") && 
        error.message?.toLowerCase().includes("already open")
      ) {
        console.error(`❌ [${provider.toUpperCase()}] WebBrowser already open error detected - attempting recovery`);
        Toast.show({
          type: "error",
          text1: "Browser Busy",
          text2: "Please close any open browser windows and try again.",
        });
        // Force dismiss any lingering browser
        try {
          await WebBrowser.dismissBrowser();
          console.log(`✅ [${provider.toUpperCase()}] Force dismissed lingering browser`);
          // Wait longer on Android
          if (Platform.OS === "android") {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (dismissErr) {
          console.log(`⚠️ [${provider.toUpperCase()}] Could not force dismiss browser:`, dismissErr);
        }
        return;
      }

      // Check for "Browser is busy" error from our retry logic
      if (error.message?.toLowerCase().includes("browser is busy")) {
        Toast.show({
          type: "error",
          text1: "Browser Busy",
          text2: error.message,
        });
        return;
      }

      // Check for specific error types
      if (error.response?.status === 404 || error.message?.includes("404")) {
        Toast.show({
          type: "error",
          text1: "OAuth Not Configured",
          text2: `${provider} sign-in is not configured on this server. Please contact support.`,
        });
      } else if (error.message?.includes("popup")) {
        Toast.show({
          type: "error",
          text1: "Popup Blocked",
          text2: "Please allow popups for this site and try again.",
        });
      } else if (error.message?.includes("Session establishment failed")) {
        Toast.show({
          type: "error",
          text1: "Authentication Failed",
          text2: error.message,
        });
      } else {
        Toast.show({
          type: "error",
          text1: "Sign In Failed",
          text2: error.message || `Failed to sign in with ${provider}. Please try again.`,
        });
      }
      throw error;
    } finally {
      // Always reset the OAuth flag, even on error
      console.log(`🔓 [${provider.toUpperCase()}] OAuth flag reset to false`);
      oauthInProgress.current = false;
      
      // Clear the safety timeout
      if (oauthTimeoutRef.current) {
        clearTimeout(oauthTimeoutRef.current);
        oauthTimeoutRef.current = null;
      }
    }
  };

  const signInWithGoogle = () => signInWithSocial("google");
  const signInWithApple = () => signInWithSocial("apple");
  const signInWithGitHub = () => signInWithSocial("github");

  const signOut = async () => {
    try {
      console.log("👋 Signing out...");
      await authClient.signOut();
      Toast.show({
        type: "success",
        text1: "Signed Out",
        text2: "You've been successfully signed out.",
      });
    } catch (error) {
      console.error("❌ Sign out failed (API):", error);
    } finally {
      // Always clear local state immediately
      setUser(null);
      await clearAuthTokens();
      router.replace("/auth");
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
