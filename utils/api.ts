
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

// Track if user is currently authenticated (set by AuthContext)
// This prevents 401 errors from clearing the token when the user is actively using the app
let isUserAuthenticated: boolean = false;

/**
 * Set the current authentication state (called by AuthContext)
 */
export const setUserAuthState = (authenticated: boolean): void => {
  isUserAuthenticated = authenticated;
  console.log('[API] 🔐 User auth state updated:', authenticated);
};

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
// Grace period: 30 seconds after sign-in to handle any remaining race conditions
// The backend now checks DB first (DB-first auth fix), so this is a safety net only
const AUTH_GRACE_PERIOD_MS = 30000; // 30 seconds grace period after sign-in

/**
 * Mark that authentication was just successful (call after sign-in)
 * This starts a grace period during which 401 errors won't clear the token
 */
export const markAuthSuccess = (): void => {
  lastAuthSuccessTime = Date.now();
  console.log('[API] ✅ Auth success marked - grace period started (30s)');
};

/**
 * Reset the auth success time (call when explicitly signing out)
 */
export const resetAuthSuccess = (): void => {
  lastAuthSuccessTime = 0;
  console.log('[API] 🔄 Auth success time reset');
};

/**
 * Handle 401 Unauthorized errors by clearing token and redirecting to auth
 * Implements a grace period after sign-in to handle DB commit race conditions
 * 
 * BACKEND FIX DEPLOYED: The backend auth-wrapper now checks the database FIRST
 * before trying framework auth. This means valid sessions are always accepted
 * immediately, eliminating the 212 iOS errors.
 * 
 * This grace period is now a safety net only - it prevents token clearing
 * during the brief window between session creation and DB commit.
 */
const handle401Error = async () => {
  const timeSinceAuth = Date.now() - lastAuthSuccessTime;
  const inGracePeriod = lastAuthSuccessTime > 0 && timeSinceAuth < AUTH_GRACE_PERIOD_MS;
  
  console.error('[API] 🚨 401 Unauthorized - Token is invalid or expired');
  console.log('[API] Time since last auth success:', timeSinceAuth + 'ms');
  console.log('[API] In grace period:', inGracePeriod, '(grace period:', AUTH_GRACE_PERIOD_MS + 'ms)');
  console.log('[API] User currently authenticated:', isUserAuthenticated);
  
  if (inGracePeriod) {
    // Within grace period after sign-in - don't clear token, just log
    // This handles the race condition where session is created but not yet committed to DB
    console.warn('[API] ⚠️ 401 received within grace period after sign-in - NOT clearing token');
    console.warn('[API] ⚠️ Time remaining in grace period:', (AUTH_GRACE_PERIOD_MS - timeSinceAuth) + 'ms');
    return;
  }
  
  if (isUserAuthenticated) {
    // User is actively authenticated - don't clear token on 401
    // This could be a temporary server issue
    console.warn('[API] ⚠️ 401 received but user is authenticated - NOT clearing token');
    console.warn('[API] ⚠️ If this persists, the session may have expired - user will need to re-login');
    return;
  }
  
  console.log('[API] Grace period expired and user not authenticated, clearing invalid token and redirecting to auth...');
  
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
 * Internal fetch helper - performs a single API request attempt
 */
const _fetchOnce = async <T = any>(
  url: string,
  endpoint: string,
  fetchOptions: RequestInit,
  token: string | null
): Promise<{ ok: boolean; status: number; data?: T; text?: string }> => {
  const response = await fetch(url, fetchOptions);
  console.log('[API] 📥 Response received from', endpoint, '- Status:', response.status);

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, status: response.status, text };
  }

  const data = await response.json();
  return { ok: true, status: response.status, data };
};

/**
 * Generic API call helper with error handling and retry logic for iOS auth
 *
 * BACKEND FIX: The backend auth-wrapper now checks the database FIRST before
 * trying framework auth. This eliminates the 212 iOS errors after login.
 * 
 * This function adds a retry mechanism for 401 errors during the grace period
 * as an additional safety net for any remaining race conditions.
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

    const buildFetchOptions = (t: string | null): RequestInit => {
      const baseHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string> || {}),
      };

      // CRITICAL iOS FIX: Add Origin header for all API requests on native platforms
      // Better Auth's requireAuth validates the Origin header. Without it, requests from
      // native iOS/Android apps may be rejected. The backend's onRequest hook only adds
      // Origin for /api/auth/ routes, not for other routes like /api/goals, /api/strategies.
      // Adding Origin here ensures ALL authenticated requests are accepted by Better Auth.
      if (Platform.OS !== 'web') {
        baseHeaders['Origin'] = BACKEND_URL;
        baseHeaders['X-Mobile-App'] = 'cheshbon';
        baseHeaders['X-Platform'] = Platform.OS;
      }

      if (t) {
        baseHeaders['Authorization'] = `Bearer ${t}`;
      }

      const opts: RequestInit = {
        ...options,
        headers: baseHeaders,
      };

      return opts;
    };

    const fetchOptions = buildFetchOptions(token);

    if (token) {
      console.log('[API] ✅ Authorization header added to', endpoint);
    } else {
      console.warn('[API] ⚠️ No token available for', endpoint);
    }

    let result = await _fetchOnce<T>(url, endpoint, fetchOptions, token);

    // Retry logic for 401 errors
    // This handles two scenarios:
    // 1. Grace period after sign-in: session may not be committed to DB yet
    // 2. User is authenticated: some backend routes may use framework auth (not DB-first)
    //    and may reject valid sessions. Retry gives the backend a chance to succeed.
    if (!result.ok && result.status === 401) {
      const timeSinceAuth = Date.now() - lastAuthSuccessTime;
      const inGracePeriod = lastAuthSuccessTime > 0 && timeSinceAuth < AUTH_GRACE_PERIOD_MS;

      console.error('[API] 🚨 401 Unauthorized on', endpoint);
      console.error('[API] 🚨 Token was:', token ? token.substring(0, 30) + '...' : 'NONE');
      console.error('[API] 🚨 Platform:', Platform.OS);
      console.error('[API] 🚨 In grace period:', inGracePeriod, '(', timeSinceAuth, 'ms since auth)');
      console.error('[API] 🚨 User authenticated:', isUserAuthenticated);

      // Retry if:
      // - We're in the grace period after sign-in (session may not be in DB yet), OR
      // - The user is currently authenticated (some backend routes may use framework auth
      //   which can reject valid sessions - retry gives them a chance to succeed)
      if (token && (inGracePeriod || isUserAuthenticated)) {
        const retryDelay = inGracePeriod ? 1000 : 500;
        console.warn(`[API] ⚠️ 401 - retrying after ${retryDelay}ms (gracePeriod=${inGracePeriod}, authenticated=${isUserAuthenticated})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Re-fetch token in case it was updated
        const retryToken = await getBearerToken();
        const retryOptions = buildFetchOptions(retryToken);
        result = await _fetchOnce<T>(url, endpoint, retryOptions, retryToken);
        
        if (result.ok) {
          console.log('[API] ✅ Retry succeeded for', endpoint);
          return result.data as T;
        }
        
        console.error('[API] ❌ Retry also failed for', endpoint, '- Status:', result.status);
        
        // If user is authenticated but retry still fails, don't clear token
        // This prevents logout when some backend routes have auth issues
        if (isUserAuthenticated) {
          console.warn('[API] ⚠️ User is authenticated but endpoint returned 401 after retry - skipping token clear');
          throw new Error(`API error: ${result.status} - ${result.text}`);
        }
      }

      await handle401Error();
      throw new Error(`API error: ${result.status} - ${result.text}`);
    }

    if (!result.ok) {
      console.error('[API] ❌ Error response from', endpoint, ':', result.status, result.text?.substring(0, 200));
      throw new Error(`API error: ${result.status} - ${result.text}`);
    }

    console.log('[API] ✅ Success:', endpoint);
    return result.data as T;
  } catch (error) {
    console.error('[API] ❌ Request failed for', endpoint, ':', error);
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
