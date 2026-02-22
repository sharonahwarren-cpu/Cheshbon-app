
import * as Notifications from 'expo-notifications';
import type { Alarm } from '@/types/alarm';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Schedule a notification for an alarm
 */
export async function scheduleAlarmNotification(
  alarm: Alarm,
  triggerDate: Date
): Promise<string | null> {
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
  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log('All scheduled notifications:', notifications.length);
    return notifications;
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
}
