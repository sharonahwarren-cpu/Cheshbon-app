
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  // SIMPLIFIED: Only handle auth redirects, NO tab navigation logic
  useEffect(() => {
    console.log('[TabLayout] Auth check - user:', user ? user.email : 'none', 'loading:', loading);
    
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'auth-popup' || segments[0] === 'auth-callback';

    if (!user && !inAuthGroup) {
      console.log('[TabLayout] Redirecting to auth');
      router.replace('/auth');
    }
  }, [user, loading]);

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

  console.log('[TabLayout] Rendering tabs, current pathname:', pathname);

  const tabs: TabBarItem[] = [
    {
      name: '(home)',
      route: '/(tabs)/(home)' as any,
      icon: 'home',
      label: 'Home',
    },
    {
      name: 'reports',
      route: '/(tabs)/reports' as any,
      icon: 'assessment',
      label: 'Reports',
    },
    {
      name: 'ai-chat',
      route: '/(tabs)/ai-chat' as any,
      icon: 'mic',
      label: 'AI',
    },
    {
      name: 'profile',
      route: '/(tabs)/profile' as any,
      icon: 'person',
      label: 'Profile',
    },
  ];

  return (
    <>
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
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
