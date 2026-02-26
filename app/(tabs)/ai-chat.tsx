
import React from 'react';
import { Stack } from 'expo-router';
import AIChatScreen from '../ai-chat';

// Non-iOS version - wrapped to work within tabs
export default function AIChatTabScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AIChatScreen />
    </>
  );
}
