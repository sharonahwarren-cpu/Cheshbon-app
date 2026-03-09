
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

/**
 * Backend URL is configured in app.json under expo.extra.backendUrl
 * It is set automatically when the backend is deployed
 */
export const BACKEND_URL =
  Constants.expoConfig?.extra?.backendUrl || 'https://a8sew4dfz3q59y6r9k8fhpt2jfdhpm8d.app.specular.dev';

console.log('[API] 🌐 Backend URL configured:', BACKEND_URL);

/**
 * Check if backend is properly configured
 */
export const isBackendConfigured = (): boolean => {
  const configured = !!BACKEND_URL && BACKEND_URL.length > 0 && !BACKEND_URL.includes('undefined');
  if (!configured) {
    console.error('[API] ❌ Backend URL is not properly configured:', BACKEND_URL);
  }
  return configured;
};

/**
 * Get Supabase session token for authenticated requests
 */
const getSupabaseToken = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};

/**
 * Handle 401 Unauthorized errors by redirecting to auth
 */
const handle401Error = async () => {
  console.error('[API] 🚨 401 Unauthorized - Session expired or invalid');
  
  // Sign out from Supabase
  await supabase.auth.signOut();
  
  // Redirect to auth screen
  setTimeout(() => {
    try {
      router.replace('/auth');
    } catch (navError) {
      console.error('[API] Navigation error:', navError);
    }
  }, 100);
};

/**
 * Generic API call helper with Supabase authentication
 */
export const apiCall = async <T = any>(endpoint: string, options?: RequestInit): Promise<T> => {
  if (!isBackendConfigured()) {
    const errorMsg = 'Backend URL is not configured. Please check your app configuration.';
    console.error('[API] ❌', errorMsg);
    throw new Error(errorMsg);
  }

  const url = `${BACKEND_URL}${endpoint}`;
  console.log('[API] 🌐 Calling:', url, options?.method || 'GET');

  try {
    // Get Supabase session token
    const token = await getSupabaseToken();
    console.log('[API] 🔑 Supabase token:', token ? 'YES' : 'NO');

    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string> || {}),
    };

    // Add Supabase token if available
    if (token) {
      baseHeaders['Authorization'] = `Bearer ${token}`;
    }

    // Add platform headers for mobile
    if (Platform.OS !== 'web') {
      baseHeaders['X-Mobile-App'] = 'cheshbon';
      baseHeaders['X-Platform'] = Platform.OS;
    }

    const fetchOptions: RequestInit = {
      ...options,
      headers: baseHeaders,
    };

    const response = await fetch(url, fetchOptions);
    console.log('[API] 📥 Response status:', response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error('[API] ❌ Error response:', response.status, text.substring(0, 200));
      
      // Handle 401 errors
      if (response.status === 401) {
        await handle401Error();
      }
      
      throw new Error(`API error: ${response.status} - ${text}`);
    }

    const data = await response.json();
    console.log('[API] ✅ Success:', endpoint);
    return data as T;
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
 */
export const apiDelete = async <T = any>(endpoint: string, data: any = {}): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: 'DELETE',
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated API call helper (uses Supabase token)
 */
export const authenticatedApiCall = async <T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> => {
  return apiCall<T>(endpoint, options);
};

/**
 * Authenticated GET request
 */
export const authenticatedGet = async <T = any>(endpoint: string): Promise<T> => {
  return apiCall<T>(endpoint, { method: 'GET' });
};

/**
 * Authenticated POST request
 */
export const authenticatedPost = async <T = any>(endpoint: string, data: any): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated PUT request
 */
export const authenticatedPut = async <T = any>(endpoint: string, data: any): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated PATCH request
 */
export const authenticatedPatch = async <T = any>(endpoint: string, data: any): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated DELETE request
 */
export const authenticatedDelete = async <T = any>(
  endpoint: string,
  data: any = {}
): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: 'DELETE',
    body: JSON.stringify(data),
  });
};

// Legacy exports for backward compatibility
export const BEARER_TOKEN_KEY = 'cheshbon_bearer_token'; // Not used with Supabase
export const getBearerToken = async () => {
  const token = await getSupabaseToken();
  return token;
};
export const setBearerToken = async (token: string) => {
  console.warn('[API] setBearerToken called but Supabase manages tokens automatically');
};
export const clearBearerToken = async () => {
  await supabase.auth.signOut();
};
export const markAuthSuccess = () => {
  console.log('[API] markAuthSuccess called (no-op with Supabase)');
};
export const resetAuthSuccess = () => {
  console.log('[API] resetAuthSuccess called (no-op with Supabase)');
};
export const setUserAuthState = (authenticated: boolean) => {
  console.log('[API] setUserAuthState called:', authenticated, '(no-op with Supabase)');
};
