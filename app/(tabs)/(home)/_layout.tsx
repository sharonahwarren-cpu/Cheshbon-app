
import { Platform } from 'react-native';
import { Stack } from 'expo-router';

export default function HomeLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false, // Hide header on all platforms - the screen has its own custom header
          title: 'Home'
        }}
      />
    </Stack>
  );
}
