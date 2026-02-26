
import React, { useEffect } from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  // SIMPLIFIED: Only handle auth redirects, NO tab navigation logic
  useEffect(() => {
    console.log('[TabLayout iOS] Auth check - user:', user ? user.email : 'none', 'loading:', loading, 'pathname:', pathname, 'segments:', segments);
    
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'auth-popup' || segments[0] === 'auth-callback';
    const inTabsGroup = segments[0] === '(tabs)';

    // Only redirect to auth if not logged in AND not already in auth flow
    if (!user && !inAuthGroup) {
      console.log('[TabLayout iOS] Redirecting to auth');
      router.replace('/auth');
      return;
    }

    // Don't do any other redirects - let the user navigate freely
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!user) {
    return null;
  }

  console.log('[TabLayout iOS] Rendering NativeTabs with Stack, current pathname:', pathname);

  return (
    <>
      {/* Stack is REQUIRED to register the screens properly */}
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      >
        <Stack.Screen name="(home)" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="ai-chat" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="reflect" />
        <Stack.Screen name="settings" />
      </Stack>
      
      {/* NativeTabs provides the native iOS tab bar UI */}
      <NativeTabs>
        <NativeTabs.Trigger name="(home)">
          <NativeTabs.Icon sf="house.fill" />
          <NativeTabs.Label>Home</NativeTabs.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="reports">
          <NativeTabs.Icon sf="chart.bar.fill" />
          <NativeTabs.Label>Reports</NativeTabs.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="ai-chat">
          <NativeTabs.Icon sf="mic.fill" />
          <NativeTabs.Label>AI</NativeTabs.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Icon sf="person.fill" />
          <NativeTabs.Label>Profile</NativeTabs.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
