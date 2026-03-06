
import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { Platform } from 'react-native';
import { markAuthSuccess, setBearerToken, BACKEND_URL } from '@/utils/api';

/**
 * OAuth Callback Handler for Native Mobile (iOS/Android)
 * Handles deep link callbacks from Google/Apple OAuth:
 * cheshbon://auth-callback?token={token}
 * 
 * Also handles iOS Google OAuth with iOS Client ID where the callback
 * may come via the app deep link after the backend processes the OAuth code.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { fetchUser } = useAuth();

  useEffect(() => {
    console.log('🔗 [AUTH CALLBACK] Screen mounted');
    console.log('🔗 [AUTH CALLBACK] Params:', JSON.stringify(params));
    console.log('🔗 [AUTH CALLBACK] Platform:', Platform.OS);

    const handleCallback = async () => {
      try {
        // Try to extract token from various possible parameter names
        // Better Auth may use different parameter names depending on version/config
        const token = (params.token as string | undefined) ||
          (params.session_token as string | undefined) ||
          (params.sessionToken as string | undefined) ||
          (params.access_token as string | undefined);

        // Check for authorization code (iOS Google OAuth with iOS Client ID)
        const code = params.code as string | undefined;
        const state = params.state as string | undefined;

        console.log('🔗 [AUTH CALLBACK] Token found in params:', !!token);
        console.log('🔗 [AUTH CALLBACK] Code found in params:', !!code);
        console.log('🔗 [AUTH CALLBACK] All params:', JSON.stringify(params));

        if (!token && !code) {
          console.error('❌ [AUTH CALLBACK] No token or code in URL params');
          router.replace('/auth');
          return;
        }

        if (token) {
          console.log('✅ [AUTH CALLBACK] Token received, saving...');

          // Save token using centralized function (includes in-memory cache for iOS)
          await setBearerToken(token);

          // Mark auth success to start grace period (prevents 401 race conditions)
          markAuthSuccess();

          console.log('✅ [AUTH CALLBACK] Token saved, waiting for DB commit...');

          // On iOS, add a delay to ensure the session is committed to DB
          if (Platform.OS === 'ios') {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          console.log('✅ [AUTH CALLBACK] Fetching user...');

          // Fetch user data - pass token directly to avoid SecureStore timing issues on iOS
          await fetchUser(token);

          console.log('✅ [AUTH CALLBACK] User fetched, redirecting to app...');

          // Redirect to app
          router.replace('/(tabs)/(home)');
        } else if (code) {
          // iOS Google OAuth: exchange authorization code for session token
          console.log('🔗 [AUTH CALLBACK] Authorization code received, exchanging for token...');
          console.log('🔗 [AUTH CALLBACK] Code (first 20 chars):', code.substring(0, 20) + '...');

          const appCallbackUrl = 'cheshbon://auth-callback';
          const exchangeUrl = `${BACKEND_URL}/api/auth/oauth-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}&provider=google&callbackURL=${encodeURIComponent(appCallbackUrl)}`;

          console.log('🔗 [AUTH CALLBACK] Exchanging code at:', exchangeUrl.substring(0, 150));

          const exchangeResponse = await fetch(exchangeUrl, {
            method: 'GET',
            headers: {
              'X-Mobile-App': 'cheshbon',
              'X-Platform': Platform.OS,
              'Origin': BACKEND_URL,
            },
            redirect: 'manual',
          });

          console.log('🔗 [AUTH CALLBACK] Exchange response status:', exchangeResponse.status);

          let sessionToken: string | null = null;

          // Check Location header for redirect with token
          const locationHeader = exchangeResponse.headers.get('location') || exchangeResponse.headers.get('Location');
          console.log('🔗 [AUTH CALLBACK] Location header:', locationHeader?.substring(0, 150));

          if (locationHeader) {
            try {
              const redirectUrl = new URL(locationHeader);
              sessionToken = redirectUrl.searchParams.get('token') ||
                redirectUrl.searchParams.get('session_token') ||
                redirectUrl.searchParams.get('sessionToken');
              console.log('🔗 [AUTH CALLBACK] Token from redirect location:', sessionToken ? 'YES' : 'NO');
            } catch (e) {
              console.error('🔗 [AUTH CALLBACK] Error parsing location header:', e);
            }
          }

          // Try response body if no token in location header
          if (!sessionToken && exchangeResponse.status !== 302) {
            try {
              const responseText = await exchangeResponse.text();
              console.log('🔗 [AUTH CALLBACK] Exchange response body:', responseText.substring(0, 300));
              const responseData = JSON.parse(responseText);
              sessionToken = responseData.token || responseData.session?.token || responseData.sessionToken;
            } catch (e) {
              console.error('🔗 [AUTH CALLBACK] Error parsing exchange response:', e);
            }
          }

          if (sessionToken) {
            console.log('✅ [AUTH CALLBACK] Session token obtained from code exchange');
            await setBearerToken(sessionToken);
            markAuthSuccess();

            if (Platform.OS === 'ios') {
              await new Promise(resolve => setTimeout(resolve, 500));
            }

            await fetchUser(sessionToken);
            router.replace('/(tabs)/(home)');
          } else {
            console.error('❌ [AUTH CALLBACK] Failed to exchange code for token');
            router.replace('/auth');
          }
        }
      } catch (error) {
        console.error('❌ [AUTH CALLBACK] Error handling callback:', error);
        router.replace('/auth');
      }
    };

    handleCallback();
  }, [params]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text,
  },
});
