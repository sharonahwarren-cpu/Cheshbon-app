
import React from 'react';
import { Stack } from 'expo-router';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';

export default function TabLayout() {
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
