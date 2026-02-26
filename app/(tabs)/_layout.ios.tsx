
import React, { useEffect } from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    console.log('[TabLayout iOS] Auth state - user:', user ? user.email : 'not logged in', 'loading:', loading, 'segments:', segments);
    
    if (loading) {
      return;
    }

    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'auth-popup' || segments[0] === 'auth-callback';

    // Only redirect to auth if user is not logged in AND not already in auth flow
    if (!user && !inAuthGroup) {
      console.log('[TabLayout iOS] User not authenticated, redirecting to login screen');
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

  return (
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
  );
}
