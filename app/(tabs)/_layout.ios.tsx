
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
      <NativeTabs.Trigger name="(home)">
        <Label>Home</Label>
        <Icon sf={{ default: 'house', selected: 'house.fill' }} drawable="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reports">
        <Label>Reports</Label>
        <Icon sf={{ default: 'chart.bar.doc.horizontal', selected: 'chart.bar.doc.horizontal.fill' }} drawable="assessment" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Label>Settings</Label>
        <Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} drawable="settings" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        <Icon sf={{ default: 'person.circle', selected: 'person.circle.fill' }} drawable="person" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reflect" hidden={true}>
        <Label>Reflect</Label>
        <Icon sf={{ default: 'book.closed', selected: 'book.closed.fill' }} drawable="menu-book" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ai-chat" hidden={true}>
        <Label>AI Chat</Label>
        <Icon sf={{ default: 'message', selected: 'message.fill' }} drawable="chat" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
