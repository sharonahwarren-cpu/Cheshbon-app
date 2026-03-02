
import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { Platform } from 'react-native';
import { markAuthSuccess, setBearerToken } from '@/utils/api';

/**
 * OAuth Callback Handler for Native Mobile (iOS/Android)
 * Handles deep link callbacks from Google/Apple OAuth:
 * cheshbon://auth-callback?token={token}
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { fetchUser } = useAuth();

  useEffect(() => {
    console.log('🔗 [AUTH CALLBACK] Screen mounted');
    console.log('🔗 [AUTH CALLBACK] Params:', params);

    const handleCallback = async () => {
      try {
        const token = params.token as string | undefined;

        if (!token) {
          console.error('❌ [AUTH CALLBACK] No token in URL params');
          router.replace('/auth');
          return;
        }

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
