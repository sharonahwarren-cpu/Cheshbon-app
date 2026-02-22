
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { DateTime } from 'luxon';
import {
  calendarDateToUTC,
  getLocalTimeComponents,
  getLocalTimezone,
  utcToCalendarDate,
  CalendarType
} from './dateUtils';

/**
 * ALARM SCHEDULING UTILITIES
 * 
 * Handles scheduling notifications using expo-notifications with:
 * - UTC timestamp storage
 * - Local timezone interpretation
 * - Calendar-aware repeating alarms
 * - DST-aware scheduling
 */

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface AlarmConfig {
  id: string;
  title: string;
  body: string;
  utcTimestamp: number; // When the alarm should fire (UTC)
  repeat?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'none';
  calendarType?: CalendarType;
  enabled?: boolean;
}

/**
 * Request notification permissions
 * Must be called before scheduling any alarms
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('[AlarmUtils] Notification permissions not granted');
      return false;
    }
    
    console.log('[AlarmUtils] Notification permissions granted');
    return true;
  } catch (error) {
    console.error('[AlarmUtils] Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Schedule a one-time alarm at a specific UTC timestamp
 * 
 * @param config - Alarm configuration
 * @returns Notification ID if successful, null otherwise
 */
export async function scheduleAlarm(config: AlarmConfig): Promise<string | null> {
  try {
    console.log('[AlarmUtils] Scheduling alarm:', config);
    
    // Check permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.error('[AlarmUtils] Cannot schedule alarm without permissions');
      return null;
    }
    
    // Convert UTC timestamp to local time components
    const localZone = getLocalTimezone();
    const localComponents = getLocalTimeComponents(config.utcTimestamp, localZone);
    
    console.log('[AlarmUtils] Local time components for alarm:', localComponents);
    
    // Cancel existing alarm with same ID if it exists
    await cancelAlarm(config.id);
    
    // Schedule the notification
    let trigger: Notifications.NotificationTriggerInput;
    
    if (config.repeat === 'none' || !config.repeat) {
      // One-time alarm
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(config.utcTimestamp),
      };
    } else if (config.repeat === 'daily') {
      // Daily repeating alarm
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: localComponents.hour,
        minute: localComponents.minute,
      };
    } else if (config.repeat === 'weekly') {
      // Weekly repeating alarm
      const dt = DateTime.fromMillis(config.utcTimestamp, { zone: localZone });
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: dt.weekday % 7 + 1, // Convert to 1-7 (Sunday-Saturday)
        hour: localComponents.hour,
        minute: localComponents.minute,
      };
    } else {
      // For monthly/yearly, we need to use calendar-specific logic
      // Schedule as one-time and reschedule after it fires
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(config.utcTimestamp),
      };
    }
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      identifier: config.id,
      content: {
        title: config.title,
        body: config.body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger,
    });
    
    console.log('[AlarmUtils] Alarm scheduled successfully:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('[AlarmUtils] Error scheduling alarm:', error);
    return null;
  }
}

/**
 * Schedule a repeating alarm in a specific calendar
 * For monthly/yearly repeats, this handles calendar-specific date calculations
 * 
 * @param config - Alarm configuration with calendar type
 * @returns Notification ID if successful, null otherwise
 */
export async function scheduleCalendarAlarm(config: AlarmConfig): Promise<string | null> {
  try {
    console.log('[AlarmUtils] Scheduling calendar-aware alarm:', config);
    
    const calendarType = config.calendarType || 'Gregorian';
    const localZone = getLocalTimezone();
    
    // Get the calendar date components
    const calendarDate = utcToCalendarDate(config.utcTimestamp, calendarType, localZone);
    
    if (config.repeat === 'monthly') {
      // For monthly repeats in non-Gregorian calendars, we need special handling
      // Schedule the first occurrence and set up a listener to reschedule
      const notificationId = await scheduleAlarm({
        ...config,
        repeat: 'none'
      });
      
      // Store the alarm config for rescheduling
      // In a real app, you'd save this to AsyncStorage or a database
      console.log('[AlarmUtils] Monthly calendar alarm scheduled. Will need rescheduling after firing.');
      
      return notificationId;
    }
    
    if (config.repeat === 'yearly') {
      // For yearly repeats, calculate the next occurrence in the calendar
      // This is especially important for Hebrew leap years, lunar calendars, etc.
      const notificationId = await scheduleAlarm({
        ...config,
        repeat: 'none'
      });
      
      console.log('[AlarmUtils] Yearly calendar alarm scheduled. Will need rescheduling after firing.');
      
      return notificationId;
    }
    
    // For daily/weekly, standard scheduling works
    return scheduleAlarm(config);
  } catch (error) {
    console.error('[AlarmUtils] Error scheduling calendar alarm:', error);
    return null;
  }
}

/**
 * Cancel an alarm by ID
 * 
 * @param alarmId - Alarm identifier
 */
export async function cancelAlarm(alarmId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(alarmId);
    console.log('[AlarmUtils] Alarm cancelled:', alarmId);
  } catch (error) {
    console.error('[AlarmUtils] Error cancelling alarm:', error);
  }
}

/**
 * Cancel all scheduled alarms
 */
export async function cancelAllAlarms(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[AlarmUtils] All alarms cancelled');
  } catch (error) {
    console.error('[AlarmUtils] Error cancelling all alarms:', error);
  }
}

/**
 * Get all scheduled alarms
 * 
 * @returns Array of scheduled notification requests
 */
export async function getAllScheduledAlarms(): Promise<Notifications.NotificationRequest[]> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log('[AlarmUtils] Scheduled alarms:', scheduled.length);
    return scheduled;
  } catch (error) {
    console.error('[AlarmUtils] Error getting scheduled alarms:', error);
    return [];
  }
}

/**
 * Set up notification listener for handling alarm responses
 * Call this in your app's root component
 * 
 * @param handler - Function to call when notification is received
 * @returns Subscription object (call .remove() to unsubscribe)
 */
export function addNotificationListener(
  handler: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * Set up notification response listener for handling user taps
 * Call this in your app's root component
 * 
 * @param handler - Function to call when user taps notification
 * @returns Subscription object (call .remove() to unsubscribe)
 */
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
