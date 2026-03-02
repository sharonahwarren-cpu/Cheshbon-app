
import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import Constants from 'expo-constants';

const BACKEND_URL =
  Constants.expoConfig?.extra?.backendUrl ||
  'https://a8sew4dfz3q59y6r9k8fhpt2jfdhpm8d.app.specular.dev';

/**
 * OAuth Popup Callback Handler for Web
 * This page is opened in a popup window during Google/Apple OAuth on web.
 * It extracts the token from URL params and sends it back to the parent window.
 * 
 * Better Auth may return the token in different ways:
 * - As a query param: ?token=...
 * - As a session_token param: ?session_token=...
 * - Via a cookie (handled by fetching /api/auth/me)
 */
export default function AuthPopupCallbackScreen() {
  const params = useLocalSearchParams();

  useEffect(() => {
    console.log('🪟 [POPUP CALLBACK] Popup callback page loaded');
    console.log('🪟 [POPUP CALLBACK] Params:', JSON.stringify(params));
    console.log('🪟 [POPUP CALLBACK] Full URL:', typeof window !== 'undefined' ? window.location.href : 'N/A');

    const handleCallback = async () => {
      try {
        const error = params.error as string | undefined;

        if (error) {
          console.error('❌ [POPUP CALLBACK] OAuth error:', error);
          if (window.opener) {
            window.opener.postMessage(
              { type: 'auth-error', error },
              window.location.origin
            );
          }
          return;
        }

        // Try to extract token from various possible parameter names
        // Better Auth may use different parameter names depending on version/config
        const token = (params.token as string | undefined) ||
          (params.session_token as string | undefined) ||
          (params.sessionToken as string | undefined) ||
          (params.access_token as string | undefined);

        console.log('🪟 [POPUP CALLBACK] Token found in params:', !!token);

        if (token) {
          console.log('✅ [POPUP CALLBACK] Token received from URL params, sending to parent window...');

          // Send token to parent window
          if (window.opener) {
            window.opener.postMessage(
              { type: 'auth-success', token },
              window.location.origin
            );
            console.log('✅ [POPUP CALLBACK] Message sent to parent, closing popup...');
            window.close();
          } else {
            console.error('❌ [POPUP CALLBACK] No window.opener available');
          }
          return;
        }

        // No token in URL params - try fetching from /api/auth/me using cookies
        // Better Auth may have set a session cookie after OAuth
        console.log('🪟 [POPUP CALLBACK] No token in URL params, trying /api/auth/me with cookies...');
        try {
          const meResponse = await fetch(`${BACKEND_URL}/api/auth/me`, {
            method: 'GET',
            credentials: 'include', // Include cookies for web
            headers: { 'Content-Type': 'application/json' },
          });

          console.log('🪟 [POPUP CALLBACK] /api/auth/me response status:', meResponse.status);

          if (meResponse.ok) {
            const meData = await meResponse.json();
            const sessionToken = meData.token || meData.session?.token;

            if (sessionToken) {
              console.log('✅ [POPUP CALLBACK] Token retrieved from /api/auth/me');
              if (window.opener) {
                window.opener.postMessage(
                  { type: 'auth-success', token: sessionToken },
                  window.location.origin
                );
                console.log('✅ [POPUP CALLBACK] Message sent to parent, closing popup...');
                window.close();
              }
              return;
            }
          }
        } catch (meError) {
          console.error('❌ [POPUP CALLBACK] Error fetching /api/auth/me:', meError);
        }

        // Still no token - report error
        console.error('❌ [POPUP CALLBACK] No token found in URL params or /api/auth/me');
        console.error('❌ [POPUP CALLBACK] URL params:', JSON.stringify(params));
        if (window.opener) {
          window.opener.postMessage(
            { type: 'auth-error', error: 'No authentication token received. Please try again.' },
            window.location.origin
          );
        }
      } catch (error) {
        console.error('❌ [POPUP CALLBACK] Error handling callback:', error);
        if (window.opener) {
          window.opener.postMessage(
            { type: 'auth-error', error: String(error) },
            window.location.origin
          );
        }
      }
    };

    handleCallback();
  }, [params]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>Completing sign in...</Text>
      <Text style={styles.subtext}>This window will close automatically.</Text>
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
    fontWeight: '600',
  },
  subtext: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
