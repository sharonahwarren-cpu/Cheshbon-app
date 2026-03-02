
import React, { useEffect, useState } from 'react';
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
 * 
 * Updated Flow (after backend fix):
 * 1. User clicks "Continue with Google" in the parent window
 * 2. Parent calls /api/auth/initiate-social → gets direct accounts.google.com URL
 * 3. Parent opens popup with the direct Google OAuth URL
 * 4. User authenticates with Google
 * 5. Google redirects to backend /api/auth/callback/google (Better Auth's callback)
 * 6. Better Auth exchanges the code, creates a session, and redirects to:
 *    - The callbackURL/redirectURL passed in the original request (this page)
 *    - With a token parameter: /auth-popup-callback?token=...
 * 7. This page extracts the token and sends it to the parent window via postMessage
 * 8. Parent window receives the token, saves it, and closes the popup
 * 
 * Fallback: If no token in URL, try /api/auth/me with cookies (Better Auth session cookie)
 */
export default function AuthPopupCallbackScreen() {
  const params = useLocalSearchParams();
  const [statusText, setStatusText] = useState('Completing sign in...');

  useEffect(() => {
    console.log('🪟 [POPUP CALLBACK] Popup callback page loaded');
    console.log('🪟 [POPUP CALLBACK] Params:', JSON.stringify(params));
    console.log('🪟 [POPUP CALLBACK] Full URL:', typeof window !== 'undefined' ? window.location.href : 'N/A');

    const handleCallback = async () => {
      try {
        // Check for OAuth error first
        const error = params.error as string | undefined;
        const errorDescription = params.error_description as string | undefined;

        if (error) {
          console.error('❌ [POPUP CALLBACK] OAuth error:', error, errorDescription);
          setStatusText('Sign in failed. Closing...');
          if (typeof window !== 'undefined' && window.opener) {
            window.opener.postMessage(
              { type: 'auth-error', error: errorDescription || error },
              window.location.origin
            );
          }
          return;
        }

        // Try to extract token from various possible parameter names.
        // After the backend fix, Better Auth redirects to this page with a token
        // parameter after successfully processing the Google OAuth callback.
        const token = (params.token as string | undefined) ||
          (params.session_token as string | undefined) ||
          (params.sessionToken as string | undefined) ||
          (params.access_token as string | undefined);

        console.log('🪟 [POPUP CALLBACK] Token found in URL params:', !!token);
        if (token) {
          console.log('🪟 [POPUP CALLBACK] Token length:', token.length);
        }

        if (token) {
          console.log('✅ [POPUP CALLBACK] Token received from URL params, sending to parent window...');
          setStatusText('Sign in successful! Closing...');

          if (typeof window !== 'undefined' && window.opener) {
            window.opener.postMessage(
              { type: 'auth-success', token },
              window.location.origin
            );
            console.log('✅ [POPUP CALLBACK] Message sent to parent, closing popup...');
            // Small delay to ensure message is received before closing
            setTimeout(() => {
              try { window.close(); } catch (e) { /* ignore */ }
            }, 500);
          } else {
            console.warn('⚠️ [POPUP CALLBACK] No window.opener - storing token in sessionStorage as fallback');
            // If no opener, store token in sessionStorage so the main window can pick it up
            try {
              if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('oauth_token', token);
                console.log('🪟 [POPUP CALLBACK] Token stored in sessionStorage as fallback');
              }
            } catch (e) { /* ignore */ }
          }
          return;
        }

        // No token in URL params - try fetching from /api/auth/me using cookies.
        // This handles the case where Better Auth sets a session cookie after OAuth
        // instead of redirecting with a token parameter in the URL.
        console.log('🪟 [POPUP CALLBACK] No token in URL params, trying /api/auth/me with cookies...');
        setStatusText('Verifying session...');

        try {
          const meResponse = await fetch(`${BACKEND_URL}/api/auth/me`, {
            method: 'GET',
            credentials: 'include', // Include cookies for web session
            headers: { 'Content-Type': 'application/json' },
          });

          console.log('🪟 [POPUP CALLBACK] /api/auth/me response status:', meResponse.status);

          if (meResponse.ok) {
            const meData = await meResponse.json();
            const sessionToken = meData.token || meData.session?.token;

            if (sessionToken) {
              console.log('✅ [POPUP CALLBACK] Token retrieved from /api/auth/me (cookie-based session)');
              setStatusText('Sign in successful! Closing...');

              if (typeof window !== 'undefined' && window.opener) {
                window.opener.postMessage(
                  { type: 'auth-success', token: sessionToken },
                  window.location.origin
                );
                console.log('✅ [POPUP CALLBACK] Message sent to parent, closing popup...');
                setTimeout(() => {
                  try { window.close(); } catch (e) { /* ignore */ }
                }, 500);
              }
              return;
            } else {
              console.warn('⚠️ [POPUP CALLBACK] /api/auth/me returned OK but no token in response');
              console.warn('⚠️ [POPUP CALLBACK] Response keys:', Object.keys(meData));
            }
          } else {
            console.warn('⚠️ [POPUP CALLBACK] /api/auth/me returned:', meResponse.status);
          }
        } catch (meError) {
          console.error('❌ [POPUP CALLBACK] Error fetching /api/auth/me:', meError);
        }

        // Check if this page received an OAuth code (shouldn't happen - backend should handle it)
        const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
        const hasOAuthCode = currentUrl.includes('code=');
        const hasOAuthState = currentUrl.includes('state=');
        
        if (hasOAuthCode) {
          console.error('❌ [POPUP CALLBACK] Received OAuth code directly - backend did not process it');
          console.error('❌ [POPUP CALLBACK] This means the redirect_uri in the Google OAuth URL points to this page');
          console.error('❌ [POPUP CALLBACK] instead of the backend callback endpoint. Check backend configuration.');
          setStatusText('Sign in error. Please try again.');
          if (typeof window !== 'undefined' && window.opener) {
            window.opener.postMessage(
              { type: 'auth-error', error: 'OAuth configuration error: authorization code was not processed by the backend. Please try again.' },
              window.location.origin
            );
          }
          return;
        }

        // Still no token - report error to parent
        console.error('❌ [POPUP CALLBACK] No token found in URL params or /api/auth/me');
        console.error('❌ [POPUP CALLBACK] URL params:', JSON.stringify(params));
        console.error('❌ [POPUP CALLBACK] Full URL:', currentUrl.substring(0, 300));
        setStatusText('Sign in failed. Please try again.');

        if (typeof window !== 'undefined' && window.opener) {
          window.opener.postMessage(
            { type: 'auth-error', error: 'No authentication token received. The sign-in may have failed or timed out. Please try again.' },
            window.location.origin
          );
        }
      } catch (error) {
        console.error('❌ [POPUP CALLBACK] Error handling callback:', error);
        setStatusText('Sign in error. Please try again.');
        if (typeof window !== 'undefined' && window.opener) {
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
      <Text style={styles.text}>{statusText}</Text>
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
