/**
 * Alarm execution logic that evaluates whether an alarm should trigger
 * based on goal schedules and trigger conditions
 */

import { doesDateMatchSchedule, type ScheduleConfig } from './goal-scheduler.js';

export interface AlarmTriggerContext {
  alarmId: string;
  alarmTitle: string;
  goalId?: string;
  triggers: any[];
  checkDate: Date;
  timezone: string;
  calendarType?: string;
  location?: { latitude: number; longitude: number; radius: number };
}

export interface AlarmEvaluationResult {
  shouldTrigger: boolean;
  reason: string;
  nextTriggerTime?: Date;
}

/**
 * Evaluate if an alarm should trigger based on all conditions
 */
export function evaluateAlarmTrigger(
  context: AlarmTriggerContext,
  goalScheduleConfig?: ScheduleConfig
): AlarmEvaluationResult {
  // If alarm has a goalId and schedule config, check if goal is active on this date
  if (context.goalId && goalScheduleConfig) {
    const isGoalActive = doesDateMatchSchedule(context.checkDate, goalScheduleConfig);
    if (!isGoalActive) {
      return {
        shouldTrigger: false,
        reason: `Goal is not scheduled for ${context.checkDate.toDateString()}`,
      };
    }
  }

  // Check individual triggers
  const triggerResults = context.triggers.map(trigger => evaluateTrigger(trigger, context));

  // Check trigger logic (AND vs OR)
  const hasAndLogic = context.triggers.some(t => t.logic === 'AND');
  const hasOrLogic = context.triggers.some(t => t.logic === 'OR');

  let shouldTrigger = false;

  if (!hasAndLogic && !hasOrLogic) {
    // Default: all triggers must pass (AND logic)
    shouldTrigger = triggerResults.every(result => result.shouldTrigger);
  } else if (hasOrLogic && !hasAndLogic) {
    // At least one trigger must pass
    shouldTrigger = triggerResults.some(result => result.shouldTrigger);
  } else {
    // Mixed logic: apply AND by default, OR overrides AND
    // Group triggers by logic type
    const andTriggers = context.triggers.filter(t => t.logic !== 'OR');
    const orTriggers = context.triggers.filter(t => t.logic === 'OR');

    const andResults = triggerResults.filter((_, i) => context.triggers[i].logic !== 'OR');
    const orResults = triggerResults.filter((_, i) => context.triggers[i].logic === 'OR');

    const andPass = andResults.every(result => result.shouldTrigger);
    const orPass = orResults.length === 0 || orResults.some(result => result.shouldTrigger);

    shouldTrigger = andPass && orPass;
  }

  return {
    shouldTrigger,
    reason: shouldTrigger ? 'All trigger conditions met' : 'Trigger conditions not met',
  };
}

/**
 * Evaluate a single trigger condition
 */
function evaluateTrigger(
  trigger: any,
  context: AlarmTriggerContext
): { shouldTrigger: boolean; reason: string } {
  switch (trigger.type) {
    case 'time':
      return evaluateTimeTrigger(trigger, context);

    case 'astronomical':
      return evaluateAstronomicalTrigger(trigger, context);

    case 'location':
      return evaluateLocationTrigger(trigger, context);

    default:
      return { shouldTrigger: false, reason: `Unknown trigger type: ${trigger.type}` };
  }
}

/**
 * Evaluate time-based trigger (specific hour/minute)
 */
function evaluateTimeTrigger(
  trigger: any,
  context: AlarmTriggerContext
): { shouldTrigger: boolean; reason: string } {
  if (!trigger.time) {
    return { shouldTrigger: false, reason: 'Time trigger missing time value' };
  }

  try {
    // Parse time in 12-hour AM/PM format
    const timeRegex = /^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/i;
    const match = trigger.time.match(timeRegex);

    if (!match) {
      return { shouldTrigger: false, reason: `Invalid time format: ${trigger.time}` };
    }

    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    // Convert to 24-hour format
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    // Get current time in the alarm's timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: context.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const timeParts = formatter.formatToParts(now);
    const currentHour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0', 10);
    const currentMinute = parseInt(timeParts.find(p => p.type === 'minute')?.value || '0', 10);

    // Check if current time matches the trigger time
    const matches = currentHour === hour && currentMinute === minute;

    return {
      shouldTrigger: matches,
      reason: matches ? `Time matches ${trigger.time}` : `Time does not match ${trigger.time}`,
    };
  } catch (error) {
    return { shouldTrigger: false, reason: `Error evaluating time trigger: ${(error as Error).message}` };
  }
}

/**
 * Evaluate astronomical trigger (sunrise, sunset, dawn)
 */
function evaluateAstronomicalTrigger(
  trigger: any,
  context: AlarmTriggerContext
): { shouldTrigger: boolean; reason: string } {
  if (!trigger.value) {
    return { shouldTrigger: false, reason: 'Astronomical trigger missing value' };
  }

  if (!context.location) {
    return { shouldTrigger: false, reason: 'Location required for astronomical trigger' };
  }

  try {
    // Simplified: In production, use suncalc library
    // For now, return a placeholder
    return {
      shouldTrigger: false,
      reason: `Astronomical trigger (${trigger.value}) requires location data and calculation engine`,
    };
  } catch (error) {
    return { shouldTrigger: false, reason: `Error evaluating astronomical trigger: ${(error as Error).message}` };
  }
}

/**
 * Evaluate location-based trigger (geofencing)
 */
function evaluateLocationTrigger(
  trigger: any,
  context: AlarmTriggerContext
): { shouldTrigger: boolean; reason: string } {
  if (!trigger.mode) {
    return { shouldTrigger: false, reason: 'Location trigger missing mode' };
  }

  // Modes: enterHome, exitHome, specificLocation
  // In production, this would integrate with device location services

  return {
    shouldTrigger: false,
    reason: `Location trigger (${trigger.mode}) requires device location services`,
  };
}

/**
 * Calculate next trigger time for an alarm
 */
export function calculateNextTriggerTime(
  alarm: any,
  goalScheduleConfig?: any
): Date | null {
  // Find the next time-based trigger
  const timeTriggers = alarm.triggers?.filter((t: any) => t.type === 'time') || [];

  if (timeTriggers.length === 0) {
    return null;
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + 1); // Next occurrence
  nextDate.setHours(0, 0, 0, 0);

  // Get first time trigger
  const firstTrigger = timeTriggers[0];
  if (!firstTrigger.time) return null;

  // Parse time
  const timeRegex = /^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/i;
  const match = firstTrigger.time.match(timeRegex);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;

  nextDate.setHours(hour, minute, 0, 0);
  return nextDate;
}

/**
 * Check if an alarm should still be active (based on recurring and dates)
 */
export function isAlarmActive(alarm: any): boolean {
  if (!alarm.enabled) {
    return false;
  }

  // If not recurring, alarm is always active (until manually disabled)
  if (!alarm.recurring) {
    return true;
  }

  // For recurring alarms, check if within valid date range
  if (alarm.startDate && new Date() < new Date(alarm.startDate)) {
    return false;
  }

  if (alarm.endDate && new Date() > new Date(alarm.endDate)) {
    return false;
  }

  return true;
}
