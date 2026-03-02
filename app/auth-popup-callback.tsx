
import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';

/**
 * OAuth Popup Callback Handler for Web
 * This page is opened in a popup window during Google/Apple OAuth on web.
 * It extracts the token from URL params and sends it back to the parent window.
 */
export default function AuthPopupCallbackScreen() {
  const params = useLocalSearchParams();

  useEffect(() => {
    console.log('🪟 [POPUP CALLBACK] Popup callback page loaded');
    console.log('🪟 [POPUP CALLBACK] Params:', params);

    const handleCallback = () => {
      try {
        const token = params.token as string | undefined;
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

        if (!token) {
          console.error('❌ [POPUP CALLBACK] No token in URL params');
          if (window.opener) {
            window.opener.postMessage(
              { type: 'auth-error', error: 'No token received' },
              window.location.origin
            );
          }
          return;
        }

        console.log('✅ [POPUP CALLBACK] Token received, sending to parent window...');

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
