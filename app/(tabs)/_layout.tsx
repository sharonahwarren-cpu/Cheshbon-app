
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
    console.log('[TabLayout] Auth state - user:', user ? user.email : 'not logged in', 'loading:', loading, 'segments:', segments);
    
    if (loading) {
      return;
    }

    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'auth-popup' || segments[0] === 'auth-callback';
    const inTabsGroup = segments[0] === '(tabs)';

    // Only redirect to auth if user is not logged in AND not already in auth flow
    if (!user && !inAuthGroup) {
      console.log('[TabLayout] User not authenticated, redirecting to login screen');
      setPrefsLoaded(false);
      router.replace('/auth');
      return;
    }

    // Only redirect from auth to home if user just logged in (coming FROM auth screens)
    // Do NOT redirect when already in tabs group
    if (user && inAuthGroup && prefsLoaded) {
      const targetRoute = HOME_SCREEN_ROUTES[preferredHomeScreen] || '/(tabs)/(home)/';
      console.log('[TabLayout] User authenticated from auth flow, redirecting to:', targetRoute);
      router.replace(targetRoute as any);
      return;
    }

    // Allow free navigation between tabs when authenticated - DO NOT redirect
    if (user && inTabsGroup) {
      console.log('[TabLayout] User authenticated, allowing free navigation to:', segments.join('/'));
      // DO NOT call router.replace here - let the user navigate freely
    }
  }, [user, loading, segments, prefsLoaded]);

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
        <Stack.Screen key="home" name="(home)" />
        <Stack.Screen key="reports" name="reports" />
        <Stack.Screen key="ai-chat" name="ai-chat" />
        <Stack.Screen key="profile" name="profile" />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
