
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/styles/commonStyles';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { IconSymbol } from '@/components/IconSymbol.ios';

export default function TabLayout() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Redirect to auth screen if not authenticated
  useEffect(() => {
    console.log('🔐 [TAB LAYOUT iOS] Auth state:', { user: !!user, loading });
    if (!loading && !user) {
      console.log('🔐 [TAB LAYOUT iOS] User not authenticated, redirecting to auth...');
      router.replace('/auth');
    }
  }, [user, loading]);

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
    <NativeTabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        headerShown: false,
      }}
    >
      <NativeTabs.Screen
        name="(home)"
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <IconSymbol 
              ios_icon_name={focused ? 'house.fill' : 'house'} 
              android_material_icon_name="home"
              color={color}
              size={24}
            />
          ),
        }}
      />
      <NativeTabs.Screen
        name="reports"
        options={{
          tabBarLabel: 'Reports',
          tabBarIcon: ({ focused, color }) => (
            <IconSymbol 
              ios_icon_name={focused ? 'chart.bar.doc.horizontal.fill' : 'chart.bar.doc.horizontal'} 
              android_material_icon_name="assessment"
              color={color}
              size={24}
            />
          ),
        }}
      />
      <NativeTabs.Screen
        name="settings"
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ focused, color }) => (
            <IconSymbol 
              ios_icon_name={focused ? 'gearshape.fill' : 'gearshape'} 
              android_material_icon_name="settings"
              color={color}
              size={24}
            />
          ),
        }}
      />
      <NativeTabs.Screen
        name="profile"
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <IconSymbol 
              ios_icon_name={focused ? 'person.circle.fill' : 'person.circle'} 
              android_material_icon_name="account-circle"
              color={color}
              size={24}
            />
          ),
        }}
      />
      <NativeTabs.Screen
        name="reflect"
        options={{
          href: null,
          tabBarLabel: 'Reflect',
          tabBarIcon: ({ focused, color }) => (
            <IconSymbol 
              ios_icon_name={focused ? 'book.fill' : 'book'} 
              android_material_icon_name="book"
              color={color}
              size={24}
            />
          ),
        }}
      />
      <NativeTabs.Screen
        name="ai-chat"
        options={{
          href: null,
          tabBarLabel: 'AI Chat',
          tabBarIcon: ({ focused, color }) => (
            <IconSymbol 
              ios_icon_name={focused ? 'message.fill' : 'message'} 
              android_material_icon_name="chat"
              color={color}
              size={24}
            />
          ),
        }}
      />
    </NativeTabs>
  );
}
