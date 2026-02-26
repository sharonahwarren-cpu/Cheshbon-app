
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

  const fetchUser = async () => {
    // Don't interfere with OAuth flow
    if (oauthInProgress.current) {
      console.log("⏸️ Skipping fetchUser - OAuth in progress");
      return;
    }

    try {
      setLoading(true);
      console.log("🔍 Fetching user session...");

      const session = await authClient.getSession();
      console.log("📦 Session response:", session?.data?.user ? "User found" : "No user");

      if (session?.data?.user) {
        console.log("✅ User authenticated:", session.data.user.email);
        setUser(session.data.user as User);

        // Sync token to storage for utils/api.ts
        if (session.data.session?.token) {
          await setBearerToken(session.data.session.token);
          console.log("💾 Bearer token saved from session");
        }
      } else {
        // Try bearer token fallback for native
        console.log("🔄 Trying bearer token fallback...");
        const bearerSession = await getSessionWithBearerToken();
        if (bearerSession?.user) {
          console.log("✅ User authenticated via bearer token:", bearerSession.user.email);
          setUser(bearerSession.user as User);
          if (bearerSession.session?.token) {
            await setBearerToken(bearerSession.session.token);
          }
        } else {
          console.log("❌ No user session found");
          setUser(null);
          // Only clear tokens if not in OAuth flow
          if (!oauthInProgress.current) {
            await clearAuthTokens();
          }
        }
      }
    } catch (error) {
      console.error("❌ Failed to fetch user:", error);
      setUser(null);
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

    fetchUser();
  }, [pathname]);

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
    oauthInProgress.current = true;
    try {
      console.log(`🔐 Starting ${provider} sign in on platform: ${Platform.OS}`);

      if (Platform.OS === "web") {
        // Web: Use popup flow
        const { token, user: oauthUser } = await openOAuthPopup(provider);
        
        if (token) {
          await setBearerToken(token);
        }

        // Retry session establishment
        let sessionEstablished = false;
        for (let i = 0; i < MAX_RETRIES && !sessionEstablished; i++) {
          console.log(`🔄 Attempting to establish session (${i + 1}/${MAX_RETRIES})...`);
          const session = await authClient.getSession();
          if (session?.data?.user) {
            setUser(session.data.user as User);
            sessionEstablished = true;
            console.log("✅ Session established successfully");
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
        const nativeCallbackURL = Linking.createURL("");
        console.log(`📱 Native OAuth callbackURL: ${nativeCallbackURL}`);

        Toast.show({
          type: "info",
          text1: "Opening browser...",
          text2: `Sign in with ${provider}`,
        });

        // Step 1: Get the OAuth URL from Better Auth
        const result = await authClient.signIn.social({
          provider,
          callbackURL: nativeCallbackURL,
        });

        console.log(`📱 ${provider} signIn.social result:`, result?.data ? "Got URL" : "No URL");

        const resultData = result?.data as any;
        
        // Step 2: Open the OAuth URL in browser
        let oauthUrl = resultData?.url;
        
        // If no URL returned, construct it manually
        if (!oauthUrl) {
          oauthUrl = `${API_URL}/api/auth/sign-in/social?provider=${provider}&callbackURL=${encodeURIComponent(nativeCallbackURL)}`;
          console.log(`📱 Constructed OAuth URL: ${oauthUrl}`);
        }

        console.log(`📱 Opening OAuth URL in browser...`);
        const browserResult = await WebBrowser.openAuthSessionAsync(
          oauthUrl,
          nativeCallbackURL
        );

        console.log(`📱 Browser result type: ${browserResult.type}`);

        if (browserResult.type === "success" && browserResult.url) {
          console.log(`📱 Browser redirect URL received`);

          // Step 3: Extract token from the redirect URL
          const url = new URL(browserResult.url);
          const token = 
            url.searchParams.get("token") ||
            url.searchParams.get("better_auth_token") ||
            url.searchParams.get("session_token");

          console.log(`📱 Token from redirect: ${token ? "found" : "not found"}`);

          if (token) {
            console.log("💾 Saving token...");
            await setBearerToken(token);
            
            // Give the backend a moment to process
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // Step 4: Retry session establishment with exponential backoff
          let sessionEstablished = false;
          for (let i = 0; i < MAX_RETRIES && !sessionEstablished; i++) {
            console.log(`🔄 Attempting to establish session (${i + 1}/${MAX_RETRIES})...`);
            
            const session = await authClient.getSession();
            if (session?.data?.user) {
              setUser(session.data.user as User);
              sessionEstablished = true;
              console.log("✅ Session established successfully");
              break;
            }

            // Try bearer token fallback
            const bearerSession = await getSessionWithBearerToken();
            if (bearerSession?.user) {
              setUser(bearerSession.user as User);
              sessionEstablished = true;
              console.log("✅ Session established via bearer token");
              break;
            }

            if (i < MAX_RETRIES - 1) {
              const delay = RETRY_INTERVAL_MS * (i + 1);
              console.log(`⏳ Waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }

          if (!sessionEstablished) {
            console.error("❌ Could not establish session after OAuth");
            throw new Error("Could not establish session. Please try again.");
          }

          Toast.show({
            type: "success",
            text1: "Welcome!",
            text2: `Signed in with ${provider}.`,
          });
          router.replace("/(tabs)/(home)");
        } else if (browserResult.type === "cancel" || browserResult.type === "dismiss") {
          console.log(`ℹ️ ${provider} OAuth browser was dismissed by user`);
          // User cancelled - no error toast needed
        } else {
          console.log(`⚠️ Unexpected browser result type: ${(browserResult as any).type}`);
          throw new Error("Authentication was not completed");
        }
      }
    } catch (error: any) {
      console.error(`❌ ${provider} sign in failed:`, error);

      // Don't show error for user cancellation
      if (
        error.message?.includes("cancelled") ||
        error.message?.includes("canceled") ||
        error.message?.includes("dismissed")
      ) {
        console.log(`ℹ️ ${provider} sign in was cancelled by user`);
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
      } else {
        Toast.show({
          type: "error",
          text1: "Sign In Failed",
          text2: error.message || `Failed to sign in with ${provider}.`,
        });
      }
      throw error;
    } finally {
      oauthInProgress.current = false;
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
