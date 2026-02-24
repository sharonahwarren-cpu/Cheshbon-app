
import React, { useEffect, useState } from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet } from '@/utils/api';

type PreferredHomeScreen = 'reflect' | 'goals-detailed' | 'goals-concise';

export default function TabLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [preferredHomeScreen, setPreferredHomeScreen] = useState<PreferredHomeScreen>('reflect');
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Load user preferences to determine home screen
  useEffect(() => {
    if (user && !prefsLoaded) {
      console.log('[TabLayout iOS] Loading user preferences for home screen routing');
      authenticatedGet<any>('/api/user-preferences')
        .then((data) => {
          const prefs = data?.data || data;
          const homeScreen = prefs?.preferredHomeScreen as PreferredHomeScreen;
          if (homeScreen && ['reflect', 'goals-detailed', 'goals-concise'].includes(homeScreen)) {
            console.log('[TabLayout iOS] Preferred home screen:', homeScreen);
            setPreferredHomeScreen(homeScreen);
          }
          setPrefsLoaded(true);
        })
        .catch((err) => {
          console.error('[TabLayout iOS] Failed to load preferences:', err);
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
      console.log('User authenticated, redirecting to home (preferred:', preferredHomeScreen, ')');
      router.replace('/(tabs)/(home)/');
    } else if (user && inAuthGroup && !prefsLoaded) {
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

  return (
    <NativeTabs>
      <NativeTabs.Trigger key="home" name="(home)">
        <Icon sf="house.fill" />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger key="reports" name="reports">
        <Icon sf="chart.bar.fill" />
        <Label>Reports</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger 
        key="ai-chat" 
        name="ai-chat"
      >
        <Icon sf="mic.fill" />
        <Label>AI</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger key="profile" name="profile">
        <Icon sf="person.fill" />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
