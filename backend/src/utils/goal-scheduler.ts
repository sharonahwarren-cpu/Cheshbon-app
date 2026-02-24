/**
 * Goal scheduler utility functions for computing activations and recurrences
 */

import {
  isHebrewLeapYear,
  getDaysInHebrewMonth,
  calculateSunsetTime,
  calculateSunriseTime,
  isDateInHebrewRange,
  hebrewToGregorian,
  getHebrewDateOccurrences,
} from './calendar.js';

export interface ScheduleConfig {
  calendarType: 'gregorian' | 'hebrew' | 'chinese' | 'islamic';
  recurrenceType: 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'yearly' | 'custom';
  scheduleType?: 'Always Active' | 'Weekly' | 'Fortnightly' | 'Monthly' | 'Yearly' | 'always_active' | 'weekly' | 'fortnightly' | 'monthly' | 'yearly'; // Priority-based schedule type
  startDate?: Date;
  endDate?: Date;
  timezone: string;
  timesPerDay?: Array<{ hour: number; minute: number; conditions?: string }>;
  daysOfWeek?: number[]; // 0-6, Sunday-Saturday
  weekendsOnly?: boolean;
  weekdaysOnly?: boolean;
  fortnightEvenOdd?: 'even' | 'odd';
  monthlyDates?: number[]; // Specific dates (1-31)
  monthlyRange?: { start: number; end: number };
  monthlyRandomCount?: number;
  nthDayOfMonth?: { day: string; nth: number }; // e.g., { day: 'Tuesday', nth: 2 }
  yearlyDates?: Array<{ month: number; day: number }>;
  yearlyRanges?: Array<{ startMonth: number; startDay: number; endMonth: number; endDay: number }>;
  exclusions?: string[]; // ISO date strings to exclude
  location?: { latitude: number; longitude: number }; // For astronomical calculations
}

export interface ActivationTime {
  date: string; // ISO date string (YYYY-MM-DD)
  time: string; // ISO time string (HH:MM)
  utcTimestamp: number; // Milliseconds since epoch
  localTime: string; // Local timezone time
  triggerCondition?: string; // e.g., "after dawn", "before sunset"
}

/**
 * Get next N activations for a goal based on its schedule
 */
export function getNextActivations(
  config: ScheduleConfig,
  startFromDate: Date = new Date(),
  count: number = 10
): ActivationTime[] {
  const activations: ActivationTime[] = [];
  let currentDate = new Date(startFromDate);
  currentDate.setHours(0, 0, 0, 0);

  let iterations = 0;
  const maxIterations = 365 * 2; // Prevent infinite loops

  while (activations.length < count && iterations < maxIterations) {
    iterations++;

    // Check if date is within schedule bounds
    if (config.endDate && currentDate > config.endDate) {
      break;
    }

    if (config.startDate && currentDate < config.startDate) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Check if date is excluded
    const isoDate = currentDate.toISOString().split('T')[0];
    if (config.exclusions?.includes(isoDate)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Check if this date matches the schedule
    if (doesDateMatchSchedule(currentDate, config)) {
      // Generate activations for this date
      const timesForDate = getTimesForDate(currentDate, config);
      for (const timeOfDay of timesForDate) {
        if (activations.length < count) {
          activations.push({
            date: isoDate,
            time: `${String(timeOfDay.hour).padStart(2, '0')}:${String(timeOfDay.minute).padStart(2, '0')}`,
            utcTimestamp: new Date(`${isoDate}T${String(timeOfDay.hour).padStart(2, '0')}:${String(timeOfDay.minute).padStart(2, '0')}:00Z`).getTime(),
            localTime: formatLocalTime(new Date(`${isoDate}T${String(timeOfDay.hour).padStart(2, '0')}:${String(timeOfDay.minute).padStart(2, '0')}:00Z`), config.timezone),
            triggerCondition: timeOfDay.conditions,
          });
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return activations;
}

/**
 * Check if a specific date matches the schedule criteria
 */
export function doesDateMatchSchedule(date: Date, config: ScheduleConfig): boolean {
  // Normalize scheduleType to recurrenceType if provided
  let recurrenceType = config.recurrenceType;

  if (config.scheduleType) {
    const scheduleType = config.scheduleType.toLowerCase();
    if (scheduleType === 'always_active' || scheduleType === 'always active') {
      return true;
    }
    if (scheduleType === 'weekly') {
      recurrenceType = 'weekly';
    } else if (scheduleType === 'fortnightly') {
      recurrenceType = 'fortnightly';
    } else if (scheduleType === 'monthly') {
      recurrenceType = 'monthly';
    } else if (scheduleType === 'yearly') {
      recurrenceType = 'yearly';
    }
  }

  switch (recurrenceType) {
    case 'daily':
      return true;

    case 'weekly':
      const dayOfWeek = date.getDay();

      // For weekly schedules, daysOfWeek should be specified
      // If it's not specified, default to allowing all days (backward compatibility)
      if (config.daysOfWeek && config.daysOfWeek.length > 0) {
        // If daysOfWeek is specified, only allow those days
        if (!config.daysOfWeek.includes(dayOfWeek)) {
          return false;
        }
      } else if (config.weekendsOnly || config.weekdaysOnly) {
        // If no daysOfWeek but weekendsOnly/weekdaysOnly is set, use those
        if (config.weekendsOnly && ![0, 6].includes(dayOfWeek)) {
          return false;
        }
        if (config.weekdaysOnly && [0, 6].includes(dayOfWeek)) {
          return false;
        }
      }
      // If neither daysOfWeek nor weekendsOnly/weekdaysOnly is set, allow all days
      return true;

    case 'fortnightly':
      if (!config.daysOfWeek) return false;
      const dayOfWeek2 = date.getDay();
      if (!config.daysOfWeek.includes(dayOfWeek2)) {
        return false;
      }
      // Check even/odd week
      if (config.startDate) {
        const weeksSinceStart = Math.floor((date.getTime() - config.startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) % 2;
        if (config.fortnightEvenOdd === 'even' && weeksSinceStart !== 0) {
          return false;
        }
        if (config.fortnightEvenOdd === 'odd' && weeksSinceStart !== 1) {
          return false;
        }
      }
      return true;

    case 'monthly':
      const dateOfMonth = date.getDate();
      if (config.monthlyDates && !config.monthlyDates.includes(dateOfMonth)) {
        return false;
      }
      if (config.monthlyRange && (dateOfMonth < config.monthlyRange.start || dateOfMonth > config.monthlyRange.end)) {
        return false;
      }
      if (config.nthDayOfMonth) {
        return isNthDayOfMonth(date, config.nthDayOfMonth.day, config.nthDayOfMonth.nth);
      }
      return true;

    case 'yearly':
      // For Hebrew calendar, compare by month/day
      if (config.calendarType === 'hebrew') {
        if (!config.yearlyDates && !config.yearlyRanges) return true;

        // Check yearly dates
        if (config.yearlyDates) {
          const month = date.getMonth() + 1;
          const day = date.getDate();
          if (config.yearlyDates.some(d => d.month === month && d.day === day)) {
            return true;
          }
        }

        // Check yearly ranges
        if (config.yearlyRanges) {
          return config.yearlyRanges.some(range => {
            const startDate = new Date(date.getFullYear(), range.startMonth - 1, range.startDay);
            const endDate = new Date(date.getFullYear(), range.endMonth - 1, range.endDay);
            return date >= startDate && date <= endDate;
          });
        }
        return false;
      }

      // For Gregorian calendar
      const month = date.getMonth() + 1; // JavaScript months are 0-based
      const day = date.getDate();

      // Check yearly dates (specific month/day combinations)
      if (config.yearlyDates) {
        const hasMatch = config.yearlyDates.some(d => d.month === month && d.day === day);
        if (!hasMatch && !config.yearlyRanges) {
          return false;
        }
      }

      // Check yearly ranges (date ranges within a year)
      if (config.yearlyRanges) {
        return config.yearlyRanges.some(range => {
          // Check if current date is within range
          const currentMonthDay = month * 100 + day;
          const startMonthDay = range.startMonth * 100 + range.startDay;
          const endMonthDay = range.endMonth * 100 + range.endDay;

          if (startMonthDay <= endMonthDay) {
            return currentMonthDay >= startMonthDay && currentMonthDay <= endMonthDay;
          } else {
            // Range wraps around year
            return currentMonthDay >= startMonthDay || currentMonthDay <= endMonthDay;
          }
        });
      }
      return config.yearlyDates ? false : true;

    case 'custom':
      return true;

    default:
      return false;
  }
}

/**
 * Get times of day for a specific date based on schedule
 */
function getTimesForDate(
  date: Date,
  config: ScheduleConfig
): Array<{ hour: number; minute: number; conditions?: string }> {
  if (!config.timesPerDay || config.timesPerDay.length === 0) {
    return [{ hour: 9, minute: 0 }]; // Default to 9 AM
  }

  if (config.recurrenceType === 'monthly' && config.monthlyRandomCount) {
    // For random monthly selection, return a single time per day
    return [config.timesPerDay[0] || { hour: 9, minute: 0 }];
  }

  return config.timesPerDay;
}

/**
 * Check if a date is the Nth occurrence of a specific day in a month
 */
function isNthDayOfMonth(date: Date, dayName: string, nth: number): boolean {
  const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(dayName);
  if (dayIndex === -1) return false;

  const dateOfMonth = date.getDate();
  const dayOfWeek = date.getDay();

  if (dayOfWeek !== dayIndex) return false;

  // Count how many occurrences of this day have happened this month
  const occurrences = Math.ceil(dateOfMonth / 7);
  return occurrences === nth;
}

/**
 * Generate random month days for monthly random selection
 */
export function generateRandomMonthDays(
  month: number,
  year: number,
  count: number,
  config: ScheduleConfig
): number[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const availableDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Shuffle using Fisher-Yates
  for (let i = availableDays.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableDays[i], availableDays[j]] = [availableDays[j], availableDays[i]];
  }

  return availableDays.slice(0, Math.min(count, availableDays.length));
}

/**
 * Format time in a specific timezone
 */
function formatLocalTime(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return formatter.format(date);
  } catch {
    // Fallback if timezone is invalid
    return date.toISOString().split('T')[1].substring(0, 8);
  }
}

/**
 * Calculate astronomical trigger times (sunrise, sunset, dawn)
 */
export function calculateAstronomicalTimes(
  date: Date,
  latitude: number,
  longitude: number,
  timezone: string
): {
  sunrise: string;
  sunset: string;
  dawn: string;
} {
  const sunrise = calculateSunriseTime(date, latitude, longitude, timezone);
  const sunset = calculateSunsetTime(date, latitude, longitude, timezone);

  // Dawn is approximately 1 hour before sunrise
  const dawn = new Date(sunrise.getTime() - 60 * 60 * 1000);

  return {
    sunrise: `${String(sunrise.getHours()).padStart(2, '0')}:${String(sunrise.getMinutes()).padStart(2, '0')}`,
    sunset: `${String(sunset.getHours()).padStart(2, '0')}:${String(sunset.getMinutes()).padStart(2, '0')}`,
    dawn: `${String(dawn.getHours()).padStart(2, '0')}:${String(dawn.getMinutes()).padStart(2, '0')}`,
  };
}

/**
 * Apply offset to a time string (e.g., "10 minutes before sunset")
 */
export function applyTimeOffset(
  baseTime: string, // HH:MM format
  offsetMinutes: number
): string {
  const [hours, minutes] = baseTime.split(':').map(Number);
  let totalMinutes = hours * 60 + minutes + offsetMinutes;

  if (totalMinutes < 0) totalMinutes += 24 * 60;
  if (totalMinutes >= 24 * 60) totalMinutes -= 24 * 60;

  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;

  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
}
