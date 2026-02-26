import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

const API_URL = Constants.expoConfig?.extra?.backendUrl || "";

export const BEARER_TOKEN_KEY = "cheshbon_bearer_token";

// Platform-specific storage: localStorage for web, SecureStore for native
const storage = Platform.OS === "web"
  ? {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      deleteItem: (key: string) => localStorage.removeItem(key),
    }
  : SecureStore;

// Create auth client - use expoClient plugin for native, standard config for web
export const authClient = Platform.OS === "web"
  ? createAuthClient({
      baseURL: API_URL,
      // On web, use cookies (credentials: include) AND bearer token for cross-domain support
      fetchOptions: {
        credentials: "include" as RequestCredentials,
        // Use a function to dynamically get the bearer token so it's always fresh
        auth: {
          type: "Bearer" as const,
          token: () => {
            try {
              return localStorage.getItem(BEARER_TOKEN_KEY) || "";
            } catch {
              return "";
            }
          },
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

export async function setBearerToken(token: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(BEARER_TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token);
  }
}

export async function clearAuthTokens() {
  if (Platform.OS === "web") {
    localStorage.removeItem(BEARER_TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY);
  }
}

export { API_URL };
