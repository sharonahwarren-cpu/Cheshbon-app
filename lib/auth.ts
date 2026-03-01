
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const BEARER_TOKEN_KEY = 'cheshbon_bearer_token';

/**
 * Save bearer token to secure storage
 */
export async function setBearerToken(token: string | null): Promise<void> {
  console.log('💾 [AUTH LIB] Saving bearer token...');
  try {
    if (!token) {
      await removeBearerToken();
      return;
    }

    if (Platform.OS === 'web') {
      localStorage.setItem(BEARER_TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token);
    }
    console.log('✅ [AUTH LIB] Bearer token saved');
  } catch (error) {
    console.error('❌ [AUTH LIB] Error saving bearer token:', error);
    throw error;
  }
}

/**
 * Get bearer token from secure storage
 */
export async function getBearerToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(BEARER_TOKEN_KEY);
    } else {
      return await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
    }
  } catch (error) {
    console.error('❌ [AUTH LIB] Error getting bearer token:', error);
    return null;
  }
}

/**
 * Remove bearer token from secure storage
 */
export async function removeBearerToken(): Promise<void> {
  console.log('🗑️ [AUTH LIB] Removing bearer token...');
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(BEARER_TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY);
    }
    console.log('✅ [AUTH LIB] Bearer token removed');
  } catch (error) {
    console.error('❌ [AUTH LIB] Error removing bearer token:', error);
  }
}
