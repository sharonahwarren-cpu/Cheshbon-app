
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import type { Alarm } from '@/types/alarm';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Only configure notification handler if NOT in Expo Go
if (!isExpoGo) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (error) {
    console.warn('Failed to set notification handler (this is expected in Expo Go):', error);
  }
}

/**
 * Check if notifications are supported in the current environment
 */
export function areNotificationsSupported(): boolean {
  if (isExpoGo) {
    console.warn('Push notifications are not supported in Expo Go. Please use a development build.');
    return false;
  }
  return true;
}

/**
 * Schedule a notification for an alarm
 */
export async function scheduleAlarmNotification(
  alarm: Alarm,
  triggerDate: Date
): Promise<string | null> {
  if (!areNotificationsSupported()) {
    console.warn('Cannot schedule notification: Not supported in Expo Go');
    return null;
  }

  console.log('Scheduling alarm notification:', { title: alarm.title, triggerDate });
  
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: alarm.title,
        body: `Alarm: ${alarm.title}`,
        data: { alarmId: alarm.id },
        sound: true,
      },
      trigger: {
        date: triggerDate,
      },
    });
    
    console.log('Notification scheduled with ID:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
}

/**
 * Cancel a scheduled notification
 */
export async function cancelAlarmNotification(notificationId: string): Promise<boolean> {
  if (!areNotificationsSupported()) {
    return false;
  }

  console.log('Canceling notification:', notificationId);
  
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log('Notification canceled successfully');
    return true;
  } catch (error) {
    console.error('Error canceling notification:', error);
    return false;
  }
}

/**
 * Cancel all scheduled notifications for an alarm
 */
export async function cancelAllAlarmNotifications(alarm: Alarm): Promise<boolean> {
  if (!areNotificationsSupported()) {
    return false;
  }

  console.log('Canceling all notifications for alarm:', alarm.title);
  
  try {
    if (alarm.notificationId) {
      await cancelAlarmNotification(alarm.notificationId);
    }
    return true;
  } catch (error) {
    console.error('Error canceling all notifications:', error);
    return false;
  }
}

/**
 * Get all scheduled notifications
 */
export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  if (!areNotificationsSupported()) {
    return [];
  }

  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log('All scheduled notifications:', notifications.length);
    return notifications;
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
}
