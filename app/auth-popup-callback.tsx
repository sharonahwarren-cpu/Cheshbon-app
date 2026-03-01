
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';

/**
 * This page handles OAuth callbacks in a popup window (web only).
 * Better Auth redirects here after OAuth with a session token in the URL.
 * It extracts the token and sends it to the parent window via postMessage.
 */
export default function AuthPopupCallbackScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [displayState, setDisplayState] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => {
    console.log('🔄 [AUTH POPUP CALLBACK] Screen mounted');
    console.log('🔄 [AUTH POPUP CALLBACK] Params:', params);

    if (typeof window === 'undefined') return;

    // Extract token from URL params - Better Auth may pass it as 'token' query param
    // or it may be embedded in the URL hash/search
    let token = params.token as string;
    let error = params.error as string;

    // Also check the raw URL for token (Better Auth may use different param names)
    if (!token && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      token = token || urlParams.get('token') || urlParams.get('access_token') || '';
      error = error || urlParams.get('error') || '';
      
      // Check hash fragment too
      if (!token && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        token = token || hashParams.get('token') || hashParams.get('access_token') || '';
      }
    }

    console.log('🔄 [AUTH POPUP CALLBACK] Token found:', token ? 'YES' : 'NO');
    console.log('🔄 [AUTH POPUP CALLBACK] Error:', error || 'none');

    if (window.opener) {
      // We're in a popup window, send message to parent
      if (token) {
        console.log('✅ [AUTH POPUP CALLBACK] Sending token to parent window');
        setDisplayState('success');
        
        try {
          window.opener.postMessage(
            {
              type: 'auth-success',
              token: token,
            },
            window.location.origin
          );
        } catch (e) {
          console.error('❌ [AUTH POPUP CALLBACK] Failed to post message:', e);
        }
        
        // Close popup after brief delay
        setTimeout(() => {
          window.close();
        }, 1000);
      } else if (error) {
        console.error('❌ [AUTH POPUP CALLBACK] Error:', error);
        setErrorDetail(error);
        setDisplayState('error');
        
        try {
          window.opener.postMessage(
            {
              type: 'auth-error',
              error: error,
            },
            window.location.origin
          );
        } catch (e) {
          console.error('❌ [AUTH POPUP CALLBACK] Failed to post error message:', e);
        }
        
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        // No token and no error - might be an intermediate redirect
        // Wait a moment and check again, or just close
        console.log('⚠️ [AUTH POPUP CALLBACK] No token or error found in URL');
        setDisplayState('error');
        setErrorDetail('No authentication token received');
        
        try {
          window.opener.postMessage(
            {
              type: 'auth-error',
              error: 'No authentication token received',
            },
            window.location.origin
          );
        } catch (e) {
          console.error('❌ [AUTH POPUP CALLBACK] Failed to post message:', e);
        }
        
        setTimeout(() => {
          window.close();
        }, 2000);
      }
    } else {
      // Not in a popup - this is a direct navigation (e.g., after web OAuth redirect)
      console.log('🔄 [AUTH POPUP CALLBACK] Not in popup, handling as direct navigation');
      
      if (token) {
        // Save token and redirect to home
        import('@/utils/api').then(({ setBearerToken }) => {
          setBearerToken(token).then(() => {
            console.log('✅ [AUTH POPUP CALLBACK] Token saved, redirecting to home');
            setDisplayState('success');
            setTimeout(() => {
              router.replace('/(tabs)/(home)');
            }, 500);
          });
        });
      } else if (error) {
        setErrorDetail(error);
        setDisplayState('error');
        setTimeout(() => {
          router.replace('/auth');
        }, 2000);
      } else {
        // No token - redirect to home and let auth bootstrap handle it
        setTimeout(() => {
          router.replace('/(tabs)/(home)');
        }, 1000);
      }
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
    marginBottom: 8,
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
