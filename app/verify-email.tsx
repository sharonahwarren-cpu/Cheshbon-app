
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/lib/supabase';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { token_hash, type } = useLocalSearchParams<{ token_hash: string; type: string }>();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    console.log('[VERIFY EMAIL] Screen loaded with token_hash:', token_hash ? 'YES' : 'NO');
    console.log('[VERIFY EMAIL] Type:', type);
    verifyEmail();
  }, [token_hash, type]);

  const verifyEmail = async () => {
    if (!token_hash || !type) {
      console.error('[VERIFY EMAIL] Missing token_hash or type');
      setStatus('error');
      setMessage('Invalid verification link. Please check your email for the correct link.');
      return;
    }

    try {
      console.log('[VERIFY EMAIL] Calling Supabase verifyOtp...');
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token_hash as string,
        type: type as 'signup' | 'email',
      });

      if (error) {
        console.error('[VERIFY EMAIL] Error:', error.message);
        setStatus('error');
        setMessage(error.message || 'Verification failed. The link may have expired.');
        return;
      }

      console.log('[VERIFY EMAIL] Success');
      setStatus('success');
      setMessage('Email verified successfully! You can now sign in.');
      
      // Redirect to auth screen after 2 seconds
      setTimeout(() => {
        console.log('[VERIFY EMAIL] Redirecting to auth...');
        router.replace('/auth?verified=true');
      }, 2000);
    } catch (error: any) {
      console.error('[VERIFY EMAIL] Error:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to verify email. The link may have expired.');
    }
  };

  const handleRetry = () => {
    setStatus('verifying');
    setMessage('Verifying your email...');
    verifyEmail();
  };

  const handleBackToAuth = () => {
    router.replace('/auth');
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {status === 'verifying' && (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.title}>{message}</Text>
              <Text style={styles.subtitle}>Please wait a moment...</Text>
            </>
          )}

          {status === 'success' && (
            <>
              <View style={styles.iconContainer}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={80}
                  color={colors.success}
                />
              </View>
              <Text style={styles.title}>Email Verified!</Text>
              <Text style={styles.subtitle}>{message}</Text>
              <Text style={styles.redirectText}>Redirecting you to sign in...</Text>
            </>
          )}

          {status === 'error' && (
            <>
              <View style={styles.iconContainer}>
                <IconSymbol
                  ios_icon_name="exclamationmark.triangle.fill"
                  android_material_icon_name="warning"
                  size={80}
                  color={colors.error}
                />
              </View>
              <Text style={styles.title}>Verification Failed</Text>
              <Text style={styles.subtitle}>{message}</Text>
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleRetry}
                  activeOpacity={0.8}
                >
                  <IconSymbol
                    ios_icon_name="arrow.clockwise"
                    android_material_icon_name="refresh"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.buttonText}>Try Again</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleBackToAuth}
                  activeOpacity={0.8}
                >
                  <IconSymbol
                    ios_icon_name="arrow.left"
                    android_material_icon_name="arrow-back"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  redirectText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
    marginTop: 24,
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
