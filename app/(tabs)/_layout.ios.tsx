
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

  return (
    <NativeTabs>
      <NativeTabs.Trigger key="home" name="(home)">
        <Icon sf="house.fill" />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger key="reflect" name="reflect">
        <Icon sf="square.and.pencil" />
        <Label>Reflect</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger key="settings" name="settings">
        <Icon sf="gear" />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger key="profile" name="profile">
        <Icon sf="person.fill" />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
