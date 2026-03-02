
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
 * 
 * Flow:
 * 1. User clicks "Continue with Google" in the parent window
 * 2. Parent opens this page in a popup
 * 3. This page redirects to Google OAuth (via backend's /api/auth/initiate-social)
 * 4. Google redirects back to backend's /api/auth/callback/google
 * 5. Backend processes the OAuth code, creates a session, and redirects to this page
 *    with a token parameter: /auth-popup-callback?token=...
 * 6. This page extracts the token and sends it to the parent window via postMessage
 * 7. Parent window receives the token, saves it, and closes the popup
 * 
 * The backend (after the fix) returns the actual Google OAuth URL from /api/auth/initiate-social,
 * so the popup goes directly to accounts.google.com instead of a backend self-referencing URL.
 */
export default function AuthPopupCallbackScreen() {
  const params = useLocalSearchParams();

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
          if (window.opener) {
            window.opener.postMessage(
              { type: 'auth-error', error: errorDescription || error },
              window.location.origin
            );
          }
          return;
        }

        // Try to extract token from various possible parameter names
        // The backend (after the fix) redirects to this page with a token parameter
        // after successfully processing the Google OAuth callback
        const token = (params.token as string | undefined) ||
          (params.session_token as string | undefined) ||
          (params.sessionToken as string | undefined) ||
          (params.access_token as string | undefined);

        console.log('🪟 [POPUP CALLBACK] Token found in params:', !!token);
        if (token) {
          console.log('🪟 [POPUP CALLBACK] Token length:', token.length);
        }

        if (token) {
          console.log('✅ [POPUP CALLBACK] Token received from URL params, sending to parent window...');

          // Send token to parent window
          if (window.opener) {
            window.opener.postMessage(
              { type: 'auth-success', token },
              window.location.origin
            );
            console.log('✅ [POPUP CALLBACK] Message sent to parent, closing popup...');
            // Small delay to ensure message is received before closing
            setTimeout(() => {
              try { window.close(); } catch (e) { /* ignore */ }
            }, 300);
          } else {
            console.error('❌ [POPUP CALLBACK] No window.opener available');
            // If no opener, we might be in a redirect flow - try to handle gracefully
            // Store token in sessionStorage so the main window can pick it up
            try {
              sessionStorage.setItem('oauth_token', token);
              console.log('🪟 [POPUP CALLBACK] Token stored in sessionStorage as fallback');
            } catch (e) { /* ignore */ }
          }
          return;
        }

        // No token in URL params - try fetching from /api/auth/me using cookies
        // This handles the case where Better Auth sets a session cookie after OAuth
        // instead of redirecting with a token parameter
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
                setTimeout(() => {
                  try { window.close(); } catch (e) { /* ignore */ }
                }, 300);
              }
              return;
            }
          }
        } catch (meError) {
          console.error('❌ [POPUP CALLBACK] Error fetching /api/auth/me:', meError);
        }

        // Check if this is an intermediate page (e.g., the popup was opened with the Google OAuth URL
        // and Google hasn't redirected back yet). In this case, we just wait.
        const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
        const isGoogleCallback = currentUrl.includes('code=') || currentUrl.includes('state=');
        
        if (isGoogleCallback) {
          console.log('🪟 [POPUP CALLBACK] Detected Google OAuth callback params (code/state) - backend should process these');
          // The backend should have processed the code and redirected here with a token
          // If we're here without a token, something went wrong with the backend processing
          console.error('❌ [POPUP CALLBACK] Google OAuth code received but no token - backend may not have processed it correctly');
        }

        // Still no token - report error
        console.error('❌ [POPUP CALLBACK] No token found in URL params or /api/auth/me');
        console.error('❌ [POPUP CALLBACK] URL params:', JSON.stringify(params));
        console.error('❌ [POPUP CALLBACK] Full URL:', currentUrl.substring(0, 200));
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
