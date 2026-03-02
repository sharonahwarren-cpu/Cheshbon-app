
import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import Constants from 'expo-constants';

const BACKEND_URL =
  Constants.expoConfig?.extra?.backendUrl ||
  'https://a8sew4dfz3q59y6r9k8fhpt2jfdhpm8d.app.specular.dev';

/**
 * OAuth Popup Callback Handler for Web
 *
 * This page is opened in a popup window during OAuth sign-in on web.
 * It receives the session token from the OAuth callback and sends it
 * back to the parent window via postMessage.
 *
 * URL format: /auth-popup-callback?token=SESSION_TOKEN
 *
 * If no token is in the URL (Better Auth uses cookies), we fetch the
 * session from /api/auth/me using the cookie that Better Auth set.
 */
export default function AuthPopupCallbackScreen() {
  const params = useLocalSearchParams();

  useEffect(() => {
    console.log('🔄 [POPUP CALLBACK] Processing OAuth callback...');
    console.log('🔄 [POPUP CALLBACK] Params:', JSON.stringify(params));

    const handleCallback = async () => {
      try {
        // Extract token from various possible parameter names in the URL
        const token =
          (params.token as string) ||
          (params.session_token as string) ||
          (params.sessionToken as string) ||
          (params.access_token as string) ||
          (params.accessToken as string);

        console.log('🔄 [POPUP CALLBACK] Token in URL:', token ? 'YES' : 'NO');

        if (token) {
          // Token was passed directly in the URL
          console.log('✅ [POPUP CALLBACK] Token found in URL, sending to parent window...');
          sendTokenToParent(token);
          return;
        }

        // No token in URL - Better Auth may have set a session cookie
        // Try to fetch the session from /api/auth/me using the cookie
        console.log('🔄 [POPUP CALLBACK] No token in URL, trying /api/auth/me with cookies...');

        const meResponse = await fetch(`${BACKEND_URL}/api/auth/me`, {
          method: 'GET',
          credentials: 'include', // Send cookies
          headers: { 'Content-Type': 'application/json' },
        });

        console.log('🔄 [POPUP CALLBACK] /api/auth/me response status:', meResponse.status);

        if (meResponse.ok) {
          const meData = await meResponse.json();
          const sessionToken = meData.token || meData.session?.token;

          if (sessionToken) {
            console.log('✅ [POPUP CALLBACK] Got token from /api/auth/me, sending to parent...');
            sendTokenToParent(sessionToken);
            return;
          }
        }

        // Check if there's an error parameter
        const errorParam = params.error as string;
        if (errorParam) {
          console.error('❌ [POPUP CALLBACK] Error in URL params:', errorParam);
          sendErrorToParent(errorParam);
          return;
        }

        console.error('❌ [POPUP CALLBACK] No token found in URL or session');
        console.error('❌ [POPUP CALLBACK] Available params:', Object.keys(params));
        sendErrorToParent('No authentication token received. Please try again.');
      } catch (error) {
        console.error('❌ [POPUP CALLBACK] Error:', error);
        sendErrorToParent(error instanceof Error ? error.message : 'Authentication failed');
      }
    };

    const sendTokenToParent = (token: string) => {
      if (window.opener) {
        window.opener.postMessage(
          { type: 'auth-success', token },
          window.location.origin
        );
        console.log('✅ [POPUP CALLBACK] auth-success message sent to parent');
      } else {
        console.warn('⚠️ [POPUP CALLBACK] No window.opener found');
      }
      setTimeout(() => {
        console.log('🔄 [POPUP CALLBACK] Closing popup...');
        window.close();
      }, 500);
    };

    const sendErrorToParent = (error: string) => {
      if (window.opener) {
        window.opener.postMessage(
          { type: 'auth-error', error },
          window.location.origin
        );
        console.log('❌ [POPUP CALLBACK] auth-error message sent to parent');
      }
      setTimeout(() => {
        window.close();
      }, 1000);
    };

    handleCallback();
  }, [params]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>Completing sign in...</Text>
      <Text style={styles.subtext}>This window will close automatically</Text>
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
    fontWeight: '600',
  },
  subtext: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
