
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Backend URL is configured in app.json under expo.extra.backendUrl
 * It is set automatically when the backend is deployed
 */
export const BACKEND_URL =
  Constants.expoConfig?.extra?.backendUrl || 'https://a8sew4dfz3q59y6r9k8fhpt2jfdhpm8d.app.specular.dev';

export const BEARER_TOKEN_KEY = 'cheshbon_bearer_token';

/**
 * Check if backend is properly configured
 */
export const isBackendConfigured = (): boolean => {
  return !!BACKEND_URL && BACKEND_URL.length > 0;
};

/**
 * Get bearer token from platform-specific storage
 * Web: localStorage
 * Native: SecureStore
 *
 * @returns Bearer token or null if not found
 */
export const getBearerToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      const token = localStorage.getItem(BEARER_TOKEN_KEY);
      console.log('[API] Web token retrieved:', token ? 'YES' : 'NO');
      return token;
    } else {
      console.log('[API] Retrieving token from SecureStore...');
      const token = await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
      console.log('[API] SecureStore token retrieved:', token ? `YES (${token.substring(0, 20)}...)` : 'NO');
      
      // iOS-specific: If no token found, wait a bit and try again
      // This handles race conditions where token is being written
      if (!token && Platform.OS === 'ios') {
        console.log('[API] iOS: No token found, retrying after delay...');
        await new Promise(resolve => setTimeout(resolve, 200));
        const retryToken = await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
        console.log('[API] iOS retry result:', retryToken ? 'YES' : 'NO');
        return retryToken;
      }
      
      return token;
    }
  } catch (error) {
    console.error('[API] Error retrieving bearer token:', error);
    return null;
  }
};

/**
 * Set bearer token in platform-specific storage
 */
export const setBearerToken = async (token: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(BEARER_TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token);
    }
  } catch (error) {
    console.error('[API] Error saving bearer token:', error);
    throw error;
  }
};

/**
 * Clear bearer token from storage
 */
export const clearBearerToken = async (): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(BEARER_TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY);
    }
  } catch (error) {
    console.error('[API] Error clearing bearer token:', error);
  }
};

/**
 * Generic API call helper with error handling
 *
 * @param endpoint - API endpoint path (e.g., '/users', '/auth/login')
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Parsed JSON response
 * @throws Error if backend is not configured or request fails
 */
export const apiCall = async <T = any>(endpoint: string, options?: RequestInit): Promise<T> => {
  if (!isBackendConfigured()) {
    throw new Error('Backend URL not configured. Please rebuild the app.');
  }

  const url = `${BACKEND_URL}${endpoint}`;
  console.log('[API] Calling:', url, options?.method || 'GET');

  try {
    // CRITICAL: Retrieve token BEFORE building fetch options to avoid race conditions
    const token = await getBearerToken();
    console.log('[API] Token retrieved:', token ? `YES (${token.substring(0, 20)}...)` : 'NO');

    const fetchOptions: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    };

    // Always send the token if we have it (needed for cross-domain/iframe support)
    if (token) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        Authorization: `Bearer ${token}`,
      };
      console.log('[API] Authorization header added');
    } else {
      console.warn('[API] ⚠️ No token available for authenticated request');
    }

    console.log('[API] Request headers:', JSON.stringify(fetchOptions.headers));

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const text = await response.text();
      console.error('[API] Error response:', response.status, text);
      throw new Error(`API error: ${response.status} - ${text}`);
    }

    const data = await response.json();
    console.log('[API] Success:', endpoint);
    return data;
  } catch (error) {
    console.error('[API] Request failed:', error);
    throw error;
  }
};

/**
 * GET request helper
 */
export const apiGet = async <T = any>(endpoint: string): Promise<T> => {
  return apiCall<T>(endpoint, { method: 'GET' });
};

/**
 * POST request helper
 */
export const apiPost = async <T = any>(endpoint: string, data: any): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * PUT request helper
 */
export const apiPut = async <T = any>(endpoint: string, data: any): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

/**
 * PATCH request helper
 */
export const apiPatch = async <T = any>(endpoint: string, data: any): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

/**
 * DELETE request helper
 * Always sends a body to avoid FST_ERR_CTP_EMPTY_JSON_BODY errors
 */
export const apiDelete = async <T = any>(endpoint: string, data: any = {}): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: 'DELETE',
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated API call helper
 * Automatically retrieves bearer token from storage and adds to Authorization header
 *
 * @param endpoint - API endpoint path
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Parsed JSON response
 * @throws Error if token not found or request fails
 */
export const authenticatedApiCall = async <T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> => {
  const token = await getBearerToken();

  if (!token) {
    throw new Error('Authentication token not found. Please sign in.');
  }

  return apiCall<T>(endpoint, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
};

/**
 * Authenticated GET request
 */
export const authenticatedGet = async <T = any>(endpoint: string): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, { method: 'GET' });
};

/**
 * Authenticated POST request
 */
export const authenticatedPost = async <T = any>(endpoint: string, data: any): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated PUT request
 */
export const authenticatedPut = async <T = any>(endpoint: string, data: any): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated PATCH request
 */
export const authenticatedPatch = async <T = any>(endpoint: string, data: any): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated DELETE request
 * Always sends a body to avoid FST_ERR_CTP_EMPTY_JSON_BODY errors
 */
export const authenticatedDelete = async <T = any>(
  endpoint: string,
  data: any = {}
): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: 'DELETE',
    body: JSON.stringify(data),
  });
};
