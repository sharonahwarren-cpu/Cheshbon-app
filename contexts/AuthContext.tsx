
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import { apiCall } from '@/utils/api';

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

  // Google OAuth configuration
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'cheshbon',
    path: 'auth-callback',
  });

  console.log('📱 [GOOGLE] Redirect URI:', redirectUri);

  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    clientId: Platform.select({
      ios: 'YOUR_GOOGLE_IOS_CLIENT_ID.apps.googleusercontent.com',
      android: 'YOUR_GOOGLE_ANDROID_CLIENT_ID.apps.googleusercontent.com',
      web: 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com',
    }),
    redirectUri,
    scopes: ['profile', 'email'],
  });

  // Handle Google OAuth response
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      console.log('📱 [GOOGLE] OAuth success, authentication:', googleResponse.authentication);
      const { authentication } = googleResponse;
      if (authentication?.accessToken) {
        handleSocialAuthToken(authentication.accessToken, 'google');
      }
    } else if (googleResponse?.type === 'dismiss') {
      console.log('📱 [GOOGLE] User dismissed OAuth flow');
    } else if (googleResponse?.type === 'error') {
      console.error('❌ [GOOGLE] OAuth error:', googleResponse.error);
    }
  }, [googleResponse]);

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
      setUser(userData);
      setLoading(false);
      return userData;
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

  const handleSocialAuthToken = async (providerToken: string, provider: string) => {
    console.log(`💾 [${provider.toUpperCase()}] Sending provider token to backend...`);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/sign-in/social/${provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: providerToken }),
      });

      console.log(`💾 [${provider.toUpperCase()}] Response status:`, response.status);
      const responseText = await response.text();
      console.log(`💾 [${provider.toUpperCase()}] Response body:`, responseText);

      if (!response.ok) {
        throw new Error(`Social auth failed: ${response.status} - ${responseText}`);
      }

      const data = JSON.parse(responseText);
      const sessionToken = data.token || data.session?.token || data.user?.token || data.accessToken;

      if (!sessionToken) {
        throw new Error(`No session token from backend for ${provider}`);
      }

      await saveToken(sessionToken);
      await fetchUser();
      console.log(`✅ [${provider.toUpperCase()}] Session established via backend`);
    } catch (error) {
      console.error(`❌ [${provider.toUpperCase()}] Backend session establishment error:`, error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    console.log('📱 [GOOGLE] Initiating Google sign-in...');
    console.log('📱 [GOOGLE] Request ready:', !!googleRequest);
    try {
      if (!googleRequest) {
        throw new Error('Google auth request not ready. Please try again.');
      }
      console.log('📱 [GOOGLE] Calling promptAsync...');
      const result = await googlePromptAsync();
      console.log('📱 [GOOGLE] promptAsync result:', result);
      // Response is handled by useEffect above
    } catch (error) {
      console.error('❌ [GOOGLE] Sign in error:', error);
      throw error;
    }
  };

  const signInWithApple = async () => {
    console.log('📞 [APPLE] Initiating Apple sign-in...');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      console.log('✅ [APPLE] Apple credential received:', credential);
      console.log('📞 [APPLE] Identity token:', credential.identityToken ? 'YES' : 'NO');

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      await handleSocialAuthToken(credential.identityToken, 'apple');
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
