
import { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BEARER_TOKEN_KEY = 'cheshbon_bearer_token';

/**
 * OAuth Callback Handler for Native Apps (iOS/Android)
 * 
 * This screen handles deep link callbacks from OAuth providers:
 * - cheshbon://auth-callback?token=SESSION_TOKEN
 * - cheshbon://auth-callback?session_token=SESSION_TOKEN
 * 
 * The token is extracted from the URL and saved to secure storage,
 * then the user is redirected to the home screen.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const handledRef = useRef(false);

  useEffect(() => {
    // Prevent double-handling
    if (handledRef.current) {
      console.log('⚠️ [AUTH CALLBACK] Already handled, skipping');
      return;
    }

    console.log('🔄 [AUTH CALLBACK] Processing OAuth callback...');
    console.log('🔄 [AUTH CALLBACK] Params:', JSON.stringify(params));

    const handleCallback = async () => {
      try {
        // Extract token from various possible parameter names
        const token = 
          (params.token as string) || 
          (params.session_token as string) || 
          (params.sessionToken as string) ||
          (params.access_token as string) ||
          (params.accessToken as string);

        console.log('🔄 [AUTH CALLBACK] Token found:', token ? 'YES' : 'NO');

        if (!token) {
          console.error('❌ [AUTH CALLBACK] No token in callback URL');
          console.error('❌ [AUTH CALLBACK] Available params:', Object.keys(params));
          throw new Error('No authentication token received');
        }

        // Save token to secure storage
        console.log('💾 [AUTH CALLBACK] Saving token...');
        if (Platform.OS === 'web') {
          localStorage.setItem(BEARER_TOKEN_KEY, token);
        } else {
          await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token);
        }
        console.log('✅ [AUTH CALLBACK] Token saved');

        handledRef.current = true;

        // Small delay to ensure token is saved
        await new Promise(resolve => setTimeout(resolve, 100));

        // Redirect to home - AuthBootstrap will detect the token and show the app
        console.log('🔄 [AUTH CALLBACK] Redirecting to home...');
        router.replace('/');
      } catch (error) {
        console.error('❌ [AUTH CALLBACK] Error:', error);
        handledRef.current = true;
        // Redirect to auth screen on error
        router.replace('/auth');
      }
    };

    handleCallback();
  }, [params, router]);

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
    textAlign: 'center',
  },
});
