
/**
 * DEPRECATED: This file is kept for backward compatibility only.
 * All new code should use utils/supabaseApi.ts instead.
 * 
 * The app has migrated from Liquid Backend to Supabase.
 * Direct Supabase client usage is now the recommended approach.
 */

import { supabase } from '@/lib/supabase';

console.warn('[API] ⚠️ utils/api.ts is deprecated. Use utils/supabaseApi.ts for new code.');

/**
 * Get Supabase session token for authenticated requests
 */
const getSupabaseToken = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
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

// Deprecated API call functions - these will throw errors to help identify code that needs migration
export const apiCall = async <T = any>(endpoint: string, options?: RequestInit): Promise<T> => {
  throw new Error('apiCall is deprecated. Use Supabase client directly via utils/supabaseApi.ts');
};

export const apiGet = async <T = any>(endpoint: string): Promise<T> => {
  throw new Error('apiGet is deprecated. Use Supabase client directly via utils/supabaseApi.ts');
};

export const apiPost = async <T = any>(endpoint: string, data: any): Promise<T> => {
  throw new Error('apiPost is deprecated. Use Supabase client directly via utils/supabaseApi.ts');
};

export const apiPut = async <T = any>(endpoint: string, data: any): Promise<T> => {
  throw new Error('apiPut is deprecated. Use Supabase client directly via utils/supabaseApi.ts');
};

export const apiPatch = async <T = any>(endpoint: string, data: any): Promise<T> => {
  throw new Error('apiPatch is deprecated. Use Supabase client directly via utils/supabaseApi.ts');
};

export const apiDelete = async <T = any>(endpoint: string, data: any = {}): Promise<T> => {
  throw new Error('apiDelete is deprecated. Use Supabase client directly via utils/supabaseApi.ts');
};

export const authenticatedApiCall = async <T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> => {
  throw new Error('authenticatedApiCall is deprecated. Use Supabase client directly via utils/supabaseApi.ts');
};

export const authenticatedGet = async <T = any>(endpoint: string): Promise<T> => {
  throw new Error('authenticatedGet is deprecated. Use Supabase client directly via utils/supabaseApi.ts');
};

export const authenticatedPost = async <T = any>(endpoint: string, data: any): Promise<T> => {
  throw new Error('authenticatedPost is deprecated. Use Supabase client directly via utils/supabaseApi.ts');
};

export const authenticatedPut = async <T = any>(endpoint: string, data: any): Promise<T> => {
  throw new Error('authenticatedPut is deprecated. Use Supabase client directly via utils/supabaseApi.ts');
};

export const authenticatedPatch = async <T = any>(endpoint: string, data: any): Promise<T> => {
  throw new Error('authenticatedPatch is deprecated. Use Supabase client directly via utils/supabaseApi.ts');
};

export const authenticatedDelete = async <T = any>(
  endpoint: string,
  data: any = {}
): Promise<T> => {
  throw new Error('authenticatedDelete is deprecated. Use Supabase client directly via utils/supabaseApi.ts');
};

// Backward compatibility exports
export const BACKEND_URL = 'DEPRECATED';
export const isBackendConfigured = () => false;
