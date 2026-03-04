
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/styles/commonStyles';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

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
      }}
    >
      <NativeTabs.Screen
        name="(home)"
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: () => (
            <>
              <Icon sf={{ default: 'house', selected: 'house.fill' }} drawable="home" />
            </>
          ),
        }}
      />
      <NativeTabs.Screen
        name="reports"
        options={{
          tabBarLabel: 'Reports',
          tabBarIcon: () => (
            <>
              <Icon sf={{ default: 'chart.bar.doc.horizontal', selected: 'chart.bar.doc.horizontal.fill' }} drawable="assessment" />
            </>
          ),
        }}
      />
      <NativeTabs.Screen
        name="settings"
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: () => (
            <>
              <Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} drawable="settings" />
            </>
          ),
        }}
      />
      <NativeTabs.Screen
        name="profile"
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: () => (
            <>
              <Icon sf={{ default: 'person.circle', selected: 'person.circle.fill' }} drawable="account-circle" />
            </>
          ),
        }}
      />
      <NativeTabs.Screen
        name="reflect"
        options={{
          href: null,
          tabBarLabel: 'Reflect',
          tabBarIcon: () => (
            <>
              <Icon sf={{ default: 'book', selected: 'book.fill' }} drawable="book" />
            </>
          ),
        }}
      />
      <NativeTabs.Screen
        name="ai-chat"
        options={{
          href: null,
          tabBarLabel: 'AI Chat',
          tabBarIcon: () => (
            <>
              <Icon sf="message" drawable="chat" />
            </>
          ),
        }}
      />
    </NativeTabs>
  );
}
