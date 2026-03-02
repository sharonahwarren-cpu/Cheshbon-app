
import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';

/**
 * OAuth Popup Callback Handler for Web
 * 
 * This page is opened in a popup window during OAuth sign-in on web.
 * It receives the session token from the OAuth callback and sends it
 * back to the parent window via postMessage.
 * 
 * URL format: /auth-popup-callback?token=SESSION_TOKEN
 */
export default function AuthPopupCallbackScreen() {
  const params = useLocalSearchParams();

  useEffect(() => {
    console.log('🔄 [POPUP CALLBACK] Processing OAuth callback...');
    console.log('🔄 [POPUP CALLBACK] Params:', JSON.stringify(params));

    const handleCallback = () => {
      try {
        // Extract token from various possible parameter names
        const token = 
          (params.token as string) || 
          (params.session_token as string) || 
          (params.sessionToken as string) ||
          (params.access_token as string) ||
          (params.accessToken as string);

        console.log('🔄 [POPUP CALLBACK] Token found:', token ? 'YES' : 'NO');

        if (!token) {
          console.error('❌ [POPUP CALLBACK] No token in URL');
          console.error('❌ [POPUP CALLBACK] Available params:', Object.keys(params));
          
          // Check if there's an error parameter
          const error = (params.error as string) || 'No authentication token received';
          
          // Send error to parent window
          if (window.opener) {
            window.opener.postMessage(
              {
                type: 'auth-error',
                error,
              },
              window.location.origin
            );
          }
          
          // Close popup after a short delay
          setTimeout(() => {
            window.close();
          }, 1000);
          return;
        }

        console.log('✅ [POPUP CALLBACK] Token received, sending to parent window...');

        // Send token to parent window
        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'auth-success',
              token,
            },
            window.location.origin
          );
          console.log('✅ [POPUP CALLBACK] Message sent to parent');
        } else {
          console.warn('⚠️ [POPUP CALLBACK] No window.opener found');
        }

        // Close popup after a short delay
        setTimeout(() => {
          console.log('🔄 [POPUP CALLBACK] Closing popup...');
          window.close();
        }, 500);
      } catch (error) {
        console.error('❌ [POPUP CALLBACK] Error:', error);
        
        // Send error to parent window
        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'auth-error',
              error: error instanceof Error ? error.message : 'Authentication failed',
            },
            window.location.origin
          );
        }
        
        // Close popup
        setTimeout(() => {
          window.close();
        }, 1000);
      }
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
