
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
import { authClient, setBearerToken, clearAuthTokens } from "@/lib/auth";
import Toast from "react-native-toast-message";



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

function openOAuthPopup(provider: string): Promise<string> {
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
      if (event.data?.type === "oauth-success" && event.data?.token) {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        resolve(event.data.token);
      } else if (event.data?.type === "oauth-success-cookie") {
        // Session established via cookie - no token in URL
        // Return empty string to signal success; caller will use getSession()
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        resolve("__cookie_session__");
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

/**
 * Extract token from a deep link URL.
 * Better Auth / expoClient redirects back with:
 *   cheshbon://?token=<session_token>
 *   cheshbon:///(tabs)/(home)?token=<session_token>
 *   cheshbon://?better_auth_token=<session_token>
 */
function extractTokenFromUrl(url: string): string | null {
  try {
    // Try parsing as a URL first
    const parsed = new URL(url);
    const token =
      parsed.searchParams.get("token") ||
      parsed.searchParams.get("better_auth_token") ||
      parsed.searchParams.get("session_token");
    if (token) return token;

    // Fallback: manual query string parsing for custom schemes
    const queryIndex = url.indexOf("?");
    if (queryIndex === -1) return null;
    const queryString = url.slice(queryIndex + 1);
    const params = new URLSearchParams(queryString);
    return (
      params.get("token") ||
      params.get("better_auth_token") ||
      params.get("session_token")
    );
  } catch {
    // URL constructor may fail for custom schemes on some platforms
    const queryIndex = url.indexOf("?");
    if (queryIndex === -1) return null;
    const queryString = url.slice(queryIndex + 1);
    const params = new URLSearchParams(queryString);
    return (
      params.get("token") ||
      params.get("better_auth_token") ||
      params.get("session_token")
    );
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const oauthInProgress = useRef(false);
  const fetchUserRef = useRef<() => Promise<void>>();

  const fetchUser = async () => {
    try {
      setLoading(true);
      console.log("🔍 Fetching user session...");

      const session = await authClient.getSession();
      console.log("📦 Session response:", JSON.stringify(session?.data));

      if (session?.data?.user) {
        console.log("✅ User authenticated:", session.data.user.email);
        setUser(session.data.user as User);

        // Sync token to SecureStore / localStorage for utils/api.ts
        if (session.data.session?.token) {
          await setBearerToken(session.data.session.token);
          console.log("💾 Bearer token saved from session");
        }
      } else {
        console.log("❌ No user session found");
        setUser(null);
        await clearAuthTokens();
      }
    } catch (error) {
      console.error("❌ Failed to fetch user:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Keep a ref so the deep link handler always has the latest version
  fetchUserRef.current = fetchUser;

  useEffect(() => {
    // Skip auth check on callback pages to avoid consuming the token
    if (pathname === "/auth-callback" || pathname === "/auth-popup") {
      setLoading(false);
      return;
    }

    fetchUser();

    if (Platform.OS !== "web") {
      // Listen for deep links (OAuth redirects on native)
      const subscription = Linking.addEventListener("url", async (event) => {
        console.log("🔗 Deep link received:", event.url);

        // Extract token if present in the URL (Better Auth / expoClient callback)
        const token = extractTokenFromUrl(event.url);
        if (token) {
          console.log("🎟️ Token found in deep link, saving and refreshing session...");
          oauthInProgress.current = false;
          await setBearerToken(token);
          // Give Better Auth a moment to persist the session
          await new Promise((resolve) => setTimeout(resolve, 500));
          await fetchUserRef.current?.();
          router.replace("/(tabs)/(home)");
          return;
        }

        // No token in URL - if OAuth was in progress, try fetching the session
        // (expoClient may have already stored the token internally)
        if (oauthInProgress.current) {
          console.log("✅ OAuth callback detected (no token in URL), fetching session...");
          oauthInProgress.current = false;
          // Give Better Auth a moment to process
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await fetchUserRef.current?.();
        }
      });

      // Also check the initial URL in case the app was opened via deep link
      Linking.getInitialURL().then(async (url) => {
        if (!url) return;
        console.log("🔗 Initial URL:", url);
        // Skip the Expo Go base URL (not an OAuth callback)
        if (url.includes("newly.dev") && !url.includes("token=")) return;
        const token = extractTokenFromUrl(url);
        if (token) {
          console.log("🎟️ Token found in initial URL, saving...");
          await setBearerToken(token);
          await new Promise((resolve) => setTimeout(resolve, 500));
          await fetchUserRef.current?.();
        }
      });

      return () => {
        subscription.remove();
      };
    }
  }, [pathname]);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log("📧 Signing in with email:", email);
      const result = await authClient.signIn.email({ email, password });
      console.log("📧 Email sign in result:", JSON.stringify(result?.data));

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
      console.log("📝 Email sign up result:", JSON.stringify(result?.data));

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
    try {
      console.log(`🔐 Starting ${provider} sign in on platform: ${Platform.OS}`);

      if (Platform.OS === "web") {
        oauthInProgress.current = true;
        const token = await openOAuthPopup(provider);
        // token may be "__cookie_session__" if session was established via cookie
        if (token && token !== "__cookie_session__") {
          await setBearerToken(token);
        }
        await fetchUser();
        oauthInProgress.current = false;
        Toast.show({
          type: "success",
          text1: "Welcome!",
          text2: `Signed in with ${provider}.`,
        });
      } else {
        // Native (iOS / Android):
        // The @better-auth/expo expoClient plugin handles the full OAuth flow:
        // 1. Opens an in-app browser via expo-web-browser
        // 2. User authenticates with the provider
        // 3. Backend redirects to cheshbon://?token=<session_token>
        // 4. expoClient intercepts the redirect, stores the token, and resolves
        //
        // We use the app scheme as the callbackURL so the backend knows to
        // redirect back to the app after OAuth completes.
        oauthInProgress.current = true;

        // The app's custom URL scheme for OAuth redirects.
        // expoClient plugin always uses "cheshbon" scheme from its config.
        // openAuthSessionAsync intercepts this at browser level (works in Expo Go too).

        Toast.show({
          type: "info",
          text1: "Opening browser...",
          text2: `Sign in with ${provider}`,
        });

        // Determine the correct callback URL for the current environment.
        // In Expo Go: exp://host/-- style URL
        // In production builds: cheshbon:// style URL
        // The expoClient plugin always uses the "cheshbon" scheme from its config.
        // openAuthSessionAsync intercepts the cheshbon:// redirect at the browser level.
        // This works in both Expo Go and production builds.
        const nativeCallbackURL = "cheshbon://";
        // nativeCallbackURL is always "cheshbon://" since expoClient uses the scheme from its config
        console.log(`📱 Native OAuth callbackURL: ${nativeCallbackURL}`);

        // Step 1: Get the OAuth URL from the server
        const result = await authClient.signIn.social({
          provider,
          callbackURL: nativeCallbackURL,
        });

        console.log(`📱 ${provider} signIn.social result:`, JSON.stringify(result?.data));

        // Step 2: If the plugin returned a redirect URL, open it in the browser manually.
        // The expoClient plugin may return {url, redirect: true} instead of opening
        // the browser itself, depending on the version.
        const resultData = result?.data as any;
        if (resultData?.url && resultData?.redirect === true) {
          console.log(`📱 Opening OAuth URL in browser: ${resultData.url}`);

          // openAuthSessionAsync opens the URL in an in-app browser and
          // intercepts the app scheme redirect, returning it as the result.
          const browserResult = await WebBrowser.openAuthSessionAsync(
            resultData.url,
            nativeCallbackURL
          );

          console.log(`📱 Browser result type: ${browserResult.type}`);

          if (browserResult.type === "success" && browserResult.url) {
            console.log(`📱 Browser redirect URL: ${browserResult.url}`);

            // Step 3: Extract token from the redirect URL
            const token = extractTokenFromUrl(browserResult.url);
            console.log(`📱 Token from redirect: ${token ? "found" : "not found"}`);

            if (token) {
              await setBearerToken(token);
            }

            oauthInProgress.current = false;
            await fetchUser();

            const session = await authClient.getSession();
            if (session?.data?.user) {
              Toast.show({
                type: "success",
                text1: "Welcome!",
                text2: `Signed in with ${provider}.`,
              });
              router.replace("/(tabs)/(home)");
            } else {
              console.log(`⚠️ No session after browser OAuth for ${provider}`);
              Toast.show({
                type: "error",
                text1: "Sign In Failed",
                text2: "Could not establish session. Please try again.",
              });
            }
          } else if (
            browserResult.type === "cancel" ||
            browserResult.type === "dismiss"
          ) {
            console.log(`ℹ️ ${provider} OAuth browser was dismissed by user`);
            oauthInProgress.current = false;
            // User cancelled - no error toast needed
          } else {
            console.log(`⚠️ Unexpected browser result type: ${(browserResult as any).type}`);
            oauthInProgress.current = false;
          }
        } else {
          // expoClient handled the flow internally (token already stored in its storage)
          console.log(`📱 expoClient handled OAuth internally, fetching session...`);
          oauthInProgress.current = false;
          await fetchUser();

          const session = await authClient.getSession();
          if (session?.data?.user) {
            Toast.show({
              type: "success",
              text1: "Welcome!",
              text2: `Signed in with ${provider}.`,
            });
            router.replace("/(tabs)/(home)");
          } else {
            console.log(`⚠️ Session not found after ${provider} OAuth, waiting for deep link...`);
          }
        }
      }
    } catch (error: any) {
      console.error(`❌ ${provider} sign in failed:`, error);
      oauthInProgress.current = false;

      // Don't show error for user cancellation
      if (
        error.message?.includes("cancelled") ||
        error.message?.includes("canceled") ||
        error.message?.includes("dismissed")
      ) {
        console.log(`ℹ️ ${provider} sign in was cancelled by user`);
        return;
      }

      Toast.show({
        type: "error",
        text1: "Sign In Failed",
        text2: error.message || `Failed to sign in with ${provider}.`,
      });
      throw error;
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
