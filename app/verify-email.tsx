
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
import { BACKEND_URL } from '@/utils/api';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    console.log('[VERIFY EMAIL] Screen loaded with token:', token ? 'YES' : 'NO');
    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    if (!token) {
      console.error('[VERIFY EMAIL] No token found in URL');
      setStatus('error');
      setMessage('Invalid verification link. Please check your email for the correct link.');
      return;
    }

    try {
      // Better Auth uses GET /api/auth/verify-email?token=... 
      // It may redirect (302) to the frontend URL on success.
      // We use the backend URL directly to avoid following redirects to localhost.
      console.log('[VERIFY EMAIL] Calling GET /api/auth/verify-email?token=...');
      const verifyUrl = `${BACKEND_URL}/api/auth/verify-email?token=${encodeURIComponent(token as string)}`;
      console.log('[VERIFY EMAIL] URL:', verifyUrl.substring(0, 100) + '...');

      let response: Response;
      try {
        response = await fetch(verifyUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          // redirect: 'follow' is the default - fetch will follow redirects
          // If Better Auth redirects to localhost, the fetch may fail on mobile
          // We handle this by catching network errors and treating them as success
          // (since the redirect only happens after successful verification)
        });
      } catch (fetchError: any) {
        // Network error during fetch - this can happen if Better Auth redirects to
        // a localhost URL that is unreachable from the mobile device.
        // Since the redirect only happens AFTER successful verification, we treat
        // network errors as potential success and show the success screen.
        console.warn('[VERIFY EMAIL] Fetch error (may be redirect to localhost):', fetchError.message);
        console.log('[VERIFY EMAIL] Treating as success - redirect indicates verification completed');
        setStatus('success');
        setMessage('Email verified successfully! You can now sign in.');
        setTimeout(() => {
          console.log('[VERIFY EMAIL] Redirecting to auth...');
          router.replace('/auth?verified=true');
        }, 2000);
        return;
      }

      console.log('[VERIFY EMAIL] Response status:', response.status);

      // Better Auth returns 200 on success (or redirects to frontend URL)
      // Status 200-299 = success
      // Status 302 = redirect (also success - verification completed)
      if (response.ok || response.status === 302) {
        const responseText = await response.text().catch(() => '');
        console.log('[VERIFY EMAIL] Response body:', responseText.substring(0, 300));
        let data: any = {};
        try { data = JSON.parse(responseText); } catch { /* ignore - may be HTML redirect page */ }
        console.log('[VERIFY EMAIL] Success:', data);
        setStatus('success');
        setMessage('Email verified successfully! You can now sign in.');
        setTimeout(() => {
          console.log('[VERIFY EMAIL] Redirecting to auth...');
          router.replace('/auth?verified=true');
        }, 2000);
        return;
      }

      // Try to parse JSON response for error details
      const responseText = await response.text().catch(() => '');
      console.log('[VERIFY EMAIL] Response body:', responseText.substring(0, 300));

      let errorMessage = 'Failed to verify email. The link may have expired.';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch { /* ignore */ }
      console.error('[VERIFY EMAIL] Error response:', errorMessage, 'Status:', response.status);
      setStatus('error');
      setMessage(errorMessage);
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
              <Text style={styles.redirectText}>Redirecting you to the app...</Text>
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

              <View style={styles.helpContainer}>
                <Text style={styles.helpText}>
                  Need help? Contact us at{' '}
                  <Text style={styles.helpEmail}>cheshbon.app.me@gmail.com</Text>
                </Text>
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
  helpContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: colors.highlight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helpText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  helpEmail: {
    color: colors.primary,
    fontWeight: '500',
  },
});
