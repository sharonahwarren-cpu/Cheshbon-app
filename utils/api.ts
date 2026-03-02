
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

/**
 * Backend URL is configured in app.json under expo.extra.backendUrl
 * It is set automatically when the backend is deployed
 */
export const BACKEND_URL =
  Constants.expoConfig?.extra?.backendUrl || 'https://a8sew4dfz3q59y6r9k8fhpt2jfdhpm8d.app.specular.dev';

export const BEARER_TOKEN_KEY = 'cheshbon_bearer_token';

// In-memory token cache to avoid SecureStore race conditions on iOS
// Also improves performance on all platforms by reducing storage I/O
let tokenCache: string | null = null;
let tokenCacheTimestamp: number = 0;
const TOKEN_CACHE_DURATION = 30000; // 30 seconds - longer duration for better reliability

/**
 * Check if backend is properly configured
 */
export const isBackendConfigured = (): boolean => {
  return !!BACKEND_URL && BACKEND_URL.length > 0;
};

/**
 * Get bearer token from platform-specific storage with caching
 * Web: localStorage
 * Native: SecureStore with in-memory cache
 *
 * @returns Bearer token or null if not found
 */
export const getBearerToken = async (): Promise<string | null> => {
  try {
    // Use cache if available and fresh (Native optimization for iOS and Android)
    if (Platform.OS !== 'web') {
      const cacheAge = Date.now() - tokenCacheTimestamp;
      const isCacheFresh = cacheAge < TOKEN_CACHE_DURATION;
      console.log('[API] 📱 Native: Cache check - exists:', !!tokenCache, 'age:', cacheAge + 'ms', 'fresh:', isCacheFresh);
      
      if (tokenCache && isCacheFresh) {
        console.log('[API] ✅ Using cached token (Native optimization)');
        console.log('[API] 🔑 Cached token:', tokenCache.substring(0, 30) + '...');
        return tokenCache;
      } else if (tokenCache && !isCacheFresh) {
        console.log('[API] ⚠️ Cache expired, fetching from SecureStore...');
      } else {
        console.log('[API] ⚠️ No cache available, fetching from SecureStore...');
      }
    }

    if (Platform.OS === 'web') {
      const token = localStorage.getItem(BEARER_TOKEN_KEY);
      console.log('[API] 🌐 Web token retrieved:', token ? 'YES' : 'NO');
      return token;
    } else {
      console.log('[API] 📱 Retrieving token from SecureStore...');
      const token = await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
      console.log('[API] 📱 SecureStore token retrieved:', token ? `YES (${token.substring(0, 30)}...)` : 'NO');
      
      // Update cache on Native platforms
      if (token) {
        tokenCache = token;
        tokenCacheTimestamp = Date.now();
        console.log('[API] 📱 Native: Token cached from SecureStore');
      }
      
      return token;
    }
  } catch (error) {
    console.error('[API] ❌ Error retrieving bearer token:', error);
    return null;
  }
};

/**
 * Set bearer token in platform-specific storage with immediate caching
 */
export const setBearerToken = async (token: string): Promise<void> => {
  try {
    console.log('[API] 💾 Saving bearer token (length:', token.length, ')...');
    console.log('[API] 💾 Token value:', token.substring(0, 30) + '...');
    
    // CRITICAL FIX: Update cache IMMEDIATELY before async storage
    // This ensures subsequent API calls can use the token right away on ALL platforms
    if (Platform.OS !== 'web') {
      tokenCache = token;
      tokenCacheTimestamp = Date.now();
      console.log('[API] ✅ Native: Token cached in memory IMMEDIATELY');
      console.log('[API] 📱 Native: Cache timestamp:', tokenCacheTimestamp);
    }
    
    if (Platform.OS === 'web') {
      localStorage.setItem(BEARER_TOKEN_KEY, token);
      console.log('[API] ✅ Token saved to localStorage');
    } else {
      console.log('[API] 📱 Starting SecureStore.setItemAsync...');
      await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token);
      console.log('[API] ✅ Token saved to SecureStore');
      
      // Native: Verify the token was actually saved (iOS and Android)
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        console.log('[API] 📱 Native: Waiting 100ms for SecureStore to settle...');
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('[API] 📱 Native: Verifying token in SecureStore...');
        const verifyToken = await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
        if (verifyToken === token) {
          console.log('[API] ✅ Native: Token verified in SecureStore');
        } else {
          console.error('[API] ❌ Native: Token verification failed!');
          console.error('[API] ❌ Native: Expected:', token.substring(0, 30) + '...');
          console.error('[API] ❌ Native: Got:', verifyToken ? verifyToken.substring(0, 30) + '...' : 'NULL');
          throw new Error('Failed to persist token to SecureStore');
        }
      }
    }
  } catch (error) {
    console.error('[API] ❌ Error saving bearer token:', error);
    throw error;
  }
};

/**
 * Clear bearer token from storage and cache
 */
export const clearBearerToken = async (): Promise<void> => {
  try {
    console.log('[API] 🗑️ Clearing bearer token...');
    
    // Clear cache immediately on all platforms
    tokenCache = null;
    tokenCacheTimestamp = 0;
    console.log('[API] ✅ Token cache cleared');
    
    if (Platform.OS === 'web') {
      localStorage.removeItem(BEARER_TOKEN_KEY);
      console.log('[API] ✅ Token removed from localStorage');
    } else {
      await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY);
      console.log('[API] ✅ Token removed from SecureStore');
    }
    console.log('[API] ✅ Bearer token cleared completely');
  } catch (error) {
    console.error('[API] ❌ Error clearing bearer token:', error);
  }
};

// Track the last successful authentication time to implement a grace period
// This prevents 401 errors from clearing the token immediately after sign-in
// (race condition: session created but not yet committed to DB)
let lastAuthSuccessTime: number = 0;
const AUTH_GRACE_PERIOD_MS = 10000; // 10 seconds grace period after sign-in

/**
 * Mark that authentication was just successful (call after sign-in)
 * This starts a grace period during which 401 errors won't clear the token
 */
export const markAuthSuccess = (): void => {
  lastAuthSuccessTime = Date.now();
  console.log('[API] ✅ Auth success marked - grace period started (10s)');
};

/**
 * Handle 401 Unauthorized errors by clearing token and redirecting to auth
 * Implements a grace period after sign-in to handle DB commit race conditions
 */
const handle401Error = async () => {
  const timeSinceAuth = Date.now() - lastAuthSuccessTime;
  const inGracePeriod = lastAuthSuccessTime > 0 && timeSinceAuth < AUTH_GRACE_PERIOD_MS;
  
  console.error('[API] 🚨 401 Unauthorized - Token is invalid or expired');
  console.log('[API] Time since last auth success:', timeSinceAuth + 'ms');
  console.log('[API] In grace period:', inGracePeriod);
  
  if (inGracePeriod) {
    // Within grace period after sign-in - don't clear token, just log
    // This handles the race condition where session is created but not yet committed to DB
    console.warn('[API] ⚠️ 401 received within grace period after sign-in - NOT clearing token');
    console.warn('[API] ⚠️ This is likely a DB commit race condition - token should be valid');
    return;
  }
  
  console.log('[API] Clearing invalid token and redirecting to auth...');
  
  try {
    await clearBearerToken();
    
    // Use setTimeout to avoid navigation during render
    setTimeout(() => {
      try {
        router.replace('/auth');
      } catch (navError) {
        console.error('[API] Navigation error:', navError);
      }
    }, 100);
  } catch (error) {
    console.error('[API] Error handling 401:', error);
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
  console.log('[API] 🌐 Calling:', url, options?.method || 'GET');

  try {
    // CRITICAL: Retrieve token BEFORE building fetch options
    // This uses the in-memory cache on iOS to avoid SecureStore race conditions
    const token = await getBearerToken();
    console.log('[API] 🔑 Token retrieved for', endpoint, ':', token ? `YES (${token.substring(0, 20)}...)` : 'NO');
    
    // Log cache status on iOS
    if (Platform.OS === 'ios') {
      console.log('[API] 📱 iOS cache status:', tokenCache ? 'CACHED' : 'NOT CACHED');
      console.log('[API] 📱 iOS cache age:', tokenCache ? `${Date.now() - tokenCacheTimestamp}ms` : 'N/A');
    }

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
      console.log('[API] ✅ Authorization header added to', endpoint);
    } else {
      console.warn('[API] ⚠️ No token available for', endpoint);
    }

    console.log('[API] 📤 Sending request to', endpoint, 'with headers:', Object.keys(fetchOptions.headers || {}));
    const response = await fetch(url, fetchOptions);
    console.log('[API] 📥 Response received from', endpoint, '- Status:', response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error('[API] ❌ Error response from', endpoint, ':', response.status, text.substring(0, 200));
      
      // Handle 401 Unauthorized - token is invalid or expired
      if (response.status === 401) {
        console.error('[API] 🚨 401 Unauthorized on', endpoint);
        console.error('[API] 🚨 Token was:', token ? token.substring(0, 30) + '...' : 'NONE');
        await handle401Error();
      }
      
      throw new Error(`API error: ${response.status} - ${text}`);
    }

    const data = await response.json();
    console.log('[API] ✅ Success:', endpoint);
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
