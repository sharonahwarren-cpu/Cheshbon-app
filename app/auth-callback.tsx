
import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';

export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    console.log('🔄 [AUTH CALLBACK] Screen mounted, redirecting to home...');
    // Give the auth context time to process the session
    setTimeout(() => {
      router.replace('/(tabs)/(home)');
    }, 1000);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.message}>Completing sign in...</Text>
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
  },
});
