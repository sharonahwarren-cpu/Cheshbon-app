
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';

// Essential for auth session cleanup
WebBrowser.maybeCompleteAuthSession();

const BACKEND_URL = 'https://a8sew4dfz3q59y6r9k8fhpt2jfdhpm8d.app.specular.dev';
const BEARER_TOKEN_KEY = 'cheshbon_bearer_token';
const BIOMETRIC_EMAIL_KEY = 'cheshbon_biometric_email';
const BIOMETRIC_PASSWORD_KEY = 'cheshbon_biometric_password';

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
      const response = await fetch(`${BACKEND_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log('📧 [EMAIL] Response status:', response.status);
      const responseText = await response.text();
      console.log('📧 [EMAIL] Response body:', responseText);

      if (!response.ok) {
        throw new Error(`Sign in failed: ${response.status} - ${responseText}`);
      }

      const data = JSON.parse(responseText);
      console.log('📧 [EMAIL] Parsed response:', data);

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
      const response = await fetch(`${BACKEND_URL}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      console.log('📧 [EMAIL] Response status:', response.status);
      const responseText = await response.text();
      console.log('📧 [EMAIL] Response body:', responseText);

      if (!response.ok) {
        throw new Error(`Sign up failed: ${response.status} - ${responseText}`);
      }

      const data = JSON.parse(responseText);
      console.log('📧 [EMAIL] Parsed response:', data);

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
    
    // For web, open popup pointing to Better Auth's social sign-in endpoint
    if (Platform.OS === 'web') {
      return new Promise<void>((resolve, reject) => {
        try {
          // Better Auth social sign-in endpoint with callback to our popup handler
          const callbackURL = `${window.location.origin}/auth-popup-callback`;
          const authUrl = `${BACKEND_URL}/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(callbackURL)}`;
          console.log('📱 [GOOGLE] Opening auth URL:', authUrl);
          
          // Open popup window
          const width = 500;
          const height = 600;
          const left = window.screen.width / 2 - width / 2;
          const top = window.screen.height / 2 - height / 2;
          
          const popup = window.open(
            authUrl,
            'Google Sign In',
            `width=${width},height=${height},left=${left},top=${top}`
          );

          if (!popup) {
            reject(new Error('Failed to open popup. Please allow popups for this site.'));
            return;
          }

          // Listen for message from popup
          const handleMessage = async (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            
            if (event.data.type === 'auth-success' && event.data.token) {
              console.log('✅ [GOOGLE] Received token from popup');
              window.removeEventListener('message', handleMessage);
              clearInterval(checkClosed);
              popup.close();
              
              try {
                await saveToken(event.data.token);
                await fetchUser();
                resolve();
              } catch (err) {
                reject(err);
              }
            } else if (event.data.type === 'auth-error') {
              console.error('❌ [GOOGLE] Auth error:', event.data.error);
              window.removeEventListener('message', handleMessage);
              clearInterval(checkClosed);
              popup.close();
              reject(new Error(event.data.error || 'Google sign-in failed'));
            }
          };

          window.addEventListener('message', handleMessage);

          // Check if popup was closed without completing auth
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed);
              window.removeEventListener('message', handleMessage);
              console.log('⚠️ [GOOGLE] Popup was closed without completing auth');
              // Don't reject - user may have closed intentionally
              resolve();
            }
          }, 500);

        } catch (error) {
          console.error('❌ [GOOGLE] Sign in error:', error);
          reject(error);
        }
      });
    } else {
      // For native (iOS/Android), use deep linking with Better Auth social endpoint
      try {
        // Use oauth-start to get the proper authorization URL with mobile callback
        const callbackUrl = 'cheshbon://auth-callback';
        console.log('📱 [GOOGLE] Requesting OAuth start URL from backend...');
        
        const startResponse = await fetch(`${BACKEND_URL}/api/auth/oauth-start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'google', callbackUrl }),
        });

        let authUrl: string;
        if (startResponse.ok) {
          const startData = await startResponse.json();
          // oauth-start returns a URL that may point to FRONTEND_URL - we need the backend URL
          // Use Better Auth's direct social sign-in endpoint instead
          authUrl = `${BACKEND_URL}/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(callbackUrl)}`;
          console.log('📱 [GOOGLE] Using auth URL:', authUrl);
        } else {
          // Fallback: use Better Auth social sign-in directly
          authUrl = `${BACKEND_URL}/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(callbackUrl)}`;
          console.log('📱 [GOOGLE] Fallback auth URL:', authUrl);
        }
        
        console.log('📱 [GOOGLE] Opening browser for auth:', authUrl);
        
        const result = await WebBrowser.openAuthSessionAsync(
          authUrl,
          callbackUrl
        );

        console.log('📱 [GOOGLE] Browser result:', result);

        if (result.type === 'success' && result.url) {
          // Extract token from callback URL
          const url = new URL(result.url);
          const token = url.searchParams.get('token');
          
          if (token) {
            console.log('✅ [GOOGLE] Received token from callback');
            await saveToken(token);
            await fetchUser();
          } else {
            console.warn('⚠️ [GOOGLE] No token in callback URL:', result.url);
            throw new Error('No token received from Google sign-in');
          }
        } else if (result.type === 'cancel') {
          console.log('⚠️ [GOOGLE] User cancelled sign-in');
          throw new Error('Google sign-in was cancelled');
        }
      } catch (error) {
        console.error('❌ [GOOGLE] Sign in error:', error);
        throw error;
      }
    }
  };

  const signInWithApple = async () => {
    console.log('📞 [APPLE] Initiating Apple sign-in...');
    
    if (Platform.OS === 'web') {
      // On web, use Better Auth's social sign-in popup flow for Apple
      return new Promise<void>((resolve, reject) => {
        try {
          const callbackURL = `${window.location.origin}/auth-popup-callback`;
          const authUrl = `${BACKEND_URL}/api/auth/sign-in/social?provider=apple&callbackURL=${encodeURIComponent(callbackURL)}`;
          console.log('📞 [APPLE] Opening Apple auth URL:', authUrl);
          
          const width = 500;
          const height = 600;
          const left = window.screen.width / 2 - width / 2;
          const top = window.screen.height / 2 - height / 2;
          
          const popup = window.open(
            authUrl,
            'Apple Sign In',
            `width=${width},height=${height},left=${left},top=${top}`
          );

          if (!popup) {
            reject(new Error('Failed to open popup. Please allow popups for this site.'));
            return;
          }

          const handleMessage = async (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            
            if (event.data.type === 'auth-success' && event.data.token) {
              console.log('✅ [APPLE] Received token from popup');
              window.removeEventListener('message', handleMessage);
              clearInterval(checkClosed);
              popup.close();
              
              try {
                await saveToken(event.data.token);
                await fetchUser();
                resolve();
              } catch (err) {
                reject(err);
              }
            } else if (event.data.type === 'auth-error') {
              console.error('❌ [APPLE] Auth error:', event.data.error);
              window.removeEventListener('message', handleMessage);
              clearInterval(checkClosed);
              popup.close();
              reject(new Error(event.data.error || 'Apple sign-in failed'));
            }
          };

          window.addEventListener('message', handleMessage);

          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed);
              window.removeEventListener('message', handleMessage);
              console.log('⚠️ [APPLE] Popup was closed');
              resolve();
            }
          }, 500);
        } catch (error) {
          console.error('❌ [APPLE] Sign in error:', error);
          reject(error);
        }
      });
    }

    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS');
    }

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      console.log('✅ [APPLE] Apple credential received');
      console.log('📞 [APPLE] Identity token:', credential.identityToken ? 'YES' : 'NO');

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      // Send identity token to Better Auth's Apple sign-in endpoint
      // Better Auth handles Apple identity token verification at /api/auth/sign-in/apple
      const response = await fetch(`${BACKEND_URL}/api/auth/sign-in/apple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken: credential.identityToken,
          user: credential.user,
          email: credential.email,
          name: credential.fullName
            ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
            : undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [APPLE] Backend error:', response.status, errorText);
        
        // Fallback: try the generic social callback endpoint
        const fallbackResponse = await fetch(`${BACKEND_URL}/api/auth/callback/apple`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_token: credential.identityToken,
            user: JSON.stringify({
              name: credential.fullName,
              email: credential.email,
            }),
          }),
        });
        
        if (!fallbackResponse.ok) {
          const fallbackError = await fallbackResponse.text();
          throw new Error(`Apple sign-in failed: ${response.status} - ${errorText}`);
        }
        
        const fallbackData = await fallbackResponse.json();
        const fallbackToken = fallbackData.token || fallbackData.session?.token;
        if (fallbackToken) {
          await saveToken(fallbackToken);
          await fetchUser();
          console.log('✅ [APPLE] Sign in successful via fallback');
          return;
        }
        throw new Error(`Apple sign-in failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const token = data.token || data.session?.token || data.user?.token || data.accessToken;

      if (!token) {
        throw new Error('No authentication token received from server');
      }

      await saveToken(token);
      await fetchUser();
      console.log('✅ [APPLE] Sign in successful');
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        console.log('📱 [APPLE] Apple Sign-In cancelled by user');
        throw new Error('Apple Sign-In was cancelled');
      } else {
        console.error('❌ [APPLE] Apple Sign-In error:', error);
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
      throw new Error('No stored credentials. Please sign in with email/password first to enable biometric login');
    }

    console.log('🔐 [BIOMETRIC] Stored credentials found, prompting biometric...');
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to Cheshbon',
      fallbackLabel: 'Use passcode',
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
            'Authorization': `Bearer ${token}`,
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
