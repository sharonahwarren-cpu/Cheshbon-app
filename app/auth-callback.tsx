
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { setBearerToken } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { fetchUser } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    console.log('🔄 [AUTH CALLBACK] Screen mounted');
    console.log('🔄 [AUTH CALLBACK] Params:', params);
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // Extract token from URL params (deep link: cheshbon://auth-callback?token=xxx)
      const token = params.token as string;
      const error = params.error as string;

      if (error) {
        console.error('❌ [AUTH CALLBACK] Error in callback:', error);
        setErrorMsg(error);
        setStatus('error');
        setTimeout(() => router.replace('/auth'), 2000);
        return;
      }

      if (token) {
        console.log('✅ [AUTH CALLBACK] Token received, saving...');
        await setBearerToken(token);
        await fetchUser();
        setStatus('success');
        console.log('✅ [AUTH CALLBACK] Auth complete, redirecting to home...');
        setTimeout(() => {
          router.replace('/(tabs)/(home)');
        }, 500);
      } else {
        console.log('⚠️ [AUTH CALLBACK] No token in params, redirecting to home...');
        // No token - might be a direct navigation, just go home
        setTimeout(() => {
          router.replace('/(tabs)/(home)');
        }, 1000);
      }
    } catch (err: any) {
      console.error('❌ [AUTH CALLBACK] Error processing callback:', err);
      setErrorMsg(err.message || 'Authentication failed');
      setStatus('error');
      setTimeout(() => router.replace('/auth'), 2000);
    }
  };

  return (
    <View style={styles.container}>
      {status === 'error' ? (
        <>
          <Text style={styles.errorIcon}>❌</Text>
          <Text style={styles.errorMessage}>Authentication failed</Text>
          <Text style={styles.errorDetail}>{errorMsg}</Text>
          <Text style={styles.subMessage}>Redirecting to sign in...</Text>
        </>
      ) : status === 'success' ? (
        <>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.message}>Sign in successful!</Text>
          <Text style={styles.subMessage}>Redirecting...</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.message}>Completing sign in...</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  message: {
    fontSize: 18,
    marginTop: 20,
    textAlign: 'center',
    color: colors.text,
    fontWeight: '600',
  },
  subMessage: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  successIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 18,
    marginTop: 8,
    textAlign: 'center',
    color: '#ef4444',
    fontWeight: '600',
  },
  errorDetail: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});
