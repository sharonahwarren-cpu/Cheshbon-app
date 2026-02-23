
// Alarm system types
export type TriggerType = 'time' | 'astronomical' | 'location';
export type TriggerLogic = 'AND' | 'OR';
export type CalendarType = 'gregorian' | 'hebrew' | 'chinese' | 'islamic';
export type AstronomicalEvent = 'sunrise' | 'sunset' | 'dawn' | 'dusk' | 'solarNoon' | 'goldenHour';

export interface AlarmTrigger {
  type: TriggerType;
  value?: string; // e.g., "06:00", "sunset", "enterHome"
  notBefore?: string; // e.g., "06:00" for "not before 6am" (replaces min)
  notAfter?: string; // e.g., "22:00" for "not after 10pm" (replaces max)
  logic?: TriggerLogic; // For combining multiple triggers
  radius?: number; // For location triggers, radius in km
}

export interface AlarmLocation {
  latitude: number;
  longitude: number;
  radius?: number; // For geofencing, e.g., 100m
}

export interface SecondaryAlarm {
  id?: string;
  title: string;
  offsetMinutes: number; // Negative = before, Positive = after
  enabled: boolean;
}

export interface Alarm {
  id: string;
  title: string;
  calendarType?: CalendarType; // For events like Rosh Chodesh
  eventType?: string; // e.g., "roshChodesh"
  triggers: AlarmTrigger[];
  recurring: boolean;
  location?: AlarmLocation;
  timezone: string; // Device local, with overrides
  nextTriggerTimeUtc?: number; // UTC timestamp of the next calculated trigger
  notificationId?: string; // ID of the scheduled Expo Notification
  enabled: boolean;
  secondaryAlarms?: SecondaryAlarm[]; // Additional alarms based on primary
  allowSnooze?: boolean; // Allow snooze when alarm goes off
  snoozeDuration?: number; // Snooze duration in minutes
  createdAt: string;
  updatedAt: string;
}

export interface UserLocationPreferences {
  homeLocation?: AlarmLocation;
  defaultLatitude?: number;
  defaultLongitude?: number;
}
