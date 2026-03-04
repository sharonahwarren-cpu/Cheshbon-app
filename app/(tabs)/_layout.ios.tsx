
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { IconSymbol } from '@/components/IconSymbol';
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
    <NativeTabs>
      <NativeTabs.Trigger name="(home)">
        <Icon 
          sf={{ default: 'house', selected: 'house.fill' }} 
          drawable="home"
        />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reports">
        <Icon 
          sf={{ default: 'chart.bar.doc.horizontal', selected: 'chart.bar.doc.horizontal.fill' }} 
          drawable="assessment"
        />
        <Label>Reports</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon 
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }} 
          drawable="settings"
        />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon 
          sf={{ default: 'person.circle', selected: 'person.circle.fill' }} 
          drawable="account-circle"
        />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reflect" hidden={true}>
        <Icon sf={{ default: 'book', selected: 'book.fill' }} drawable="book" />
        <Label>Reflect</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ai-chat" hidden={true}>
        <Icon sf="message" drawable="chat" />
        <Label>AI Chat</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
