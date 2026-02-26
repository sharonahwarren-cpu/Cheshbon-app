
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

const API_URL = Constants.expoConfig?.extra?.backendUrl || "";

export const BEARER_TOKEN_KEY = "cheshbon_bearer_token";

// Log if we're on the auth-callback page when the auth client is initialized
if (Platform.OS === "web" && typeof window !== "undefined") {
  const pathname = window.location.pathname;
  const search = window.location.search;
  if (pathname.includes("auth-callback") || search.includes("better_auth_token")) {
    console.log("[Auth] lib/auth.ts loaded on auth-callback page, URL:", pathname + search);
  }
}

// Platform-specific storage: localStorage for web, SecureStore for native
const storage = Platform.OS === "web"
  ? {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      deleteItem: (key: string) => localStorage.removeItem(key),
    }
  : SecureStore;

// Helper to get bearer token
function getBearerToken(): string {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(BEARER_TOKEN_KEY) || "";
    }
    // For native, we can't use async here, so return empty
    // The token will be set via cookies/session for native
    return "";
  } catch {
    return "";
  }
}

// Create auth client - use expoClient plugin for native, standard config for web
export const authClient = Platform.OS === "web"
  ? createAuthClient({
      baseURL: API_URL,
      fetchOptions: {
        credentials: "include" as RequestCredentials,
        onRequest: async (context) => {
          // Add bearer token to all requests if available
          // This ensures OAuth sessions (which use Bearer tokens) work correctly
          const token = getBearerToken();
          if (token) {
            context.headers.set("Authorization", `Bearer ${token}`);
          }
        },
      },
    })
  : createAuthClient({
      baseURL: API_URL,
      plugins: [
        expoClient({
          scheme: "cheshbon",
          storagePrefix: "cheshbon",
          storage,
        }),
      ],
    });

/**
 * Get the current session using the stored Bearer token.
 * This is used as a fallback when authClient.getSession() returns null
 * (e.g., after OAuth when only a Bearer token is available, not a cookie).
 */
export async function getSessionWithBearerToken(): Promise<{ user: any; session: any } | null> {
  try {
    let token: string | null = null;
    
    if (Platform.OS === "web") {
      token = localStorage.getItem(BEARER_TOKEN_KEY);
    } else {
      try {
        token = await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
      } catch (secureStoreErr) {
        // SecureStore might fail on simulator or if keychain is unavailable
        console.warn("[Auth] SecureStore.getItemAsync failed:", secureStoreErr);
        return null;
      }
    }
    
    if (!token) return null;
    
    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      console.log("[Auth] Bearer token session check failed:", response.status);
      return null;
    }
    
    const data = await response.json();
    return data?.user ? data : null;
  } catch (err) {
    console.warn("[Auth] getSessionWithBearerToken failed:", err);
    return null;
  }
}

export async function setBearerToken(token: string) {
  console.log("[Auth] Storing bearer token (length:", token.length, ")");
  if (Platform.OS === "web") {
    localStorage.setItem(BEARER_TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token);
  }
}

export async function clearAuthTokens() {
  console.log("[Auth] Clearing auth tokens");
  if (Platform.OS === "web") {
    localStorage.removeItem(BEARER_TOKEN_KEY);
  } else {
    try {
      await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY);
    } catch (err) {
      // Token might not exist, ignore error
      console.log("[Auth] No token to clear");
    }
  }
}

export { API_URL };
