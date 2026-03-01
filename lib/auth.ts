
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const API_URL = "https://a8sew4dfz3q59y6r9k8fhpt2jfdhpm8d.app.specular.dev";

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

export async function getSessionWithBearerToken() {
  try {
    let token: string | null = null;
    
    if (Platform.OS === "web") {
      token = typeof localStorage !== "undefined"
        ? localStorage.getItem(BEARER_TOKEN_KEY)
        : null;
    } else {
      try {
        token = await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
      } catch (secureStoreErr) {
        console.warn("[Auth] SecureStore.getItemAsync failed:", secureStoreErr);
        return null;
      }
    }

    if (!token) {
      return null;
    }

    // Use /api/auth/me - the correct endpoint for session retrieval
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
    });

    if (!response.ok) {
      console.warn("[Auth] get-session returned:", response.status);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn("[Auth] getSessionWithBearerToken failed:", error);
    return null;
  }
}
