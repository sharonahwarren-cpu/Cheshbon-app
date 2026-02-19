
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
    console.log('Auth state changed - user:', user ? 'logged in' : 'not logged in', 'loading:', loading);
    
    if (loading) {
      return;
    }

    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'auth-popup' || segments[0] === 'auth-callback';

    if (!user && !inAuthGroup) {
      console.log('User not authenticated, redirecting to login screen');
      router.replace('/auth');
    } else if (user && inAuthGroup) {
      console.log('User authenticated, redirecting to home');
      router.replace('/(tabs)/(home)/');
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
      route: '/(tabs)/(home)/',
      icon: 'home',
      label: 'Home',
    },
    {
      name: 'reports',
      route: '/(tabs)/reports',
      icon: 'assessment',
      label: 'Reports',
    },
    {
      name: 'settings',
      route: '/(tabs)/settings',
      icon: 'settings',
      label: 'Settings',
    },
    {
      name: 'profile',
      route: '/(tabs)/profile',
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
        <Stack.Screen key="home" name="(home)" />
        <Stack.Screen key="reflect" name="reflect" />
        <Stack.Screen key="reports" name="reports" />
        <Stack.Screen key="settings" name="settings" />
        <Stack.Screen key="profile" name="profile" />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
