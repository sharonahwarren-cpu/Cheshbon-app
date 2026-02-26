
import React, { useEffect } from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
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
        <Icon sf="house.fill" />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reports">
        <Icon sf="chart.bar.fill" />
        <Label>Reports</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ai-chat">
        <Icon sf="mic.fill" />
        <Label>AI</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf="person.fill" />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
