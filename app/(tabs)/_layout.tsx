
import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet } from '@/utils/api';

type PreferredHomeScreen = 'reflect' | 'goals-detailed' | 'goals-concise';

const HOME_SCREEN_ROUTES: Record<PreferredHomeScreen, string> = {
  'reflect': '/(tabs)/(home)/',
  'goals-detailed': '/(tabs)/(home)/',
  'goals-concise': '/(tabs)/(home)/',
};

export default function TabLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [preferredHomeScreen, setPreferredHomeScreen] = useState<PreferredHomeScreen>('reflect');
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Load user preferences to determine home screen
  useEffect(() => {
    if (user && !prefsLoaded) {
      console.log('[TabLayout] Loading user preferences for home screen routing');
      authenticatedGet<any>('/api/user-preferences')
        .then((data) => {
          const prefs = data?.data || data;
          const homeScreen = prefs?.preferredHomeScreen as PreferredHomeScreen;
          if (homeScreen && ['reflect', 'goals-detailed', 'goals-concise'].includes(homeScreen)) {
            console.log('[TabLayout] Preferred home screen:', homeScreen);
            setPreferredHomeScreen(homeScreen);
          }
          setPrefsLoaded(true);
        })
        .catch((err) => {
          console.error('[TabLayout] Failed to load preferences:', err);
          setPrefsLoaded(true);
        });
    }
  }, [user, prefsLoaded]);

  useEffect(() => {
    console.log('Auth state changed - user:', user ? 'logged in' : 'not logged in', 'loading:', loading);
    
    if (loading) {
      return;
    }

    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'auth-popup' || segments[0] === 'auth-callback';

    if (!user && !inAuthGroup) {
      console.log('User not authenticated, redirecting to login screen');
      setPrefsLoaded(false);
      router.replace('/auth');
    } else if (user && inAuthGroup && prefsLoaded) {
      // Redirect to preferred home screen
      const targetRoute = HOME_SCREEN_ROUTES[preferredHomeScreen] || '/(tabs)/(home)/';
      console.log('User authenticated, redirecting to preferred home screen:', targetRoute, '(', preferredHomeScreen, ')');
      router.replace(targetRoute as any);
    } else if (user && inAuthGroup && !prefsLoaded) {
      // Wait for prefs to load before redirecting
      console.log('User authenticated, waiting for preferences to load...');
    }
  }, [user, loading, segments, preferredHomeScreen, prefsLoaded]);

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
      name: 'reflect',
      route: '/(tabs)/reflect',
      icon: 'edit',
      label: 'Reflect',
    },
    {
      name: '(home)',
      route: '/(tabs)/(home)/',
      icon: 'flash-on',
      label: 'Home',
    },
    {
      name: 'reports',
      route: '/(tabs)/reports',
      icon: 'assessment',
      label: 'Reports',
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
        <Stack.Screen key="reflect" name="reflect" />
        <Stack.Screen key="home" name="(home)" />
        <Stack.Screen key="reports" name="reports" />
        <Stack.Screen key="profile" name="profile" />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
