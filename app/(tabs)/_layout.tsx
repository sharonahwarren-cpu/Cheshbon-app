
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/styles/commonStyles';

export default function TabLayout() {
  const colorScheme = 'light'; // Simplified - remove useColorScheme dependency
  const router = useRouter();
  const { user, loading } = useAuth();

  // Redirect to auth screen if not authenticated
  useEffect(() => {
    console.log('🔐 [TAB LAYOUT] Auth state:', { user: !!user, loading });
    if (!loading && !user) {
      console.log('🔐 [TAB LAYOUT] User not authenticated, redirecting to auth...');
      router.replace('/auth');
    }
  }, [user, loading, router]);

  // Show loading while checking auth
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Don't render tabs if not authenticated
  if (!user) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} ios_icon_name="house.fill" android_material_icon_name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color }) => <IconSymbol size={28} ios_icon_name="chart.bar.fill" android_material_icon_name="bar-chart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <IconSymbol size={28} ios_icon_name="gear" android_material_icon_name="settings" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} ios_icon_name="person.fill" android_material_icon_name="person" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reflect"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ai-chat"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
