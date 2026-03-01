
/**
 * This page handles OAuth callbacks in a popup window (web only).
 *
 * Flow:
 * 1. User clicks "Sign in with Google/Apple" → popup opens pointing to Better Auth social endpoint
 * 2. Better Auth redirects popup to Google/Apple
 * 3. Google/Apple redirects back to Better Auth callback
 * 4. Better Auth processes the OAuth and redirects to this page with ?token=xxx
 * 5. This page sends the token to the parent window via postMessage
 * 6. Parent window saves the token and closes the popup
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import Constants from 'expo-constants';

const BACKEND_URL =
  Constants.expoConfig?.extra?.backendUrl ||
  'https://a8sew4dfz3q59y6r9k8fhpt2jfdhpm8d.app.specular.dev';

export default function AuthPopupCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [displayState, setDisplayState] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    console.log('🔄 [AUTH POPUP CALLBACK] Screen mounted');
    console.log('🔄 [AUTH POPUP CALLBACK] Full URL:', window.location.href);
    console.log('🔄 [AUTH POPUP CALLBACK] Has opener:', !!window.opener);

    // Extract token/error from URL - Better Auth passes token as query param
    const urlParams = new URLSearchParams(window.location.search);

    // Check all possible token parameter names
    let token =
      urlParams.get('token') ||
      urlParams.get('access_token') ||
      urlParams.get('session_token') ||
      (params.token as string) ||
      '';

    // Check hash fragment too (some OAuth providers use hash)
    if (!token && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      token = hashParams.get('token') || hashParams.get('access_token') || '';
    }

    let error =
      urlParams.get('error') ||
      urlParams.get('error_description') ||
      (params.error as string) ||
      '';

    console.log('🔄 [AUTH POPUP CALLBACK] Token found:', token ? `YES (length: ${token.length})` : 'NO');
    console.log('🔄 [AUTH POPUP CALLBACK] Error:', error || 'none');
    console.log('🔄 [AUTH POPUP CALLBACK] All URL params:', Object.fromEntries(urlParams.entries()));

    const sendToParent = (message: any) => {
      try {
        if (window.opener && !window.opener.closed) {
          // Send to parent with same origin
          window.opener.postMessage(message, window.location.origin);
          console.log('✅ [AUTH POPUP CALLBACK] Message sent to parent:', message.type);
        } else {
          console.warn('⚠️ [AUTH POPUP CALLBACK] No opener window available');
        }
      } catch (e) {
        console.error('❌ [AUTH POPUP CALLBACK] Failed to post message to parent:', e);
      }
    };

    const handleWithToken = async (sessionToken: string) => {
      console.log('✅ [AUTH POPUP CALLBACK] Processing token...');
      setDisplayState('success');

      if (window.opener) {
        // In popup - send token to parent
        sendToParent({ type: 'auth-success', token: sessionToken });
        setTimeout(() => {
          try {
            window.close();
          } catch (e) {
            console.log('Could not close window automatically');
          }
        }, 1500);
      } else {
        // Direct navigation - save token and redirect
        const { setBearerToken } = await import('@/utils/api');
        await setBearerToken(sessionToken);
        console.log('✅ [AUTH POPUP CALLBACK] Token saved, redirecting to home');
        setTimeout(() => router.replace('/(tabs)/(home)'), 500);
      }
    };

    const handleError = (errorMsg: string) => {
      console.error('❌ [AUTH POPUP CALLBACK] Error:', errorMsg);
      setErrorDetail(errorMsg);
      setDisplayState('error');

      if (window.opener) {
        sendToParent({ type: 'auth-error', error: errorMsg });
        setTimeout(() => {
          try {
            window.close();
          } catch (e) {
            console.log('Could not close window automatically');
          }
        }, 2000);
      } else {
        setTimeout(() => router.replace('/auth'), 2000);
      }
    };

    const checkSessionViaCookie = async () => {
      console.log('🔄 [AUTH POPUP CALLBACK] No token in URL, checking session via cookie...');
      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (res.ok) {
          const data = await res.json();
          const sessionToken = data.session?.token || data.token;
          if (sessionToken) {
            console.log('✅ [AUTH POPUP CALLBACK] Session found via cookie');
            await handleWithToken(sessionToken);
            return;
          }
        }

        console.warn('⚠️ [AUTH POPUP CALLBACK] No session found via cookie');
        handleError('Authentication completed but no session token found. Please try again.');
      } catch (err) {
        console.error('❌ [AUTH POPUP CALLBACK] Cookie session check failed:', err);
        handleError('Authentication failed. Please try again.');
      }
    };

    // Main logic
    if (token) {
      handleWithToken(token);
    } else if (error) {
      handleError(error);
    } else {
      // No token and no error - Better Auth may have set a cookie session
      // This happens when Better Auth doesn't pass the token in the URL
      checkSessionViaCookie();
    }
  }, []);

  return (
    <View style={styles.container}>
      {displayState === 'error' ? (
        <>
          <Text style={styles.errorIcon}>❌</Text>
          <Text style={styles.errorMessage}>Authentication failed</Text>
          {errorDetail ? <Text style={styles.errorDetail}>{errorDetail}</Text> : null}
          <Text style={styles.submessage}>Closing window...</Text>
        </>
      ) : displayState === 'success' ? (
        <>
          <Text style={styles.successIcon}>✅</Text>
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 16 }} />
          <Text style={styles.message}>Authentication successful!</Text>
          <Text style={styles.submessage}>Closing window...</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.message}>Processing authentication...</Text>
          <Text style={styles.submessage}>Please wait...</Text>
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
  submessage: {
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
