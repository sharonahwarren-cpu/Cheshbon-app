
import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useRouter, useSegments, usePathname } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

export default function TabLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  // SIMPLIFIED: Only handle auth redirects, NO tab navigation logic
  useEffect(() => {
    console.log('[TabLayout iOS] Auth check - user:', user ? user.email : 'none', 'loading:', loading, 'pathname:', pathname, 'segments:', segments);
    
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'auth-popup' || segments[0] === 'auth-callback';

    // Only redirect to auth if not logged in AND not already in auth flow
    if (!user && !inAuthGroup) {
      console.log('[TabLayout iOS] Redirecting to auth');
      router.replace('/auth');
      return;
    }

    // Don't do any other redirects - let the user navigate freely
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

  console.log('[TabLayout iOS] Rendering Tabs, current pathname:', pathname);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol ios_icon_name="house.fill" android_material_icon_name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol ios_icon_name="chart.bar.fill" android_material_icon_name="assessment" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-chat"
        options={{
          title: 'AI',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol ios_icon_name="mic.fill" android_material_icon_name="mic" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reflect"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
