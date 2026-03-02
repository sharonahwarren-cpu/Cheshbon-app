
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';

// Essential for auth session cleanup on web
WebBrowser.maybeCompleteAuthSession();

const BACKEND_URL =
  Constants.expoConfig?.extra?.backendUrl ||
  'https://a8sew4dfz3q59y6r9k8fhpt2jfdhpm8d.app.specular.dev';
const BEARER_TOKEN_KEY = 'cheshbon_bearer_token';
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

// Helper to get token from storage
async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(BEARER_TOKEN_KEY);
    } else {
      return await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
    }
  } catch (error) {
    console.error('❌ [AUTH] Error getting stored token:', error);
    return null;
  }
}

// Helper to save token to storage
async function saveToken(token: string): Promise<void> {
  console.log('💾 [AUTH] Saving token to storage...');
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(BEARER_TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token);
      // CRITICAL iOS FIX: Add delay to ensure SecureStore write completes
      // This prevents race conditions where subsequent API calls try to read
      // the token before it's fully persisted
      if (Platform.OS === 'ios') {
        console.log('⏳ [AUTH] iOS: Waiting for SecureStore to persist...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verify the token was actually saved
        const verifyToken = await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
        if (verifyToken === token) {
          console.log('✅ [AUTH] iOS: Token verified in SecureStore');
        } else {
          console.error('❌ [AUTH] iOS: Token verification failed!');
          throw new Error('Failed to persist token to SecureStore');
        }
      }
    }
    console.log('✅ [AUTH] Token saved successfully');
  } catch (error) {
    console.error('❌ [AUTH] Error saving token:', error);
    throw error;
  }
}

// Helper to clear all auth tokens
async function clearTokens(): Promise<void> {
  console.log('🗑️ [AUTH] Clearing all tokens...');
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(BEARER_TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY);
    }
    console.log('✅ [AUTH] Tokens cleared');
  } catch (error) {
    console.error('❌ [AUTH] Error clearing tokens:', error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user session on mount
  useEffect(() => {
    console.log('🔄 [AUTH] AuthProvider mounted, fetching user...');
    fetchUser();
  }, []);

  const fetchUser = async (providedToken?: string): Promise<User | null> => {
    console.log('🔄 [AUTH] Fetching user session...');
    try {
      // Use provided token if available (for immediate validation after sign-in)
      // Otherwise retrieve from storage
      const token = providedToken || await getStoredToken();
      if (!token) {
        console.log('⚠️ [AUTH] No token found, user not authenticated');
        setUser(null);
        setLoading(false);
        return null;
      }

      console.log('🔄 [AUTH] Token found, validating with backend...');
      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(Platform.OS !== 'web' ? { 'X-Mobile-App': 'cheshbon', 'Origin': BACKEND_URL } : {}),
        },
      });

      console.log('🔄 [AUTH] /api/auth/me response status:', response.status);

      if (!response.ok) {
        console.error('❌ [AUTH] Session validation failed:', response.status);
        const errorText = await response.text();
        console.error('❌ [AUTH] Error response:', errorText);
        
        // Clear invalid token on 401/403
        if (response.status === 401 || response.status === 403) {
          console.log('🗑️ [AUTH] Clearing invalid token due to 401/403');
          await clearTokens();
          setUser(null);
        }
        setLoading(false);
        return null;
      }

      const userData = await response.json();
      console.log('✅ [AUTH] User session validated. Keys:', Object.keys(userData));

      // Backend returns { user: {...}, session: { token: '...', expiresAt: '...' }, token: '...' }
      const userObj = userData.user || userData;

      // If the backend returned a refreshed/updated token, update our stored token
      const refreshedToken = userData.token || userData.session?.token;
      if (refreshedToken && refreshedToken !== token) {
        console.log('🔄 [AUTH] Updating stored token with refreshed token');
        await saveToken(refreshedToken);
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

      if (!token) {
        console.error('❌ [EMAIL] No token in response. Full response:', JSON.stringify(data).substring(0, 500));
        throw new Error('No authentication token received from server. Please try again.');
      }

      await saveToken(token);

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

      // Validate session with backend to ensure token works
      // Pass the token directly to avoid SecureStore timing issues on iOS
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

      await saveToken(token);

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

      // Pass the token directly to avoid SecureStore timing issues on iOS
      await fetchUser(token);
      console.log('✅ [EMAIL] Sign up successful');
    } catch (error) {
      console.error('❌ [EMAIL] Sign up error:', error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    console.log('📱 [GOOGLE] Initiating Google sign-in...');

    if (Platform.OS === 'web') {
      // Web: open popup to Better Auth OAuth endpoint
      return new Promise<void>((resolve, reject) => {
        try {
          const callbackURL = `${window.location.origin}/auth-popup-callback`;
          
          // Use the correct OAuth initiation endpoint: /api/auth/initiate-social
          // This returns { authorizationUrl: '...' } which we then open in a popup
          console.log('📱 [GOOGLE WEB] Fetching authorization URL from backend...');

          fetch(`${BACKEND_URL}/api/auth/initiate-social`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'google', callbackURL, redirectURL: callbackURL }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const errText = await res.text();
                console.error('❌ [GOOGLE WEB] initiate-social failed:', errText);
                throw new Error('Failed to get Google authorization URL');
              }
              return res.json();
            })
            .then((data) => {
              const authUrl = data.authorizationUrl;
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
                    await saveToken(event.data.token);
                    // Pass token directly to avoid storage timing issues
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
      // Native: Get OAuth URL from backend using /api/auth/initiate-social, then open in browser
      // NOTE: We use initiate-social (not oauth-start) because initiate-social correctly uses
      // BASE_URL (the actual backend URL) while oauth-start uses FRONTEND_URL (may be localhost)
      try {
        const callbackUrl = `${APP_SCHEME}://auth-callback`;
        console.log('📱 [GOOGLE NATIVE] Callback URL:', callbackUrl);

        // Use /api/auth/initiate-social endpoint - correctly uses BASE_URL for authorization URL
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
          throw new Error(`Failed to initiate Google sign-in: ${errorText}`);
        }

        const initData = await initResponse.json();
        const authUrl = initData.authorizationUrl;
        console.log('📱 [GOOGLE NATIVE] Authorization URL received:', authUrl?.substring(0, 100));

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
        await saveToken(token);
        // Pass token directly to avoid SecureStore timing issues on iOS
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
      // Web: Use Better Auth OAuth flow via initiate-social endpoint
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
              const authUrl = data.authorizationUrl;
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
                    await saveToken(event.data.token);
                    // Pass token directly to avoid storage timing issues
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

      // Backend returns { token, user } consistently
      const token = data.token || data.session?.token || data.sessionToken || data.accessToken;

      if (!token) {
        console.error('❌ [APPLE NATIVE] No token in response. Full response:', JSON.stringify(data).substring(0, 500));
        throw new Error('No authentication token received from server after Apple sign-in');
      }

      console.log('✅ [APPLE NATIVE] Token received (length:', token.length, '), saving...');
      await saveToken(token);

      // Set user immediately from sign-in response to avoid extra round-trip
      if (data.user && data.user.id) {
        console.log('📞 [APPLE NATIVE] Setting user from response directly:', data.user.id);
        setUser(data.user);
        setLoading(false);
      }

      // Validate session with backend to ensure token works
      // Pass the token directly to avoid SecureStore timing issues on iOS
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

    // Attempt biometric authentication - disable device fallback to avoid
    // immediately showing passcode prompt when biometrics aren't set up
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to Cheshbon',
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: true,
    });

    if (result.success) {
      await signInWithEmail(email, password);
    } else if (result.error === 'user_fallback') {
      // User explicitly chose to use passcode - allow it
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
    try {
      const token = await getStoredToken();
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
      await clearTokens();
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
