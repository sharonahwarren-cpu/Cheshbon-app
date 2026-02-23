
import { DateTime } from 'luxon';
import { RRule, RRuleSet, rrulestr } from 'rrule';
import { HDate, HebrewCalendar, months as hebrewMonths } from '@hebcal/core';
import moment from 'moment-hijri';
import { Lunar, Solar } from 'lunar-javascript';
import { getTimes } from 'suncalc';
import { getLocalTimezone, calendarDateToUTC, utcToCalendarDate } from './dateUtils';

/**
 * GOAL SCHEDULER - COMPLEX RECURRENCE CALCULATIONS
 * 
 * This module handles:
 * - Daily/Weekly/Fortnightly/Monthly/Yearly recurrences
 * - Multi-calendar support (Gregorian/Hebrew/Chinese/Islamic)
 * - Random date selection (e.g., 3 random days per month)
 * - Astronomical triggers (sunrise, sunset, dawn, dusk)
 * - Alarm integration with offsets
 * - Next activation preview generation
 */

export type CalendarType = 'Gregorian' | 'Hebrew' | 'Chinese' | 'Islamic';
export type RecurrenceType = 'always_active' | 'weekly' | 'fortnightly' | 'monthly' | 'yearly' | 'custom';

export interface ScheduleDetails {
  // Common
  startDate?: string; // ISO 8601 UTC
  endDate?: string;   // ISO 8601 UTC
  exclusions?: string[]; // Array of ISO date strings UTC

  // Daily
  timesPerDay?: number;
  specificTimes?: Array<{ hour: number; minute: number; conditions?: string[] }>; // e.g., 'after dawn'

  // Weekly
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  weekendsOnly?: boolean;
  weekdaysOnly?: boolean;

  // Fortnightly
  evenOddWeeks?: 'even' | 'odd';
  fortnightDays?: number[]; // 0-13 for 2 weeks

  // Monthly
  dates?: number[]; // [1, 26]
  nthDay?: Array<{ day: string; nth: number }>; // e.g., {day: 'Tuesday', nth: 2}
  range?: { start: number; end: number };
  randomCount?: number; // e.g., 3; shuffle/select

  // Yearly
  months?: number[]; // 1-12 (Gregorian) or specific Hebrew/Chinese/Islamic month indices
  datesOrRanges?: Array<{ month: number; days?: number[]; start?: number; end?: number }>;
}

export interface GoalSchedule {
  calendarType: CalendarType;
  recurrenceType: RecurrenceType;
  details: ScheduleDetails;
}

export interface AlarmTrigger {
  type: 'time' | 'astronomical' | 'location';
  value?: string; // e.g., "06:00", "sunset", "enterHome"
  offsetMinutes?: number; // e.g., -10 for "10 minutes before"
  min?: string; // e.g., "06:00" for "not before 6am"
  max?: string; // e.g., "22:00" for "not after 10pm"
}

export interface GoalAlarm {
  id: string;
  triggers: AlarmTrigger[];
}

export interface ActivationPreview {
  date: string; // ISO 8601 UTC
  localTime: string; // Formatted local time
  calendarDate: string; // Formatted in the goal's calendar
  alarmTime?: string; // If alarm is set, formatted alarm time
  description: string; // Human-readable description
}

/**
 * Check if a Hebrew year is a leap year
 */
function isHebrewLeapYear(hebrewYear: number): boolean {
  const yearInCycle = hebrewYear % 19;
  return [3, 6, 8, 11, 14, 17, 0].includes(yearInCycle);
}

/**
 * Get the next N activation dates for a goal
 * 
 * @param schedule - Goal schedule configuration
 * @param alarms - Optional alarms to calculate trigger times
 * @param count - Number of activations to generate (default: 10)
 * @param location - Optional location for astronomical calculations
 * @returns Array of activation previews
 */
export async function getNextActivations(
  schedule: GoalSchedule,
  alarms?: GoalAlarm[],
  count: number = 10,
  location?: { latitude: number; longitude: number }
): Promise<ActivationPreview[]> {
  console.log('[ScheduleCalc] Generating next activations:', {
    calendarType: schedule.calendarType,
    recurrenceType: schedule.recurrenceType,
    count,
  });

  const timezone = getLocalTimezone();
  const now = DateTime.now().setZone(timezone);
  const activations: ActivationPreview[] = [];

  try {
    if (schedule.recurrenceType === 'always_active') {
      // Always active: generate next N days
      const activations: ActivationPreview[] = [];
      let currentDate = now.startOf('day').plus({ days: 1 });
      for (let i = 0; i < count; i++) {
        const activation = currentDate.set({ hour: 9, minute: 0 });
        activations.push(createActivationPreview(activation, schedule, alarms, location));
        currentDate = currentDate.plus({ days: 1 });
      }
      return activations;
    }

    if (schedule.recurrenceType === 'weekly') {
      return generateWeeklyActivations(schedule, now, count, timezone, alarms, location);
    }

    if (schedule.recurrenceType === 'fortnightly') {
      return generateFortnightlyActivations(schedule, now, count, timezone, alarms, location);
    }

    if (schedule.recurrenceType === 'monthly') {
      return generateMonthlyActivations(schedule, now, count, timezone, alarms, location);
    }

    if (schedule.recurrenceType === 'yearly') {
      return generateYearlyActivations(schedule, now, count, timezone, alarms, location);
    }

    console.warn('[ScheduleCalc] Unsupported recurrence type:', schedule.recurrenceType);
    return [];
  } catch (error) {
    console.error('[ScheduleCalc] Error generating activations:', error);
    return [];
  }
}

/**
 * Generate weekly activations
 */
function generateWeeklyActivations(
  schedule: GoalSchedule,
  now: DateTime,
  count: number,
  timezone: string,
  alarms?: GoalAlarm[],
  location?: { latitude: number; longitude: number }
): ActivationPreview[] {
  const activations: ActivationPreview[] = [];
  const { daysOfWeek, startDate, endDate } = schedule.details;

  if (!daysOfWeek || daysOfWeek.length === 0) {
    console.warn('[ScheduleCalc] No days of week specified for weekly schedule');
    return [];
  }

  const start = startDate ? DateTime.fromISO(startDate, { zone: 'UTC' }).setZone(timezone) : now;
  const end = endDate ? DateTime.fromISO(endDate, { zone: 'UTC' }).setZone(timezone) : now.plus({ years: 1 });

  let currentDate = start.startOf('day');
  if (currentDate < now.startOf('day')) {
    currentDate = now.startOf('day');
  }

  while (activations.length < count && currentDate <= end) {
    const weekday = currentDate.weekday % 7; // Convert to 0-6 (Sunday-Saturday)
    if (daysOfWeek.includes(weekday)) {
      const activation = currentDate.set({ hour: 9, minute: 0 });
      if (activation > now) {
        activations.push(createActivationPreview(activation, schedule, alarms, location));
      }
    }
    currentDate = currentDate.plus({ days: 1 });
  }

  return activations;
}

/**
 * Generate fortnightly activations
 */
function generateFortnightlyActivations(
  schedule: GoalSchedule,
  now: DateTime,
  count: number,
  timezone: string,
  alarms?: GoalAlarm[],
  location?: { latitude: number; longitude: number }
): ActivationPreview[] {
  const activations: ActivationPreview[] = [];
  const { fortnightDays, startDate, endDate } = schedule.details;

  if (!fortnightDays || fortnightDays.length === 0) {
    console.warn('[ScheduleCalc] No fortnight days specified');
    return [];
  }

  const start = startDate ? DateTime.fromISO(startDate, { zone: 'UTC' }).setZone(timezone) : now;
  const end = endDate ? DateTime.fromISO(endDate, { zone: 'UTC' }).setZone(timezone) : now.plus({ years: 1 });

  let currentDate = start.startOf('day');
  if (currentDate < now.startOf('day')) {
    currentDate = now.startOf('day');
  }

  // Calculate which week we're in (0 or 1) relative to start date
  const daysSinceStart = Math.floor(currentDate.diff(start, 'days').days);
  const fortnightCycle = Math.floor(daysSinceStart / 14);
  let fortnightStart = start.plus({ days: fortnightCycle * 14 });

  while (activations.length < count && fortnightStart <= end) {
    for (const dayIndex of fortnightDays) {
      const activation = fortnightStart.plus({ days: dayIndex }).set({ hour: 9, minute: 0 });
      if (activation > now && activation <= end) {
        activations.push(createActivationPreview(activation, schedule, alarms, location));
        if (activations.length >= count) break;
      }
    }
    fortnightStart = fortnightStart.plus({ days: 14 });
  }

  return activations.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Generate monthly activations
 */
function generateMonthlyActivations(
  schedule: GoalSchedule,
  now: DateTime,
  count: number,
  timezone: string,
  alarms?: GoalAlarm[],
  location?: { latitude: number; longitude: number }
): ActivationPreview[] {
  const activations: ActivationPreview[] = [];
  const { dates, nthDay, range, randomCount, startDate, endDate } = schedule.details;

  const start = startDate ? DateTime.fromISO(startDate, { zone: 'UTC' }).setZone(timezone) : now;
  const end = endDate ? DateTime.fromISO(endDate, { zone: 'UTC' }).setZone(timezone) : now.plus({ years: 1 });

  let currentMonth = start.startOf('month');
  if (currentMonth < now.startOf('month')) {
    currentMonth = now.startOf('month');
  }

  while (activations.length < count && currentMonth <= end) {
    if (dates && dates.length > 0) {
      // Specific dates
      for (const date of dates) {
        const activation = currentMonth.set({ day: date, hour: 9, minute: 0 });
        if (activation > now && activation <= end) {
          activations.push(createActivationPreview(activation, schedule, alarms, location));
          if (activations.length >= count) break;
        }
      }
    } else if (nthDay && nthDay.length > 0) {
      // Nth weekday rules (e.g., "Second Tuesday")
      for (const rule of nthDay) {
        const activation = getNthWeekdayOfMonth(currentMonth, rule.day, rule.nth);
        if (activation && activation > now && activation <= end) {
          activations.push(createActivationPreview(activation, schedule, alarms, location));
          if (activations.length >= count) break;
        }
      }
    } else if (range) {
      // Date range
      for (let day = range.start; day <= range.end; day++) {
        const activation = currentMonth.set({ day, hour: 9, minute: 0 });
        if (activation > now && activation <= end) {
          activations.push(createActivationPreview(activation, schedule, alarms, location));
          if (activations.length >= count) break;
        }
      }
    } else if (randomCount && randomCount > 0) {
      // Random selection
      const daysInMonth = currentMonth.daysInMonth || 31;
      const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      const shuffled = allDays.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, randomCount);

      for (const day of selected.sort((a, b) => a - b)) {
        const activation = currentMonth.set({ day, hour: 9, minute: 0 });
        if (activation > now && activation <= end) {
          activations.push(createActivationPreview(activation, schedule, alarms, location));
          if (activations.length >= count) break;
        }
      }
    }

    currentMonth = currentMonth.plus({ months: 1 });
  }

  return activations;
}

/**
 * Generate yearly activations
 */
function generateYearlyActivations(
  schedule: GoalSchedule,
  now: DateTime,
  count: number,
  timezone: string,
  alarms?: GoalAlarm[],
  location?: { latitude: number; longitude: number }
): ActivationPreview[] {
  const activations: ActivationPreview[] = [];
  const { datesOrRanges, startDate, endDate } = schedule.details;

  if (!datesOrRanges || datesOrRanges.length === 0) {
    console.warn('[ScheduleCalc] No dates or ranges specified for yearly schedule');
    return [];
  }

  const start = startDate ? DateTime.fromISO(startDate, { zone: 'UTC' }).setZone(timezone) : now;
  const end = endDate ? DateTime.fromISO(endDate, { zone: 'UTC' }).setZone(timezone) : now.plus({ years: 10 });

  let currentYear = start.year;
  if (start < now) {
    currentYear = now.year;
  }

  while (activations.length < count && currentYear <= end.year) {
    for (const dateRange of datesOrRanges) {
      if (dateRange.days && dateRange.days.length > 0) {
        // Specific days in a month
        for (const day of dateRange.days) {
          const activation = DateTime.fromObject(
            { year: currentYear, month: dateRange.month, day, hour: 9, minute: 0 },
            { zone: timezone }
          );
          if (activation.isValid && activation > now && activation <= end) {
            activations.push(createActivationPreview(activation, schedule, alarms, location));
            if (activations.length >= count) break;
          }
        }
      } else if (dateRange.start && dateRange.end) {
        // Date range within a month (or across months)
        const startMonth = dateRange.month;
        const endMonth = dateRange.month; // For now, assume same month
        for (let day = dateRange.start; day <= dateRange.end; day++) {
          const activation = DateTime.fromObject(
            { year: currentYear, month: startMonth, day, hour: 9, minute: 0 },
            { zone: timezone }
          );
          if (activation.isValid && activation > now && activation <= end) {
            activations.push(createActivationPreview(activation, schedule, alarms, location));
            if (activations.length >= count) break;
          }
        }
      }
      if (activations.length >= count) break;
    }
    currentYear++;
  }

  return activations;
}

/**
 * Get the Nth occurrence of a weekday in a month
 * E.g., "Second Tuesday" of the month
 */
function getNthWeekdayOfMonth(
  month: DateTime,
  weekdayName: string,
  nth: number
): DateTime | null {
  const weekdayMap: Record<string, number> = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6,
  };

  const targetWeekday = weekdayMap[weekdayName];
  if (targetWeekday === undefined) {
    console.warn('[ScheduleCalc] Invalid weekday name:', weekdayName);
    return null;
  }

  let currentDate = month.startOf('month');
  let occurrenceCount = 0;

  while (currentDate.month === month.month) {
    const weekday = currentDate.weekday % 7;
    if (weekday === targetWeekday) {
      occurrenceCount++;
      if (occurrenceCount === nth) {
        return currentDate.set({ hour: 9, minute: 0 });
      }
    }
    currentDate = currentDate.plus({ days: 1 });
  }

  return null;
}

/**
 * Create an activation preview with alarm time calculation
 */
function createActivationPreview(
  activation: DateTime,
  schedule: GoalSchedule,
  alarms?: GoalAlarm[],
  location?: { latitude: number; longitude: number }
): ActivationPreview {
  const timezone = getLocalTimezone();
  const utcMillis = activation.toUTC().toMillis();
  const calendarDate = utcToCalendarDate(utcMillis, schedule.calendarType, timezone);

  let alarmTime: string | undefined;
  let description = activation.toFormat('EEEE, MMMM d, yyyy h:mm a');

  if (alarms && alarms.length > 0 && location) {
    // Calculate alarm time based on first alarm's triggers
    const alarm = alarms[0];
    const trigger = alarm.triggers[0];

    if (trigger.type === 'astronomical' && trigger.value) {
      try {
        const jsDate = activation.toJSDate();
        const times = getTimes(jsDate, location.latitude, location.longitude);
        const astroTime = times[trigger.value as keyof typeof times] as Date;

        if (astroTime) {
          let alarmDt = DateTime.fromJSDate(astroTime, { zone: timezone });
          if (trigger.offsetMinutes) {
            alarmDt = alarmDt.plus({ minutes: trigger.offsetMinutes });
          }
          alarmTime = alarmDt.toFormat('h:mm a');
          description = `${activation.toFormat('EEEE, MMMM d, yyyy')} at ${alarmTime} (${Math.abs(trigger.offsetMinutes || 0)}min ${(trigger.offsetMinutes || 0) < 0 ? 'before' : 'after'} ${trigger.value})`;
        }
      } catch (error) {
        console.error('[ScheduleCalc] Error calculating astronomical time:', error);
      }
    } else if (trigger.type === 'time' && trigger.value) {
      alarmTime = trigger.value;
      description = `${activation.toFormat('EEEE, MMMM d, yyyy')} at ${alarmTime}`;
    }
  }

  return {
    date: activation.toUTC().toISO() || '',
    localTime: activation.toFormat('EEEE, MMMM d, yyyy h:mm a'),
    calendarDate: calendarDate.formatted,
    alarmTime,
    description,
  };
}

/**
 * Check if a goal is active on a specific date
 */
export function isGoalActiveOnDate(
  schedule: GoalSchedule,
  dateUtc: string
): boolean {
  const timezone = getLocalTimezone();
  const checkDate = DateTime.fromISO(dateUtc, { zone: 'UTC' }).setZone(timezone);
  const { startDate, endDate, exclusions } = schedule.details;

  // Check if date is within start/end range
  if (startDate) {
    const start = DateTime.fromISO(startDate, { zone: 'UTC' }).setZone(timezone);
    if (checkDate < start.startOf('day')) return false;
  }

  if (endDate) {
    const end = DateTime.fromISO(endDate, { zone: 'UTC' }).setZone(timezone);
    if (checkDate > end.endOf('day')) return false;
  }

  // Check exclusions
  if (exclusions && exclusions.length > 0) {
    const checkDateStr = checkDate.toISODate();
    if (exclusions.some(ex => DateTime.fromISO(ex, { zone: 'UTC' }).setZone(timezone).toISODate() === checkDateStr)) {
      return false;
    }
  }

  // Check recurrence rules
  if (schedule.recurrenceType === 'always_active') {
    return true; // Active every day within range
  }

  if (schedule.recurrenceType === 'weekly') {
    const weekday = checkDate.weekday % 7;
    return schedule.details.daysOfWeek?.includes(weekday) || false;
  }

  if (schedule.recurrenceType === 'fortnightly') {
    // Calculate fortnight cycle
    if (!schedule.details.startDate) return false;
    const start = DateTime.fromISO(schedule.details.startDate, { zone: 'UTC' }).setZone(timezone);
    const daysSinceStart = Math.floor(checkDate.diff(start, 'days').days);
    const dayInFortnight = daysSinceStart % 14;
    return schedule.details.fortnightDays?.includes(dayInFortnight) || false;
  }

  if (schedule.recurrenceType === 'monthly') {
    const day = checkDate.day;
    if (schedule.details.dates?.includes(day)) return true;
    if (schedule.details.range && day >= schedule.details.range.start && day <= schedule.details.range.end) return true;
    // TODO: Check nthDay rules
    return false;
  }

  if (schedule.recurrenceType === 'yearly') {
    const month = checkDate.month;
    const day = checkDate.day;
    return schedule.details.datesOrRanges?.some(dr => {
      if (dr.month !== month) return false;
      if (dr.days?.includes(day)) return true;
      if (dr.start && dr.end && day >= dr.start && day <= dr.end) return true;
      return false;
    }) || false;
  }

  return false;
}
