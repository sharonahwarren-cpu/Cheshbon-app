
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

  const fetchUser = async (): Promise<User | null> => {
    console.log('🔄 [AUTH] Fetching user session...');
    try {
      const token = await getStoredToken();
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
        },
      });

      if (!response.ok) {
        console.error('❌ [AUTH] Session validation failed:', response.status);
        await clearTokens();
        setUser(null);
        setLoading(false);
        return null;
      }

      const userData = await response.json();
      console.log('✅ [AUTH] User session validated:', userData);
      // /api/auth/me returns { user: {...}, session: {...} }
      const userObj = userData.user || userData;
      setUser(userObj);
      setLoading(false);
      return userObj;
    } catch (error) {
      console.error('❌ [AUTH] Failed to fetch user:', error);
      await clearTokens();
      setUser(null);
      setLoading(false);
      return null;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    console.log('📧 [EMAIL] Signing in with email:', email);
    try {
      // CRITICAL FIX: Mobile apps need proper headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // For mobile, Better Auth may require Origin header or accept requests without it
      // The backend has been configured to accept mobile requests
      if (Platform.OS !== 'web') {
        headers['X-Mobile-App'] = 'cheshbon';
        console.log('📧 [EMAIL] Mobile app header set');
      }

      const response = await fetch(`${BACKEND_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers,
        credentials: Platform.OS === 'web' ? 'include' : 'omit',
        body: JSON.stringify({ email, password }),
      });

      console.log('📧 [EMAIL] Response status:', response.status);
      const responseText = await response.text();
      console.log('📧 [EMAIL] Response body (first 200 chars):', responseText.substring(0, 200));

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

      // Extract token from various possible locations
      const token = data.token || data.session?.token || data.user?.token || data.accessToken;
      console.log('📧 [EMAIL] Extracted token:', token ? 'YES' : 'NO');

      if (!token) {
        throw new Error('No authentication token received from server');
      }

      await saveToken(token);

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

      await fetchUser();
      console.log('✅ [EMAIL] Sign in successful');
    } catch (error) {
      console.error('❌ [EMAIL] Sign in error:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    console.log('📧 [EMAIL] Signing up with email:', email);
    try {
      // CRITICAL FIX: Mobile apps need proper headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // For mobile, Better Auth may require Origin header or accept requests without it
      // The backend has been configured to accept mobile requests
      if (Platform.OS !== 'web') {
        headers['X-Mobile-App'] = 'cheshbon';
        console.log('📧 [EMAIL] Mobile app header set');
      }

      const response = await fetch(`${BACKEND_URL}/api/auth/sign-up/email`, {
        method: 'POST',
        headers,
        credentials: Platform.OS === 'web' ? 'include' : 'omit',
        body: JSON.stringify({ email, password, name }),
      });

      console.log('📧 [EMAIL] Response status:', response.status);
      const responseText = await response.text();
      console.log('📧 [EMAIL] Response body (first 200 chars):', responseText.substring(0, 200));

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
      console.log('📧 [EMAIL] Parsed response keys:', Object.keys(data));

      const token = data.token || data.session?.token || data.user?.token || data.accessToken;
      console.log('📧 [EMAIL] Extracted token:', token ? 'YES' : 'NO');

      if (!token) {
        throw new Error('No authentication token received from server');
      }

      await saveToken(token);

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

      await fetchUser();
      console.log('✅ [EMAIL] Sign up successful');
    } catch (error) {
      console.error('❌ [EMAIL] Sign up error:', error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    console.log('📱 [GOOGLE] Initiating Google sign-in...');

    if (Platform.OS === 'web') {
      // Web: open a popup that navigates directly to the Better Auth social sign-in endpoint
      // Better Auth will redirect the popup to Google, then back to our callback page
      return new Promise<void>((resolve, reject) => {
        try {
          const callbackURL = `${window.location.origin}/auth-popup-callback`;

          // Directly use the Better Auth social sign-in endpoint - it will redirect to Google
          // We pass the callbackURL so Better Auth knows where to redirect after OAuth
          const authUrl = `${BACKEND_URL}/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(callbackURL)}`;

          console.log('📱 [GOOGLE WEB] Opening popup with auth URL:', authUrl);

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

          // Listen for message from popup (sent by auth-popup-callback page)
          const handleMessage = async (event: MessageEvent) => {
            // Accept messages from our own origin
            if (event.origin !== window.location.origin) {
              return;
            }

            console.log('📱 [GOOGLE WEB] Received message from popup:', event.data?.type);

            if (event.data?.type === 'auth-success' && event.data.token) {
              console.log('✅ [GOOGLE WEB] Received token from popup');
              window.removeEventListener('message', handleMessage);
              clearInterval(checkClosed);
              try {
                popup.close();
              } catch (e) {
                console.log('Could not close popup');
              }

              try {
                await saveToken(event.data.token);
                await fetchUser();
                resolve();
              } catch (err) {
                reject(err);
              }
            } else if (event.data?.type === 'auth-error') {
              console.error('❌ [GOOGLE WEB] Auth error from popup:', event.data.error);
              window.removeEventListener('message', handleMessage);
              clearInterval(checkClosed);
              try {
                popup.close();
              } catch (e) {
                console.log('Could not close popup');
              }
              reject(new Error(event.data.error || 'Google sign-in failed'));
            }
          };

          window.addEventListener('message', handleMessage);

          // Check if popup was closed without completing auth
          const checkClosed = setInterval(() => {
            try {
              if (popup.closed) {
                clearInterval(checkClosed);
                window.removeEventListener('message', handleMessage);
                console.log('⚠️ [GOOGLE WEB] Popup was closed');
                // Don't reject - user may have completed auth and popup auto-closed
                resolve();
              }
            } catch (e) {
              clearInterval(checkClosed);
            }
          }, 500);

          // Timeout after 5 minutes
          setTimeout(() => {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            try {
              popup.close();
            } catch (e) {
              console.log('Could not close popup');
            }
            reject(new Error('Google sign-in timed out. Please try again.'));
          }, 5 * 60 * 1000);
        } catch (error) {
          console.error('❌ [GOOGLE WEB] Sign in error:', error);
          reject(error);
        }
      });
    } else {
      // Native (iOS/Android): use WebBrowser.openAuthSessionAsync with deep link callback
      // The backend's Better Auth will redirect to Google, then back to cheshbon://auth-callback?token=...
      try {
        const callbackUrl = `${APP_SCHEME}://auth-callback`;
        console.log('📱 [GOOGLE NATIVE] Using callback URL:', callbackUrl);

        // IMPORTANT: Use the BACKEND_URL directly for the Better Auth social sign-in endpoint.
        // Do NOT use oauth-start or initiate-social as they return frontend URLs (localhost:3000).
        // Better Auth's /api/auth/sign-in/social will redirect to Google OAuth,
        // then Google redirects back to the backend callback,
        // which then redirects to cheshbon://auth-callback?token=SESSION_TOKEN
        const authUrl = `${BACKEND_URL}/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(callbackUrl)}`;

        console.log('📱 [GOOGLE NATIVE] Opening browser for auth...');
        console.log('📱 [GOOGLE NATIVE] Auth URL:', authUrl);

        const result = await WebBrowser.openAuthSessionAsync(authUrl, callbackUrl, {
          showInRecents: true,
          preferEphemeralSession: false,
        });

        console.log('📱 [GOOGLE NATIVE] Browser result type:', result.type);

        if (result.type === 'success' && result.url) {
          console.log('📱 [GOOGLE NATIVE] Callback URL received:', result.url);
          // Extract token from callback URL: cheshbon://auth-callback?token=xxx
          const urlObj = new URL(result.url);
          const token = urlObj.searchParams.get('token');

          if (token) {
            console.log('✅ [GOOGLE NATIVE] Token received, saving...');
            await saveToken(token);
            await fetchUser();
            console.log('✅ [GOOGLE NATIVE] Sign in complete');
          } else {
            console.warn('⚠️ [GOOGLE NATIVE] No token in callback URL:', result.url);
            // Check all params for debugging
            console.warn(
              '⚠️ [GOOGLE NATIVE] URL params:',
              Object.fromEntries(urlObj.searchParams.entries())
            );
            throw new Error('No authentication token received. Please try again.');
          }
        } else if (result.type === 'cancel') {
          console.log('⚠️ [GOOGLE NATIVE] User cancelled sign-in');
          throw new Error('Google sign-in was cancelled');
        } else {
          console.log('⚠️ [GOOGLE NATIVE] Unexpected result type:', result.type);
          // Don't throw - user may have dismissed without completing
        }
      } catch (error) {
        console.error('❌ [GOOGLE NATIVE] Sign in error:', error);
        throw error;
      }
    }
  };

  const signInWithApple = async () => {
    console.log('📞 [APPLE] Initiating Apple sign-in...');

    if (Platform.OS === 'web') {
      // On web, use Better Auth's social sign-in popup flow for Apple
      // Directly open the Better Auth social sign-in endpoint which redirects to Apple
      return new Promise<void>((resolve, reject) => {
        try {
          const callbackURL = `${window.location.origin}/auth-popup-callback`;

          // Directly use the Better Auth social sign-in endpoint
          const authUrl = `${BACKEND_URL}/api/auth/sign-in/social?provider=apple&callbackURL=${encodeURIComponent(callbackURL)}`;

          console.log('📞 [APPLE WEB] Opening popup with auth URL');

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
              console.log('✅ [APPLE WEB] Received token from popup');
              window.removeEventListener('message', handleMessage);
              clearInterval(checkClosed);
              try {
                popup.close();
              } catch (e) {
                console.log('Could not close popup');
              }

              try {
                await saveToken(event.data.token);
                await fetchUser();
                resolve();
              } catch (err) {
                reject(err);
              }
            } else if (event.data?.type === 'auth-error') {
              console.error('❌ [APPLE WEB] Auth error:', event.data.error);
              window.removeEventListener('message', handleMessage);
              clearInterval(checkClosed);
              try {
                popup.close();
              } catch (e) {
                console.log('Could not close popup');
              }
              reject(new Error(event.data.error || 'Apple sign-in failed'));
            }
          };

          window.addEventListener('message', handleMessage);

          const checkClosed = setInterval(() => {
            try {
              if (popup.closed) {
                clearInterval(checkClosed);
                window.removeEventListener('message', handleMessage);
                console.log('⚠️ [APPLE WEB] Popup was closed');
                resolve();
              }
            } catch (e) {
              clearInterval(checkClosed);
            }
          }, 500);

          // Timeout after 5 minutes
          setTimeout(() => {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            try {
              popup.close();
            } catch (e) {
              console.log('Could not close popup');
            }
            reject(new Error('Apple sign-in timed out. Please try again.'));
          }, 5 * 60 * 1000);
        } catch (error) {
          console.error('❌ [APPLE WEB] Sign in error:', error);
          reject(error);
        }
      });
    }

    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS');
    }

    try {
      // Use native Apple Authentication to get the identity token
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('✅ [APPLE NATIVE] Apple credential received');
      console.log(
        '📞 [APPLE NATIVE] Identity token:',
        credential.identityToken ? 'YES (length: ' + credential.identityToken.length + ')' : 'NO'
      );
      console.log('📞 [APPLE NATIVE] Authorization code:', credential.authorizationCode ? 'YES' : 'NO');
      console.log('📞 [APPLE NATIVE] User:', credential.user);
      console.log('📞 [APPLE NATIVE] Email:', credential.email || 'not provided (subsequent sign-in)');

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      // Prepare user data (only sent on first sign-in by Apple)
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

      console.log(
        '📞 [APPLE NATIVE] User data available:',
        userData ? 'YES (first sign-in)' : 'NO (subsequent sign-in)'
      );

      // Use the custom apple-callback endpoint which is designed for native Apple Sign-In
      // This endpoint accepts the identity token and returns a session token
      console.log('📞 [APPLE NATIVE] Sending identity token to /api/auth/apple-callback...');

      const requestBody: any = {
        id_token: credential.identityToken,
        code: credential.authorizationCode || undefined,
      };

      // Only include user data if available (first sign-in)
      if (userData) {
        requestBody.user = JSON.stringify(userData);
      }

      const response = await fetch(`${BACKEND_URL}/api/auth/apple-callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Mobile-App': 'cheshbon',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📞 [APPLE NATIVE] Backend response status:', response.status);
      const responseText = await response.text();
      console.log('📞 [APPLE NATIVE] Backend response (first 300 chars):', responseText.substring(0, 300));

      if (!response.ok) {
        console.error('❌ [APPLE NATIVE] /api/auth/apple-callback failed:', response.status);

        // Try to parse error message
        let errorMessage = `Apple sign-in failed (${response.status})`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = responseText.substring(0, 200) || errorMessage;
        }

        // If apple-callback fails, try the Better Auth callback endpoint as fallback
        console.log('📞 [APPLE NATIVE] Trying fallback: /api/auth/callback/apple...');
        const fallbackResponse = await fetch(`${BACKEND_URL}/api/auth/callback/apple`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Mobile-App': 'cheshbon',
          },
          body: JSON.stringify(requestBody),
        });

        console.log('📞 [APPLE NATIVE] Fallback response status:', fallbackResponse.status);
        const fallbackText = await fallbackResponse.text();
        console.log('📞 [APPLE NATIVE] Fallback response (first 300 chars):', fallbackText.substring(0, 300));

        if (!fallbackResponse.ok) {
          throw new Error(errorMessage);
        }

        let fallbackData: any;
        try {
          fallbackData = JSON.parse(fallbackText);
        } catch {
          throw new Error('Invalid response from Apple sign-in endpoint');
        }

        const fallbackToken =
          fallbackData.token ||
          fallbackData.session?.token ||
          fallbackData.user?.token ||
          fallbackData.accessToken;
        if (!fallbackToken) {
          throw new Error('No authentication token received from server');
        }

        await saveToken(fallbackToken);
        await fetchUser();
        console.log('✅ [APPLE NATIVE] Sign in successful via fallback endpoint');
        return;
      }

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error('Invalid response from Apple sign-in endpoint');
      }

      console.log('📞 [APPLE NATIVE] Parsed response keys:', Object.keys(data));

      const token = data.token || data.session?.token || data.user?.token || data.accessToken;
      console.log('📞 [APPLE NATIVE] Token received:', token ? 'YES' : 'NO');

      if (!token) {
        console.error(
          '❌ [APPLE NATIVE] No token in response. Full response:',
          JSON.stringify(data).substring(0, 500)
        );
        throw new Error('No authentication token received from server');
      }

      await saveToken(token);
      await fetchUser();
      console.log('✅ [APPLE NATIVE] Sign in successful');
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        console.log('📱 [APPLE NATIVE] Apple Sign-In cancelled by user');
        throw new Error('Apple Sign-In was cancelled');
      } else {
        console.error('❌ [APPLE NATIVE] Apple Sign-In error:', error);
        throw error;
      }
    }
  };

  const checkBiometricsAvailable = async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return false;
    }

    console.log('🔐 [BIOMETRIC] Checking biometric availability...');
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      console.log('🔐 [BIOMETRIC] Hardware compatible:', compatible);
      if (!compatible) return false;

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      console.log('🔐 [BIOMETRIC] Biometrics enrolled:', enrolled);
      return enrolled;
    } catch (error) {
      console.error('❌ [BIOMETRIC] Error checking availability:', error);
      return false;
    }
  };

  const signInWithBiometrics = async () => {
    if (Platform.OS === 'web') {
      throw new Error('Biometric authentication is not available on web');
    }

    console.log('🔐 [BIOMETRIC] Starting biometric sign-in...');
    const available = await checkBiometricsAvailable();
    if (!available) {
      throw new Error('Biometric authentication is not available on this device');
    }

    const email = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
    const password = await SecureStore.getItemAsync(BIOMETRIC_PASSWORD_KEY);

    if (!email || !password) {
      throw new Error(
        'No stored credentials. Please sign in with email/password first to enable biometric login'
      );
    }

    console.log('🔐 [BIOMETRIC] Stored credentials found, prompting biometric...');
    
    // CRITICAL FIX: Allow device fallback (passcode) on iOS
    // Setting disableDeviceFallback to false allows iOS to use passcode when Face ID fails
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to Cheshbon',
      fallbackLabel: 'Use Passcode',
      // Allow passcode fallback when biometrics fail
      disableDeviceFallback: false,
    });

    console.log('🔐 [BIOMETRIC] Authentication result:', result.success);
    if (result.success) {
      console.log('✅ [BIOMETRIC] Biometric authentication successful, signing in...');
      await signInWithEmail(email, password);
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
      // Always clear local state
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
