
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    console.log('[TabLayout] Auth state - user:', user ? user.email : 'not logged in', 'loading:', loading, 'segments:', segments);
    
    if (loading) {
      return;
    }

    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'auth-popup' || segments[0] === 'auth-callback';

    // Only redirect to auth if user is not logged in AND not already in auth flow
    if (!user && !inAuthGroup) {
      console.log('[TabLayout] User not authenticated, redirecting to login screen');
      router.replace('/auth');
    }
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

  const tabs: TabBarItem[] = [
    {
      name: '(home)',
      route: '/(tabs)/(home)/' as any,
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
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
