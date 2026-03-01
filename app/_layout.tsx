
import { SystemBars } from "react-native-edge-to-edge";
import { useFonts } from "expo-font";
import { useNetworkState } from "expo-network";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { useColorScheme, View, ActivityIndicator } from "react-native";
import Toast from 'react-native-toast-message';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import "react-native-reanimated";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { colors } from "@/styles/commonStyles";

SplashScreen.preventAutoHideAsync();

/**
 * Auth Bootstrap Component
 * Handles the auth initialization flow:
 * 1. Shows loading while checking session
 * 2. Redirects to auth screen if not authenticated
 * 3. Redirects to app if authenticated
 */
function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) {
      console.log('🔄 [AUTH BOOTSTRAP] Still loading auth state...');
      return;
    }

    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'auth-callback' || segments[0] === 'auth-popup-callback' || segments[0] === 'auth-popup';
    console.log('🔐 [AUTH BOOTSTRAP] Auth state resolved:', { user: !!user, inAuthGroup, segments });

    if (!user && !inAuthGroup) {
      // Not authenticated and not on auth screen - redirect to auth
      console.log('🔐 [AUTH BOOTSTRAP] Not authenticated, redirecting to /auth');
      router.replace('/auth');
    } else if (user && inAuthGroup) {
      // Authenticated but on auth screen - redirect to app
      console.log('🔐 [AUTH BOOTSTRAP] Authenticated, redirecting to /(tabs)/(home)');
      router.replace('/(tabs)/(home)');
    }
  }, [user, loading, segments]);

  // Show loading splash while checking auth
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  const { isConnected } = useNetworkState();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (isConnected === false) {
      console.log("⚠️ Network disconnected - user is offline");
    }
  }, [isConnected]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <WidgetProvider>
          <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <SystemBars style="auto" />
            <AuthBootstrap>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="auth" options={{ headerShown: false }} />
                <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
                <Stack.Screen name="auth-popup-callback" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="ai-chat" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
            </AuthBootstrap>
            <StatusBar style="auto" />
            {/* Global Toast Component */}
            <Toast />
          </ThemeProvider>
        </WidgetProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
