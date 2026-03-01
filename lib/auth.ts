
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Use the same backend URL as utils/api.ts - CRITICAL for consistency
export const API_URL = Constants.expoConfig?.extra?.backendUrl || "";

export const BEARER_TOKEN_KEY = "cheshbon_bearer_token";

// Platform-specific storage: localStorage for web, SecureStore for native
const storage =
  Platform.OS === "web"
    ? {
        getItem: (key: string) => localStorage.getItem(key),
        setItem: (key: string, value: string) =>
          localStorage.setItem(key, value),
        deleteItem: (key: string) => localStorage.removeItem(key),
      }
    : SecureStore;

// Helper to get bearer token from storage
async function getBearerToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem(BEARER_TOKEN_KEY)
      : null;
  } else {
    try {
      return await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
    } catch (error) {
      console.warn("[Auth] Failed to get bearer token:", error);
      return null;
    }
  }
}

// Build auth client configuration
const authClientConfig: any = {
  baseURL: API_URL,
  fetchOptions: {
    credentials: "include" as const,
    onRequest: async (context: any) => {
      // Dynamically add bearer token to all requests
      const token = await getBearerToken();
      if (token) {
        context.headers.set("Authorization", `Bearer ${token}`);
        console.log("[Auth] Added bearer token to request");
      }
    },
  },
};

// Add expoClient plugin for native platforms
if (Platform.OS !== "web") {
  authClientConfig.plugins = [
    expoClient({
      scheme: "cheshbon",
      storagePrefix: "cheshbon",
      storage,
    }),
  ];
}

export const authClient = createAuthClient(authClientConfig);

export async function setBearerToken(token: string) {
  console.log("💾 Saving bearer token...");
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(BEARER_TOKEN_KEY, token);
    }
  } else {
    try {
      await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token);
    } catch (error) {
      console.error("❌ Failed to save bearer token:", error);
    }
  }
}

export async function clearAuthTokens() {
  console.log("🗑️ Clearing auth tokens...");
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(BEARER_TOKEN_KEY);
    }
  } else {
    try {
      await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY);
    } catch (error) {
      console.error("❌ Failed to clear bearer token:", error);
    }
  }
}

/**
 * Try to get the Better Auth session token from the expoClient storage.
 * The expoClient plugin stores the token under keys like "cheshbon.session_token"
 * or "cheshbon.better-auth.session_token".
 */
export async function getBetterAuthStoredToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  
  // Common key patterns used by @better-auth/expo expoClient plugin
  const possibleKeys = [
    "cheshbon.session_token",
    "cheshbon.better-auth.session_token",
    "cheshbon_session_token",
    "better-auth.session_token",
    "session_token",
  ];
  
  for (const key of possibleKeys) {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value) {
        console.log(`[Auth] Found Better Auth token under key: ${key}`);
        return value;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export async function getSessionWithBearerToken() {
  try {
    let token: string | null = null;
    
    if (Platform.OS === "web") {
      token = typeof localStorage !== "undefined"
        ? localStorage.getItem(BEARER_TOKEN_KEY)
        : null;
    } else {
      try {
        // First try our custom bearer token key
        token = await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
        
        // If not found, try the Better Auth expoClient storage keys
        if (!token) {
          console.log("[Auth] Custom bearer token not found, checking Better Auth storage...");
          token = await getBetterAuthStoredToken();
          
          // If found in Better Auth storage, sync it to our key
          if (token) {
            console.log("[Auth] Syncing Better Auth token to custom bearer token key");
            await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token);
          }
        }
      } catch (secureStoreErr) {
        console.warn("[Auth] SecureStore.getItemAsync failed:", secureStoreErr);
        return null;
      }
    }

    if (!token) {
      console.log("[Auth] No bearer token found in storage");
      return null;
    }

    console.log("[Auth] Fetching session with bearer token...");

    // Use /api/auth/me - the correct endpoint for session retrieval
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
    });

    if (!response.ok) {
      console.warn("[Auth] /api/auth/me returned:", response.status);
      // If 401, the token is invalid - clear it
      if (response.status === 401) {
        console.log("[Auth] Token is invalid (401), clearing stored token");
        if (Platform.OS === "web") {
          if (typeof localStorage !== "undefined") localStorage.removeItem(BEARER_TOKEN_KEY);
        } else {
          try { await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY); } catch {}
        }
      }
      return null;
    }

    const data = await response.json();
    console.log("[Auth] Session retrieved successfully");
    return data;
  } catch (error) {
    console.warn("[Auth] getSessionWithBearerToken failed:", error);
    return null;
  }
}
