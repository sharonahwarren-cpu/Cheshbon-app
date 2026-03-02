
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { getBearerToken, setBearerToken, clearBearerToken, markAuthSuccess, resetAuthSuccess, setUserAuthState } from '@/utils/api';

// Essential for auth session cleanup on web
WebBrowser.maybeCompleteAuthSession();

const BACKEND_URL =
  Constants.expoConfig?.extra?.backendUrl ||
  'https://a8sew4dfz3q59y6r9k8fhpt2jfdhpm8d.app.specular.dev';
const BIOMETRIC_EMAIL_KEY = 'cheshbon_biometric_email';
const BIOMETRIC_PASSWORD_KEY = 'cheshbon_biometric_password';

// Mobile app scheme for deep linking
const APP_SCHEME = 'cheshbon';

interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithBiometrics?: () => Promise<void>;
  checkBiometricsAvailable?: () => Promise<boolean>;
  signOut: () => Promise<void>;
  fetchUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user session on mount
  useEffect(() => {
    console.log('🔄 [AUTH] AuthProvider mounted, fetching user...');
    fetchUser();
  }, []);

  // Sync user authentication state with the API layer
  // This allows the API layer to know if the user is authenticated
  // and prevent 401 errors from clearing the token when user is active
  useEffect(() => {
    setUserAuthState(!!user);
    console.log('🔐 [AUTH] User auth state synced to API layer:', !!user);
  }, [user]);

  /**
   * Validate session token with backend with retry logic for iOS race conditions.
   * 
   * BACKEND FIX DEPLOYED: The backend auth-wrapper now checks the database FIRST
   * before trying framework auth. This means valid sessions are accepted immediately,
   * eliminating the 212 iOS errors after login.
   * 
   * This retry logic is now a lightweight safety net for any remaining edge cases.
   * Reduced from 6 retries to 3 retries, and from 500ms initial delay to 300ms.
   */
  const validateSessionWithRetry = async (
    token: string,
    maxRetries: number = 3,
    initialDelayMs: number = 300
  ): Promise<{ ok: boolean; data?: any; status?: number; errorText?: string; sessionInDb?: boolean }> => {
    let lastStatus = 0;
    let lastErrorText = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 300ms, 600ms, 1200ms
        const delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), 3000);
        console.log(`🔄 [AUTH] Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      try {
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Platform': Platform.OS,
        };

        if (Platform.OS !== 'web') {
          headers['X-Mobile-App'] = 'cheshbon';
          headers['Origin'] = BACKEND_URL;
        }

        console.log(`🔄 [AUTH] /api/auth/me attempt ${attempt + 1}/${maxRetries + 1}`);
        console.log(`🔄 [AUTH] Token (first 30 chars): ${token.substring(0, 30)}...`);

        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          method: 'GET',
          headers,
        });

        console.log(`🔄 [AUTH] /api/auth/me response status (attempt ${attempt + 1}):`, response.status);

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ [AUTH] Session validated on attempt ${attempt + 1}`);
          return { ok: true, data, status: response.status };
        }

        lastStatus = response.status;
        lastErrorText = await response.text();
        console.error(`❌ [AUTH] Attempt ${attempt + 1} failed: ${response.status} - ${lastErrorText.substring(0, 200)}`);

        // Only retry on 401 (session might not be committed yet)
        // Don't retry on 403 (forbidden) or other errors
        if (response.status !== 401) {
          console.error(`❌ [AUTH] Non-401 error (${response.status}), not retrying`);
          return { ok: false, status: lastStatus, errorText: lastErrorText };
        }

        if (attempt === maxRetries) {
          console.error(`❌ [AUTH] All ${maxRetries + 1} attempts failed with 401`);
          return { ok: false, status: lastStatus, errorText: lastErrorText, sessionInDb: false };
        }
      } catch (networkError) {
        console.error(`❌ [AUTH] Network error on attempt ${attempt + 1}:`, networkError);
        // Don't retry on network errors
        return { ok: false, status: 0, errorText: String(networkError) };
      }
    }

    return { ok: false, status: lastStatus, errorText: lastErrorText };
  };

  const fetchUser = async (providedToken?: string): Promise<User | null> => {
    console.log('🔄 [AUTH] Fetching user session...');
    console.log('🔄 [AUTH] providedToken:', providedToken ? `YES (${providedToken.substring(0, 20)}...)` : 'NO');
    try {
      // Use provided token if available (for immediate validation after sign-in)
      // Otherwise retrieve from storage (uses cache on iOS)
      const token = providedToken || await getBearerToken();
      if (!token) {
        console.log('⚠️ [AUTH] No token found, user not authenticated');
        setUser(null);
        setLoading(false);
        return null;
      }

      console.log('🔄 [AUTH] Token to use:', token.substring(0, 30) + '...');
      console.log('🔄 [AUTH] Platform:', Platform.OS);
      console.log('🔄 [AUTH] Validating with backend...');

      // BACKEND FIX DEPLOYED: The backend auth-wrapper now checks the database FIRST.
      // This means /api/auth/me should succeed on the first attempt for all valid sessions.
      // We still use retry logic as a safety net for edge cases.
      let result: { ok: boolean; data?: any; status?: number; errorText?: string; sessionInDb?: boolean };

      if (Platform.OS !== 'web') {
        // iOS/Android: use retry with backoff as safety net
        // Fresh tokens (just signed in): 3 retries with 300ms initial delay
        // Stored tokens (app restart): 2 retries with 200ms initial delay
        const maxRetries = providedToken ? 3 : 2;
        const initialDelay = providedToken ? 300 : 200;
        console.log('🔄 [AUTH] Native retry config:', { maxRetries, initialDelay, isFreshToken: !!providedToken });
        result = await validateSessionWithRetry(token, maxRetries, initialDelay);
      } else {
        // Web: single attempt (no retry needed on web)
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        };

        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          method: 'GET',
          headers,
        });

        console.log('🔄 [AUTH] /api/auth/me response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          result = { ok: true, data, status: response.status };
        } else {
          const errorText = await response.text();
          result = { ok: false, status: response.status, errorText };
        }
      }

      if (!result.ok) {
        console.error('❌ [AUTH] Session validation failed:', result.status);
        console.error('❌ [AUTH] Error response:', result.errorText?.substring(0, 200));

        if (!providedToken) {
          // Stored token failed - clear it and log out
          if (result.status === 401 || result.status === 403) {
            console.log('🗑️ [AUTH] Clearing invalid stored token due to 401/403');
            await clearBearerToken();
            setUser(null);
          }
        } else {
          // Fresh sign-in token failed even with retries
          // IMPORTANT: Do NOT clear the token or user here if user was already set from sign-in response
          // The user object was set directly from the sign-in API response, which is authoritative
          console.error('❌ [AUTH] Fresh token rejected by /api/auth/me after retries');
          console.error('❌ [AUTH] Status:', result.status, '- Error:', result.errorText?.substring(0, 200));
          console.log('⚠️ [AUTH] User was set from sign-in response - keeping user authenticated');
          console.log('⚠️ [AUTH] Token is still valid for API calls (was just created by sign-in endpoint)');
          // Don't clear token or user - the sign-in was successful
        }
        setLoading(false);
        return null;
      }

      const userData = result.data;
      console.log('✅ [AUTH] User session validated. Keys:', Object.keys(userData));

      // Backend returns { user: {...}, session: { token: '...', expiresAt: '...' }, token: '...' }
      const userObj = userData.user || userData;

      // If the backend returned a refreshed/updated token, update our stored token
      const refreshedToken = userData.token || userData.session?.token;
      if (refreshedToken && refreshedToken !== token) {
        console.log('🔄 [AUTH] Updating stored token with refreshed token');
        await setBearerToken(refreshedToken);
      }

      setUser(userObj);
      setLoading(false);
      return userObj;
    } catch (error) {
      console.error('❌ [AUTH] Failed to fetch user:', error);
      // Don't clear tokens on network errors - user might just be offline
      // Keep existing user state if we have one
      setLoading(false);
      return null;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    console.log('📧 [EMAIL] Signing in with email:', email);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Mobile app identifier - also set Origin to avoid CORS issues
      if (Platform.OS !== 'web') {
        headers['X-Mobile-App'] = 'cheshbon';
        headers['Origin'] = BACKEND_URL;
      }

      const response = await fetch(`${BACKEND_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers,
        credentials: Platform.OS === 'web' ? 'include' : 'omit',
        body: JSON.stringify({ email, password }),
      });

      console.log('📧 [EMAIL] Response status:', response.status);
      const responseText = await response.text();
      console.log('📧 [EMAIL] Response body:', responseText.substring(0, 500));

      if (!response.ok) {
        let errorMessage = `Sign in failed (${response.status})`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = JSON.parse(responseText);
      console.log('📧 [EMAIL] Parsed response keys:', Object.keys(data));

      // Backend returns { token, user } - extract token from standard locations
      const token =
        data.token ||
        data.session?.token ||
        data.sessionToken ||
        data.accessToken ||
        data.data?.token ||
        data.data?.session?.token;

      console.log('📧 [EMAIL] Token extracted:', token ? 'YES (length: ' + token.length + ')' : 'NO');
      if (token) {
        console.log('📧 [EMAIL] Token value:', token.substring(0, 30) + '...');
      }

      if (!token) {
        console.error('❌ [EMAIL] No token in response. Full response:', JSON.stringify(data).substring(0, 500));
        throw new Error('No authentication token received from server. Please try again.');
      }

      // CRITICAL iOS FIX: Save token using the centralized function with caching
      console.log('📧 [EMAIL] Saving token to storage...');
      await setBearerToken(token);
      console.log('📧 [EMAIL] Token saved successfully');

      // Mark auth success to start grace period (prevents 401 race conditions)
      markAuthSuccess();

      // Set user immediately from sign-in response to avoid extra round-trip
      const userObj = data.user || null;
      if (userObj && userObj.id) {
        console.log('📧 [EMAIL] Setting user from sign-in response:', userObj.id);
        setUser(userObj);
        setLoading(false);
      }

      // Store credentials for biometric login (native only)
      if (Platform.OS !== 'web') {
        try {
          await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email);
          await SecureStore.setItemAsync(BIOMETRIC_PASSWORD_KEY, password);
          console.log('🔐 [EMAIL] Credentials stored for biometric login');
        } catch (error) {
          console.error('⚠️ [EMAIL] Failed to store biometric credentials:', error);
        }
      }

      // BACKEND FIX: The backend now checks DB first, so no delay needed.
      // Pass the token directly to fetchUser to avoid retrieval race condition on iOS.
      console.log('📧 [EMAIL] Validating session with token:', token.substring(0, 30) + '...');
      await fetchUser(token);
      console.log('✅ [EMAIL] Sign in successful');
    } catch (error) {
      console.error('❌ [EMAIL] Sign in error:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    console.log('📧 [EMAIL] Signing up with email:', email);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (Platform.OS !== 'web') {
        headers['X-Mobile-App'] = 'cheshbon';
        headers['Origin'] = BACKEND_URL;
      }

      const response = await fetch(`${BACKEND_URL}/api/auth/sign-up/email`, {
        method: 'POST',
        headers,
        credentials: Platform.OS === 'web' ? 'include' : 'omit',
        body: JSON.stringify({ email, password, name: name || email.split('@')[0] }),
      });

      console.log('📧 [EMAIL] Sign-up response status:', response.status);
      const responseText = await response.text();
      console.log('📧 [EMAIL] Sign-up response body:', responseText.substring(0, 500));

      if (!response.ok) {
        let errorMessage = `Sign up failed (${response.status})`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = JSON.parse(responseText);
      console.log('📧 [EMAIL] Sign-up parsed response keys:', Object.keys(data));

      const token =
        data.token ||
        data.session?.token ||
        data.sessionToken ||
        data.accessToken ||
        data.data?.token ||
        data.data?.session?.token;

      console.log('📧 [EMAIL] Sign-up token extracted:', token ? 'YES (length: ' + token.length + ')' : 'NO');

      if (!token) {
        console.error('❌ [EMAIL] No token in sign-up response. Full response:', JSON.stringify(data).substring(0, 500));
        // For sign-up, try signing in immediately after
        console.log('📧 [EMAIL] Attempting sign-in after sign-up...');
        await signInWithEmail(email, password);
        return;
      }

      // CRITICAL: Save token using the centralized function with caching
      await setBearerToken(token);

      // Mark auth success to start grace period (prevents 401 race conditions)
      markAuthSuccess();

      // Set user immediately from sign-up response
      const userObj = data.user || null;
      if (userObj && userObj.id) {
        console.log('📧 [EMAIL] Setting user from sign-up response:', userObj.id);
        setUser(userObj);
        setLoading(false);
      }

      // Store credentials for biometric login (native only)
      if (Platform.OS !== 'web') {
        try {
          await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email);
          await SecureStore.setItemAsync(BIOMETRIC_PASSWORD_KEY, password);
          console.log('🔐 [EMAIL] Credentials stored for biometric login');
        } catch (error) {
          console.error('⚠️ [EMAIL] Failed to store biometric credentials:', error);
        }
      }

      // BACKEND FIX: The backend now checks DB first, so no delay needed.
      // Pass the token directly - it's now cached in memory on iOS.
      await fetchUser(token);
      console.log('✅ [EMAIL] Sign up successful');
    } catch (error) {
      console.error('❌ [EMAIL] Sign up error:', error);
      throw error;
    }
  };

  /**
   * Fix authorization URL to ensure it uses the correct backend URL.
   * The backend may return a localhost URL if BASE_URL env var is misconfigured.
   * We detect this and replace with the known BACKEND_URL.
   */
  const fixAuthorizationUrl = (authUrl: string): string => {
    if (!authUrl) return authUrl;
    try {
      const parsed = new URL(authUrl);
      // If the URL points to localhost or 127.0.0.1, replace with the real backend URL
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        console.warn('📱 [OAUTH] Authorization URL points to localhost - replacing with real backend URL');
        console.warn('📱 [OAUTH] Original URL:', authUrl.substring(0, 100));
        const backendParsed = new URL(BACKEND_URL);
        parsed.hostname = backendParsed.hostname;
        parsed.port = backendParsed.port || '';
        parsed.protocol = backendParsed.protocol;
        const fixed = parsed.toString();
        console.log('📱 [OAUTH] Fixed URL:', fixed.substring(0, 100));
        return fixed;
      }
    } catch (e) {
      console.error('📱 [OAUTH] Error parsing authorization URL:', e);
    }
    return authUrl;
  };

  /**
   * Check if a URL is a real Google OAuth authorization URL
   * (i.e., points to accounts.google.com, not a backend self-referencing URL)
   */
  const isRealGoogleOAuthUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'accounts.google.com';
    } catch {
      return false;
    }
  };

  /**
   * Check if a URL is a backend self-referencing URL that won't redirect to Google
   * (e.g., https://backend.com/api/auth/sign-in/social?provider=google)
   */
  const isBackendSocialSignInUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.pathname.includes('/api/auth/sign-in/social') || 
             parsed.pathname.includes('/api/auth/sign-in/');
    } catch {
      return false;
    }
  };

  const signInWithGoogle = async () => {
    console.log('📱 [GOOGLE] Initiating Google sign-in...');

    if (Platform.OS === 'web') {
      // Web: open popup to Google OAuth endpoint
      return new Promise<void>((resolve, reject) => {
        try {
          const callbackURL = `${window.location.origin}/auth-popup-callback`;
          
          console.log('📱 [GOOGLE WEB] Fetching authorization URL from backend...');
          console.log('📱 [GOOGLE WEB] callbackURL:', callbackURL);

          fetch(`${BACKEND_URL}/api/auth/initiate-social`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'google', callbackURL, redirectURL: callbackURL }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const errText = await res.text();
                console.error('❌ [GOOGLE WEB] initiate-social failed:', errText);
                let errorMessage = 'Failed to get Google authorization URL';
                try {
                  const errData = JSON.parse(errText);
                  if (errData.error === 'OAUTH_NOT_CONFIGURED') {
                    errorMessage = 'Google Sign-In is not available. Please use email/password sign-in.';
                  } else if (errData.message) {
                    errorMessage = errData.message;
                  }
                } catch { /* ignore parse errors */ }
                throw new Error(errorMessage);
              }
              return res.json();
            })
            .then(async (data) => {
              console.log('📱 [GOOGLE WEB] initiate-social response:', JSON.stringify(data).substring(0, 200));
              let authUrl = fixAuthorizationUrl(data.authorizationUrl);
              console.log('📱 [GOOGLE WEB] Authorization URL from backend:', authUrl?.substring(0, 150));

              if (!authUrl) {
                throw new Error('No authorization URL received from server');
              }

              // Validate that the backend returned a real Google OAuth URL
              // The backend fix ensures /api/auth/initiate-social returns accounts.google.com URL
              if (!isRealGoogleOAuthUrl(authUrl)) {
                console.warn('⚠️ [GOOGLE WEB] Backend did not return a Google OAuth URL:', authUrl?.substring(0, 100));
                // If it's a backend self-referencing URL, it means the backend fix hasn't taken effect
                // In this case, we cannot proceed - the backend must return the Google OAuth URL
                if (isBackendSocialSignInUrl(authUrl)) {
                  throw new Error('Google Sign-In is not properly configured on the server. Please try again later or use email/password sign-in.');
                }
              }

              console.log('📱 [GOOGLE WEB] Opening popup with URL:', authUrl?.substring(0, 80));

              const width = 500;
              const height = 600;
              const left = window.screen.width / 2 - width / 2;
              const top = window.screen.height / 2 - height / 2;

              const popup = window.open(
                authUrl,
                'Google Sign In',
                `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
              );

              if (!popup) {
                reject(new Error('Failed to open popup. Please allow popups for this site.'));
                return;
              }

              const handleMessage = async (event: MessageEvent) => {
                if (event.origin !== window.location.origin) return;

                console.log('📱 [GOOGLE WEB] Received message:', event.data?.type);

                if (event.data?.type === 'auth-success' && event.data.token) {
                  console.log('✅ [GOOGLE WEB] Token received');
                  window.removeEventListener('message', handleMessage);
                  clearInterval(checkClosed);
                  try { popup.close(); } catch (e) { /* ignore */ }

                  try {
                    await setBearerToken(event.data.token);
                    markAuthSuccess();
                    await fetchUser(event.data.token);
                    resolve();
                  } catch (err) {
                    reject(err);
                  }
                } else if (event.data?.type === 'auth-error') {
                  console.error('❌ [GOOGLE WEB] Auth error:', event.data.error);
                  window.removeEventListener('message', handleMessage);
                  clearInterval(checkClosed);
                  try { popup.close(); } catch (e) { /* ignore */ }
                  reject(new Error(event.data.error || 'Google sign-in failed'));
                }
              };

              window.addEventListener('message', handleMessage);

              const checkClosed = setInterval(() => {
                try {
                  if (popup.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', handleMessage);
                    console.log('⚠️ [GOOGLE WEB] Popup closed by user');
                    resolve();
                  }
                } catch (e) {
                  clearInterval(checkClosed);
                }
              }, 500);

              setTimeout(() => {
                clearInterval(checkClosed);
                window.removeEventListener('message', handleMessage);
                try { popup.close(); } catch (e) { /* ignore */ }
                reject(new Error('Google sign-in timed out'));
              }, 5 * 60 * 1000);
            })
            .catch((error) => {
              console.error('❌ [GOOGLE WEB] Error fetching auth URL:', error);
              reject(error);
            });
        } catch (error) {
          console.error('❌ [GOOGLE WEB] Error:', error);
          reject(error);
        }
      });
    } else {
      // Native: Get OAuth URL from backend, then open in browser
      try {
        const callbackUrl = `${APP_SCHEME}://auth-callback`;
        console.log('📱 [GOOGLE NATIVE] Callback URL:', callbackUrl);

        const initResponse = await fetch(`${BACKEND_URL}/api/auth/initiate-social`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Mobile-App': 'cheshbon',
            'Origin': BACKEND_URL,
          },
          body: JSON.stringify({
            provider: 'google',
            callbackURL: callbackUrl,
          }),
        });

        console.log('📱 [GOOGLE NATIVE] initiate-social response status:', initResponse.status);

        if (!initResponse.ok) {
          const errorText = await initResponse.text();
          console.error('❌ [GOOGLE NATIVE] initiate-social failed:', errorText);
          let errorMessage = 'Failed to initiate Google sign-in';
          try {
            const errData = JSON.parse(errorText);
            if (errData.error === 'OAUTH_NOT_CONFIGURED') {
              errorMessage = 'Google Sign-In is not available. Please use email/password sign-in.';
            } else if (errData.message) {
              errorMessage = errData.message;
            } else if (errData.error) {
              errorMessage = `Failed to initiate Google sign-in: ${errData.error}`;
            }
          } catch { /* ignore parse errors */ }
          throw new Error(errorMessage);
        }

        const initData = await initResponse.json();
        console.log('📱 [GOOGLE NATIVE] initiate-social response:', JSON.stringify(initData).substring(0, 200));
        // Fix authorization URL in case backend returned localhost URL
        let authUrl = fixAuthorizationUrl(initData.authorizationUrl);
        console.log('📱 [GOOGLE NATIVE] Authorization URL received:', authUrl?.substring(0, 150));

        if (!authUrl) {
          throw new Error('No authorization URL received from server');
        }

        // Validate that the backend returned a real Google OAuth URL
        if (!isRealGoogleOAuthUrl(authUrl)) {
          console.warn('⚠️ [GOOGLE NATIVE] Backend did not return a Google OAuth URL:', authUrl?.substring(0, 100));
          if (isBackendSocialSignInUrl(authUrl)) {
            throw new Error('Google Sign-In is not properly configured on the server. Please try again later or use email/password sign-in.');
          }
        }

        await _openGoogleBrowser(authUrl, callbackUrl);
      } catch (error) {
        console.error('❌ [GOOGLE NATIVE] Error:', error);
        throw error;
      }
    }
  };

  // Helper to open Google OAuth in browser and handle callback
  const _openGoogleBrowser = async (authUrl: string, callbackUrl: string) => {
    if (!authUrl) {
      throw new Error('No authorization URL received from server');
    }

    const result = await WebBrowser.openAuthSessionAsync(authUrl, callbackUrl, {
      showInRecents: true,
      preferEphemeralSession: false,
    });

    console.log('📱 [GOOGLE NATIVE] Browser result:', result.type);

    if (result.type === 'success' && result.url) {
      console.log('📱 [GOOGLE NATIVE] Callback URL received:', result.url.substring(0, 100));
      const urlObj = new URL(result.url);
      const token =
        urlObj.searchParams.get('token') ||
        urlObj.searchParams.get('session_token') ||
        urlObj.searchParams.get('sessionToken') ||
        urlObj.searchParams.get('access_token');

      if (token) {
        console.log('✅ [GOOGLE NATIVE] Token extracted from callback URL');
        await setBearerToken(token);
        markAuthSuccess();
        await fetchUser(token);
      } else {
        console.error('❌ [GOOGLE NATIVE] No token in callback URL. Params:', urlObj.searchParams.toString());
        throw new Error('No authentication token received from Google sign-in');
      }
    } else if (result.type === 'cancel') {
      throw new Error('Google sign-in was cancelled');
    } else {
      console.log('⚠️ [GOOGLE NATIVE] Browser result type:', result.type);
    }
  };

  const signInWithApple = async () => {
    console.log('📞 [APPLE] Initiating Apple sign-in...');

    if (Platform.OS === 'web') {
      // Web: Use Better Auth OAuth flow
      return new Promise<void>((resolve, reject) => {
        try {
          const callbackURL = `${window.location.origin}/auth-popup-callback`;

          console.log('📞 [APPLE WEB] Fetching authorization URL from backend...');

          fetch(`${BACKEND_URL}/api/auth/initiate-social`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'apple', callbackURL, redirectURL: callbackURL }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const errText = await res.text();
                console.error('❌ [APPLE WEB] initiate-social failed:', errText);
                throw new Error('Failed to get Apple authorization URL');
              }
              return res.json();
            })
            .then((data) => {
              // Fix authorization URL in case backend returned localhost URL
              const authUrl = fixAuthorizationUrl(data.authorizationUrl);
              console.log('📞 [APPLE WEB] Opening popup...');

              const width = 500;
              const height = 600;
              const left = window.screen.width / 2 - width / 2;
              const top = window.screen.height / 2 - height / 2;

              const popup = window.open(
                authUrl,
                'Apple Sign In',
                `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
              );

              if (!popup) {
                reject(new Error('Failed to open popup. Please allow popups for this site.'));
                return;
              }

              const handleMessage = async (event: MessageEvent) => {
                if (event.origin !== window.location.origin) return;

                if (event.data?.type === 'auth-success' && event.data.token) {
                  window.removeEventListener('message', handleMessage);
                  clearInterval(checkClosed);
                  try { popup.close(); } catch (e) { /* ignore */ }

                  try {
                    await setBearerToken(event.data.token);
                    markAuthSuccess();
                    await fetchUser(event.data.token);
                    resolve();
                  } catch (err) {
                    reject(err);
                  }
                } else if (event.data?.type === 'auth-error') {
                  window.removeEventListener('message', handleMessage);
                  clearInterval(checkClosed);
                  try { popup.close(); } catch (e) { /* ignore */ }
                  reject(new Error(event.data.error || 'Apple sign-in failed'));
                }
              };

              window.addEventListener('message', handleMessage);

              const checkClosed = setInterval(() => {
                try {
                  if (popup.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', handleMessage);
                    resolve();
                  }
                } catch (e) {
                  clearInterval(checkClosed);
                }
              }, 500);

              setTimeout(() => {
                clearInterval(checkClosed);
                window.removeEventListener('message', handleMessage);
                try { popup.close(); } catch (e) { /* ignore */ }
                reject(new Error('Apple sign-in timed out'));
              }, 5 * 60 * 1000);
            })
            .catch((error) => {
              console.error('❌ [APPLE WEB] Error fetching auth URL:', error);
              reject(error);
            });
        } catch (error) {
          console.error('❌ [APPLE WEB] Error:', error);
          reject(error);
        }
      });
    }

    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS');
    }

    try {
      // Native iOS: Use AppleAuthentication to get identity token
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('✅ [APPLE NATIVE] Credential received from Apple');
      console.log('📞 [APPLE NATIVE] Has identityToken:', !!credential.identityToken);
      console.log('📞 [APPLE NATIVE] Has authorizationCode:', !!credential.authorizationCode);
      console.log('📞 [APPLE NATIVE] Has email:', !!credential.email);

      if (!credential.identityToken) {
        throw new Error('No identity token from Apple');
      }

      const userData =
        credential.email || credential.fullName?.givenName
          ? {
              name: {
                firstName: credential.fullName?.givenName || '',
                lastName: credential.fullName?.familyName || '',
              },
              email: credential.email || '',
            }
          : null;

      // Try /api/auth/apple/native first (Better Auth native endpoint)
      console.log('📞 [APPLE NATIVE] Sending to /api/auth/apple/native...');
      let response = await fetch(`${BACKEND_URL}/api/auth/apple/native`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Mobile-App': 'cheshbon',
          'Origin': BACKEND_URL,
        },
        body: JSON.stringify({
          id_token: credential.identityToken,
          code: credential.authorizationCode || undefined,
          user: userData ? JSON.stringify(userData) : undefined,
        }),
      });

      console.log('📞 [APPLE NATIVE] /apple/native response status:', response.status);

      // If /apple/native fails, try /apple-callback as fallback
      if (!response.ok) {
        console.log('📞 [APPLE NATIVE] Trying fallback /api/auth/apple-callback...');
        response = await fetch(`${BACKEND_URL}/api/auth/apple-callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Mobile-App': 'cheshbon',
            'Origin': BACKEND_URL,
          },
          body: JSON.stringify({
            id_token: credential.identityToken,
            code: credential.authorizationCode || undefined,
            user: userData ? JSON.stringify(userData) : undefined,
          }),
        });
        console.log('📞 [APPLE NATIVE] /apple-callback response status:', response.status);
      }

      const responseText = await response.text();
      console.log('📞 [APPLE NATIVE] Response body:', responseText.substring(0, 300));

      if (!response.ok) {
        let errorMsg = `Apple sign-in failed (${response.status})`;
        try {
          const errData = JSON.parse(responseText);
          errorMsg = errData.message || errData.error || errorMsg;
        } catch { /* ignore */ }
        throw new Error(errorMsg);
      }

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error('❌ [APPLE NATIVE] Failed to parse response as JSON:', responseText.substring(0, 200));
        throw new Error('Invalid response from server during Apple sign-in');
      }

      console.log('📞 [APPLE NATIVE] Response keys:', Object.keys(data));
      console.log('📞 [APPLE NATIVE] Full response (first 500 chars):', JSON.stringify(data).substring(0, 500));

      // Backend returns { token, user } consistently
      const token = data.token || data.session?.token || data.sessionToken || data.accessToken;

      if (!token) {
        console.error('❌ [APPLE NATIVE] No token in response. Full response:', JSON.stringify(data).substring(0, 1000));
        console.error('❌ [APPLE NATIVE] data.token:', data.token);
        console.error('❌ [APPLE NATIVE] data.session:', data.session);
        console.error('❌ [APPLE NATIVE] data.sessionToken:', data.sessionToken);
        console.error('❌ [APPLE NATIVE] data.accessToken:', data.accessToken);
        throw new Error('No authentication token received from server after Apple sign-in');
      }

      console.log('✅ [APPLE NATIVE] Token received (length:', token.length, ')');
      console.log('✅ [APPLE NATIVE] Token value:', token.substring(0, 50) + '...');
      console.log('✅ [APPLE NATIVE] Token type:', typeof token);
      
      // CRITICAL iOS FIX: Save token using the centralized function with caching
      console.log('📞 [APPLE NATIVE] Saving token to storage...');
      await setBearerToken(token);
      console.log('📞 [APPLE NATIVE] Token saved successfully');

      // Mark auth success to start grace period (prevents 401 race conditions on iOS)
      // This is CRITICAL for iOS - prevents other API calls from clearing the token
      // during the window between session creation and DB commit
      markAuthSuccess();

      // Set user immediately from sign-in response to avoid extra round-trip
      // This ensures the UI updates even if /api/auth/me validation takes time
      if (data.user && data.user.id) {
        console.log('📞 [APPLE NATIVE] Setting user from response directly:', data.user.id);
        setUser(data.user);
        setLoading(false);
      }

      // BACKEND FIX: The backend now checks DB first, so no delay needed.
      // Pass the token directly to fetchUser to avoid retrieval race condition.
      // fetchUser will use retry logic on iOS as a safety net.
      console.log('📞 [APPLE NATIVE] Validating session with token:', token.substring(0, 30) + '...');
      await fetchUser(token);
      console.log('✅ [APPLE NATIVE] Sign in successful');
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        throw new Error('Apple Sign-In was cancelled');
      }
      console.error('❌ [APPLE NATIVE] Error:', error);
      throw error;
    }
  };

  const checkBiometricsAvailable = async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;

    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) return false;
      return await LocalAuthentication.isEnrolledAsync();
    } catch {
      return false;
    }
  };

  const signInWithBiometrics = async () => {
    if (Platform.OS === 'web') {
      throw new Error('Biometric authentication not available on web');
    }

    const available = await checkBiometricsAvailable();
    if (!available) {
      throw new Error('Biometric authentication not available');
    }

    const email = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
    const password = await SecureStore.getItemAsync(BIOMETRIC_PASSWORD_KEY);

    if (!email || !password) {
      throw new Error('No stored credentials. Sign in with email first.');
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to Cheshbon',
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: true,
    });

    if (result.success) {
      await signInWithEmail(email, password);
    } else if (result.error === 'user_fallback') {
      const passcodeResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to Cheshbon',
        disableDeviceFallback: false,
      });
      if (passcodeResult.success) {
        await signInWithEmail(email, password);
      } else {
        throw new Error('Authentication failed');
      }
    } else {
      throw new Error('Biometric authentication failed');
    }
  };

  const signOut = async () => {
    console.log('🚪 [AUTH] Signing out...');
    // Clear user state immediately (don't wait for server)
    setUser(null);
    try {
      const token = await getBearerToken();
      if (token) {
        await fetch(`${BACKEND_URL}/api/auth/sign-out`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
      }
    } catch (error) {
      console.error('⚠️ [AUTH] Sign out API error:', error);
    } finally {
      // Reset auth success time so 401 errors will properly redirect to auth
      resetAuthSuccess();
      await clearBearerToken();
      setUser(null);
      console.log('✅ [AUTH] Signed out');
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple,
    signInWithBiometrics: Platform.OS !== 'web' ? signInWithBiometrics : undefined,
    checkBiometricsAvailable: Platform.OS !== 'web' ? checkBiometricsAvailable : undefined,
    signOut,
    fetchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
