
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
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { colors } from "@/styles/commonStyles";

SplashScreen.preventAutoHideAsync();

/**
 * Auth Bootstrap Component
 * Shows loading while checking Supabase session
 */
function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  // Show loading splash while checking auth
  if (isLoading) {
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
                <Stack.Screen name="verify-email" options={{ headerShown: false }} />
                <Stack.Screen name="reset-password" options={{ headerShown: true, title: 'Reset Password' }} />
                <Stack.Screen name="forgot-password" options={{ headerShown: true, title: 'Forgot Password' }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="ai-chat" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
            </AuthBootstrap>
            <StatusBar style="auto" />
            <Toast />
          </ThemeProvider>
        </WidgetProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
