
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { Platform } from "react-native";
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
  setUser: (user: User | null) => void;
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

  const fetchUser = async () => {
    // Don't interfere with OAuth flow
    if (oauthInProgress.current) {
      console.log("⏸️ Skipping fetchUser - OAuth in progress");
      return;
    }

    try {
      setLoading(true);
      console.log("🔍 Fetching user session...");
      console.log("🔍 API_URL:", API_URL);

      // Try bearer token first (most reliable cross-platform method)
      console.log("🔄 Trying bearer token session check...");
      const bearerSession = await getSessionWithBearerToken();
      if (bearerSession?.user) {
        console.log("✅ User authenticated via bearer token:", bearerSession.user.email);
        setUser(bearerSession.user as User);
        // Refresh the token if a newer one is returned
        if (bearerSession.session?.token) {
          await setBearerToken(bearerSession.session.token);
          console.log("💾 Bearer token refreshed from session");
        }
        return;
      }

      // Try Better Auth client as fallback
      console.log("🔄 Trying authClient.getSession...");
      try {
        const session = await authClient.getSession();
        console.log("📦 Session response:", session?.data?.user ? `User found: ${session.data.user.email}` : "No user");

        if (session?.data?.user) {
          console.log("✅ User authenticated via authClient:", session.data.user.email);
          setUser(session.data.user as User);

          // Sync token to storage for utils/api.ts
          if (session.data.session?.token) {
            await setBearerToken(session.data.session.token);
            console.log("💾 Bearer token saved from authClient session");
          }
          return;
        }
      } catch (authClientError) {
        console.warn("⚠️ authClient.getSession failed:", authClientError);
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
      console.log("📧 API_URL:", API_URL);
      const result = await authClient.signIn.email({ email, password });
      console.log("📧 Email sign in result:", JSON.stringify(result?.data || result?.error || "no data"));

      // Extract token from all possible locations in the response
      const data = result?.data as any;
      const token =
        data?.token ||
        data?.session?.token ||
        data?.user?.token ||
        (result as any)?.token;

      if (token) {
        await setBearerToken(token);
        console.log("💾 Token saved from email sign in:", token.substring(0, 20) + "...");
      } else {
        console.warn("⚠️ No token found in email sign in response, trying getSession...");
        // Try to get session directly after sign in
        try {
          const session = await authClient.getSession();
          if (session?.data?.session?.token) {
            await setBearerToken(session.data.session.token);
            console.log("💾 Token saved from getSession after email sign in");
          }
        } catch (sessionErr) {
          console.warn("⚠️ getSession after email sign in failed:", sessionErr);
        }
      }

      // Check for errors in the result
      if (result?.error) {
        const errMsg = (result.error as any)?.message || String(result.error);
        console.error("❌ Email sign in error from server:", errMsg);
        throw new Error(errMsg);
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
      console.log("📝 API_URL:", API_URL);
      const result = await authClient.signUp.email({
        email,
        password,
        name: name || email.split("@")[0],
      });
      console.log("📝 Email sign up result:", JSON.stringify(result?.data || result?.error || "no data"));

      // Extract token from all possible locations in the response
      const data = result?.data as any;
      const token =
        data?.token ||
        data?.session?.token ||
        data?.user?.token ||
        (result as any)?.token;

      if (token) {
        await setBearerToken(token);
        console.log("💾 Token saved from email sign up:", token.substring(0, 20) + "...");
      } else {
        console.warn("⚠️ No token found in email sign up response, trying getSession...");
        try {
          const session = await authClient.getSession();
          if (session?.data?.session?.token) {
            await setBearerToken(session.data.session.token);
            console.log("💾 Token saved from getSession after email sign up");
          }
        } catch (sessionErr) {
          console.warn("⚠️ getSession after email sign up failed:", sessionErr);
        }
      }

      // Check for errors in the result
      if (result?.error) {
        const errMsg = (result.error as any)?.message || String(result.error);
        console.error("❌ Email sign up error from server:", errMsg);
        throw new Error(errMsg);
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
      console.log(`⏸️ [${provider.toUpperCase()}] OAuth already in progress, ignoring sign in request`);
      Toast.show({
        type: "info",
        text1: "Please wait",
        text2: "Authentication is already in progress.",
      });
      return;
    }

    // Prevent rapid successive attempts (debounce) - longer on Android
    const debounceTime = Platform.OS === "android" ? 3000 : 2000;
    if (now - lastOAuthAttempt.current < debounceTime) {
      console.log(`⏸️ [${provider.toUpperCase()}] Too soon after last OAuth attempt (${now - lastOAuthAttempt.current}ms), ignoring sign in request`);
      Toast.show({
        type: "info",
        text1: "Please wait",
        text2: "Please wait a moment before trying again.",
      });
      return;
    }

    lastOAuthAttempt.current = now;
    oauthInProgress.current = true;
    
    // Safety timeout to reset flag if something goes wrong
    const safetyTimeout = setTimeout(() => {
      if (oauthInProgress.current) {
        console.log(`⚠️ [${provider.toUpperCase()}] Safety timeout triggered - resetting OAuth flag`);
        oauthInProgress.current = false;
      }
    }, 120000); // 2 minutes
    
    try {
      console.log(`🔐 [${provider.toUpperCase()}] Starting sign in on platform: ${Platform.OS}`);
      console.log(`🔐 [${provider.toUpperCase()}] API_URL: ${API_URL}`);

      if (Platform.OS === "web") {
        // Web: Use popup flow
        console.log(`🌐 [${provider.toUpperCase()}] Opening OAuth popup...`);
        const { token, user: oauthUser } = await openOAuthPopup(provider);
        
        if (token) {
          console.log(`💾 [${provider.toUpperCase()}] Saving token from popup...`);
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
          throw new Error("Could not establish session. Please try again.");
        }

        Toast.show({
          type: "success",
          text1: "Welcome!",
          text2: `Signed in with ${provider}.`,
        });
        router.replace("/(tabs)/(home)");
      } else {
        // Native (iOS / Android): Use WebBrowser for OAuth
        console.log(`📱 [${provider.toUpperCase()}] Starting native OAuth flow...`);
        
        // CRITICAL: Ensure any previous browser session is dismissed first
        const isAndroid = Platform.OS === "android";
        
        try {
          console.log(`🧹 [${provider.toUpperCase()}] Attempting to dismiss any previous browser session...`);
          await WebBrowser.dismissBrowser();
          console.log(`✅ [${provider.toUpperCase()}] Previous browser session dismissed successfully`);
          
          // Android needs longer wait time for cleanup
          const cleanupDelay = isAndroid ? 1000 : 500;
          console.log(`⏳ [${provider.toUpperCase()}] Waiting ${cleanupDelay}ms for cleanup...`);
          await new Promise(resolve => setTimeout(resolve, cleanupDelay));
        } catch (dismissError: any) {
          // This is expected if no browser was open
          console.log(`ℹ️ [${provider.toUpperCase()}] No previous browser session to dismiss:`, dismissError.message);
          
          // On Android, still wait a bit to ensure state is clean
          if (isAndroid) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Create the callback URL using the app scheme
        // IMPORTANT: Use lowercase "cheshbon" - must match CFBundleURLSchemes in iOS and intentFilters in Android
        const nativeCallbackURL = `cheshbon://auth-callback`;
        console.log(`📱 [${provider.toUpperCase()}] Native OAuth callbackURL: ${nativeCallbackURL}`);

        // Use the /api/auth/sign-in/social-v1 endpoint to get the OAuth authorization URL.
        // This endpoint returns the actual OAuth provider URL (Google/Apple authorization URL).
        // The callbackURL tells the OAuth provider where to redirect after authentication.
        console.log(`📱 [${provider.toUpperCase()}] Requesting OAuth authorization URL from backend...`);
        let oauthUrl: string;
        try {
          // Try /api/auth/sign-in/social-v1 first (returns authorizationUrl directly)
          const socialV1Response = await fetch(
            `${API_URL}/api/auth/sign-in/social-v1?provider=${provider}&callbackURL=${encodeURIComponent(nativeCallbackURL)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ provider, callbackURL: nativeCallbackURL }),
            }
          );
          if (socialV1Response.ok) {
            const socialV1Data = await socialV1Response.json();
            if (socialV1Data.authorizationUrl) {
              oauthUrl = socialV1Data.authorizationUrl;
              console.log(`📱 [${provider.toUpperCase()}] Got authorization URL from social-v1: ${oauthUrl.substring(0, 80)}...`);
            } else {
              throw new Error("No authorizationUrl in social-v1 response");
            }
          } else {
            const errText = await socialV1Response.text();
            console.warn(`📱 [${provider.toUpperCase()}] social-v1 failed (${socialV1Response.status}): ${errText}`);
            throw new Error(`social-v1 returned ${socialV1Response.status}`);
          }
        } catch (socialV1Error) {
          console.warn(`📱 [${provider.toUpperCase()}] social-v1 failed, trying oauth-start:`, socialV1Error);
          try {
            // Fallback: try /api/auth/oauth-start
            const oauthStartResponse = await fetch(`${API_URL}/api/auth/oauth-start`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ provider, callbackUrl: nativeCallbackURL }),
            });
            if (oauthStartResponse.ok) {
              const oauthStartData = await oauthStartResponse.json();
              if (oauthStartData.authorizationUrl) {
                oauthUrl = oauthStartData.authorizationUrl;
                console.log(`📱 [${provider.toUpperCase()}] Got authorization URL from oauth-start: ${oauthUrl.substring(0, 80)}...`);
              } else {
                throw new Error("No authorizationUrl in oauth-start response");
              }
            } else {
              throw new Error(`oauth-start returned ${oauthStartResponse.status}`);
            }
          } catch (oauthStartError) {
            console.warn(`📱 [${provider.toUpperCase()}] oauth-start also failed, using direct Better Auth endpoint:`, oauthStartError);
            // Last resort: use the Better Auth direct endpoint
            oauthUrl = `${API_URL}/api/auth/sign-in/social?provider=${provider}&callbackURL=${encodeURIComponent(nativeCallbackURL)}`;
          }
        }
        console.log(`📱 [${provider.toUpperCase()}] OAuth URL: ${oauthUrl}`);

        Toast.show({
          type: "info",
          text1: "Opening browser...",
          text2: `Sign in with ${provider}`,
          visibilityTime: 3000,
        });

        console.log(`📱 [${provider.toUpperCase()}] Opening OAuth URL in browser...`);

        // Helper to extract token from a deep link URL
        const extractTokenFromUrl = (urlStr: string): string | null => {
          try {
            let params: URLSearchParams;
            try {
              const parsed = new URL(urlStr);
              params = parsed.searchParams;
            } catch {
              const queryStart = urlStr.indexOf("?");
              params = new URLSearchParams(queryStart >= 0 ? urlStr.slice(queryStart + 1) : "");
            }
            return (
              params.get("token") ||
              params.get("better_auth_token") ||
              params.get("session_token") ||
              params.get("access_token")
            );
          } catch {
            return null;
          }
        };

        // Helper to establish session from a token
        const establishSessionFromToken = async (token: string): Promise<boolean> => {
          console.log(`💾 [${provider.toUpperCase()}] Saving token...`);
          await setBearerToken(token);

          // Give the backend a moment to process
          await new Promise(resolve => setTimeout(resolve, 800));

          for (let i = 0; i < MAX_RETRIES; i++) {
            console.log(`🔄 [${provider.toUpperCase()}] Attempting to establish session (${i + 1}/${MAX_RETRIES})...`);

            try {
              const session = await authClient.getSession();
              if (session?.data?.user) {
                setUser(session.data.user as User);
                console.log(`✅ [${provider.toUpperCase()}] Session established via authClient`);
                return true;
              }
            } catch (sessionError) {
              console.warn(`⚠️ [${provider.toUpperCase()}] authClient.getSession failed:`, sessionError);
            }

            try {
              const bearerSession = await getSessionWithBearerToken();
              if (bearerSession?.user) {
                setUser(bearerSession.user as User);
                console.log(`✅ [${provider.toUpperCase()}] Session established via bearer token`);
                return true;
              }
            } catch (bearerError) {
              console.warn(`⚠️ [${provider.toUpperCase()}] Bearer token session failed:`, bearerError);
            }

            if (i < MAX_RETRIES - 1) {
              const delay = RETRY_INTERVAL_MS * Math.pow(2, i);
              console.log(`⏳ [${provider.toUpperCase()}] Waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
          return false;
        };

        // On Android, WebBrowser.openAuthSessionAsync may return "dismiss" even when
        // the OAuth flow succeeded (because Chrome Custom Tabs doesn't always intercept
        // custom scheme redirects). We use Linking.addEventListener as a fallback to
        // catch the deep link when it arrives.
        let deepLinkToken: string | null = null;
        let deepLinkResolve: ((token: string | null) => void) | null = null;

        const deepLinkPromise = new Promise<string | null>((resolve) => {
          deepLinkResolve = resolve;
        });

        // Set up deep link listener BEFORE opening the browser
        const linkingSubscription = Linking.addEventListener("url", (event) => {
          console.log(`📱 [${provider.toUpperCase()}] Deep link received via Linking listener:`, event.url);
          if (event.url && event.url.startsWith("cheshbon://auth-callback")) {
            const token = extractTokenFromUrl(event.url);
            console.log(`📱 [${provider.toUpperCase()}] Token from deep link: ${token ? "found" : "not found"}`);
            deepLinkToken = token;
            if (deepLinkResolve) {
              deepLinkResolve(token);
            }
          }
        });

        let browserResult;
        try {
          browserResult = await WebBrowser.openAuthSessionAsync(
            oauthUrl,
            nativeCallbackURL,
            {
              showInRecents: false,
            }
          );
        } catch (browserError: any) {
          linkingSubscription.remove();
          console.error(`❌ [${provider.toUpperCase()}] WebBrowser error:`, browserError);

          if (
            browserError.message?.toLowerCase().includes("webbrowser") &&
            (browserError.message?.toLowerCase().includes("already open") ||
              browserError.message?.toLowerCase().includes("busy"))
          ) {
            console.error(`❌ [${provider.toUpperCase()}] WebBrowser already open - forcing cleanup and retry`);
            try {
              await WebBrowser.dismissBrowser();
              await new Promise(resolve => setTimeout(resolve, 1500));
              console.log(`🔄 [${provider.toUpperCase()}] Retrying browser open after cleanup...`);
              browserResult = await WebBrowser.openAuthSessionAsync(
                oauthUrl,
                nativeCallbackURL,
                { showInRecents: false }
              );
            } catch (retryError: any) {
              console.error(`❌ [${provider.toUpperCase()}] Retry failed:`, retryError);
              throw new Error("Browser is busy. Please close any open browser windows and try again.");
            }
          } else {
            throw browserError;
          }
        }

        // Remove the Linking listener after browser closes
        linkingSubscription.remove();

        console.log(`📱 [${provider.toUpperCase()}] Browser result type: ${browserResult.type}`);

        // Try to get token from browser result URL first
        let token: string | null = null;

        if (browserResult.type === "success" && browserResult.url) {
          console.log(`📱 [${provider.toUpperCase()}] Browser redirect URL received: ${browserResult.url}`);
          token = extractTokenFromUrl(browserResult.url);
          console.log(`📱 [${provider.toUpperCase()}] Token from browser result: ${token ? "found" : "not found"}`);
        }

        // If no token from browser result, check if deep link listener caught it
        if (!token && deepLinkToken) {
          console.log(`📱 [${provider.toUpperCase()}] Using token from deep link listener`);
          token = deepLinkToken;
        }

        // If still no token but browser was dismissed (Android issue), wait briefly for deep link
        if (!token && (browserResult.type === "cancel" || browserResult.type === "dismiss")) {
          console.log(`📱 [${provider.toUpperCase()}] Browser dismissed - waiting for deep link (Android fallback)...`);
          // Wait up to 3 seconds for the deep link to arrive
          const timeoutPromise = new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 3000));
          token = await Promise.race([deepLinkPromise, timeoutPromise]);
          console.log(`📱 [${provider.toUpperCase()}] Deep link wait result: ${token ? "token found" : "no token"}`);
        }

        if (token) {
          const sessionEstablished = await establishSessionFromToken(token);

          if (!sessionEstablished) {
            console.error(`❌ [${provider.toUpperCase()}] Could not establish session after ${MAX_RETRIES} attempts`);
            throw new Error("Could not establish session. Please try again.");
          }

          Toast.show({
            type: "success",
            text1: "Welcome!",
            text2: `Signed in with ${provider}.`,
          });
          router.replace("/(tabs)/(home)");
        } else if (browserResult.type === "cancel" || browserResult.type === "dismiss") {
          console.log(`ℹ️ [${provider.toUpperCase()}] OAuth browser was dismissed by user`);
          // User cancelled - no error toast needed
        } else {
          console.log(`⚠️ [${provider.toUpperCase()}] No token received. Browser result: ${(browserResult as any).type}`);
          if (browserResult.type === "success") {
            throw new Error("No authentication token received from server. Please try again.");
          }
          // For other cases (cancel/dismiss without token), silently ignore
        }
      }
    } catch (error: any) {
      console.error(`❌ [${provider.toUpperCase()}] Sign in failed:`, error);
      console.error(`❌ [${provider.toUpperCase()}] Error stack:`, error.stack);

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
        (error.message?.toLowerCase().includes("already open") ||
         error.message?.toLowerCase().includes("busy"))
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

      // Check for specific error types
      if (error.response?.status === 404 || error.message?.includes("404")) {
        Toast.show({
          type: "error",
          text1: "OAuth Not Configured",
          text2: `${provider} sign-in is not configured on this server. Please use email/password.`,
        });
      } else if (error.message?.includes("popup")) {
        Toast.show({
          type: "error",
          text1: "Popup Blocked",
          text2: "Please allow popups for this site and try again.",
        });
      } else if (error.message?.includes("No authentication token")) {
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
      clearTimeout(safetyTimeout);
      oauthInProgress.current = false;
      console.log(`🏁 [${provider.toUpperCase()}] OAuth flow finished, flag reset`);
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
        setUser,
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
