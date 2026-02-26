
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

// Build auth client configuration
// On native we use the expoClient plugin which:
//   1. Opens an in-app browser for OAuth
//   2. Intercepts the cheshbon:// deep link redirect
//   3. Extracts and stores the session token automatically
const authClientConfig: any = {
  baseURL: API_URL,
};

if (Platform.OS !== "web") {
  authClientConfig.plugins = [
    expoClient({
      scheme: "cheshbon",
      storagePrefix: "cheshbon",
      storage,
    }),
  ];
} else {
  // Web: use cookies + bearer token fallback
  authClientConfig.fetchOptions = {
    credentials: "include" as const,
    auth: {
      type: "Bearer" as const,
      token: () =>
        typeof localStorage !== "undefined"
          ? localStorage.getItem(BEARER_TOKEN_KEY) || ""
          : "",
    },
  };
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
    const token =
      Platform.OS === "web"
        ? typeof localStorage !== "undefined"
          ? localStorage.getItem(BEARER_TOKEN_KEY)
          : null
        : await SecureStore.getItemAsync(BEARER_TOKEN_KEY);

    if (!token) {
      return null;
    }

    const response = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("❌ Failed to get session with bearer token:", error);
    return null;
  }
}
