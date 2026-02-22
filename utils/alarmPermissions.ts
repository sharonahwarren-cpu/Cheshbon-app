
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Request foreground location permissions
 */
export async function requestForegroundLocationPermission(): Promise<boolean> {
  console.log('Requesting foreground location permission');
  
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    
    console.log('Foreground location permission:', granted ? 'granted' : 'denied');
    return granted;
  } catch (error) {
    console.error('Error requesting foreground location permission:', error);
    return false;
  }
}

/**
 * Request background location permissions
 */
export async function requestBackgroundLocationPermission(): Promise<boolean> {
  console.log('Requesting background location permission');
  
  try {
    // First ensure foreground permission is granted
    const foregroundStatus = await Location.getForegroundPermissionsAsync();
    if (foregroundStatus.status !== 'granted') {
      console.log('Foreground permission not granted, requesting first');
      const foregroundGranted = await requestForegroundLocationPermission();
      if (!foregroundGranted) {
        return false;
      }
    }
    
    // Then request background permission
    const { status } = await Location.requestBackgroundPermissionsAsync();
    const granted = status === 'granted';
    
    console.log('Background location permission:', granted ? 'granted' : 'denied');
    return granted;
  } catch (error) {
    console.error('Error requesting background location permission:', error);
    return false;
  }
}

/**
 * Request notification permissions
 */
export async function requestNotificationPermission(): Promise<boolean> {
  console.log('Requesting notification permission');
  
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    const granted = finalStatus === 'granted';
    console.log('Notification permission:', granted ? 'granted' : 'denied');
    
    if (!granted) {
      console.warn('Notification permission not granted');
    }
    
    return granted;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Check if all required permissions are granted
 */
export async function checkAllPermissions(): Promise<{
  foregroundLocation: boolean;
  backgroundLocation: boolean;
  notifications: boolean;
}> {
  console.log('Checking all alarm permissions');
  
  try {
    const [foregroundLoc, backgroundLoc, notif] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
      Notifications.getPermissionsAsync(),
    ]);
    
    const permissions = {
      foregroundLocation: foregroundLoc.status === 'granted',
      backgroundLocation: backgroundLoc.status === 'granted',
      notifications: notif.status === 'granted',
    };
    
    console.log('Permission status:', permissions);
    return permissions;
  } catch (error) {
    console.error('Error checking permissions:', error);
    return {
      foregroundLocation: false,
      backgroundLocation: false,
      notifications: false,
    };
  }
}

/**
 * Request all required permissions for alarm system
 */
export async function requestAllAlarmPermissions(): Promise<boolean> {
  console.log('Requesting all alarm permissions');
  
  try {
    // Request in order: foreground location -> notifications -> background location
    const foregroundGranted = await requestForegroundLocationPermission();
    if (!foregroundGranted) {
      console.warn('Foreground location permission denied');
      return false;
    }
    
    const notificationsGranted = await requestNotificationPermission();
    if (!notificationsGranted) {
      console.warn('Notification permission denied');
      return false;
    }
    
    const backgroundGranted = await requestBackgroundLocationPermission();
    if (!backgroundGranted) {
      console.warn('Background location permission denied (optional for some features)');
      // Don't return false here as background location is optional for some alarm types
    }
    
    console.log('All required alarm permissions granted');
    return true;
  } catch (error) {
    console.error('Error requesting all alarm permissions:', error);
    return false;
  }
}
