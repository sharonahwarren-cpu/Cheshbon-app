/**
 * Schedule summary generation for human-readable goal schedule descriptions
 */

import { HEBREW_MONTHS, ISLAMIC_MONTHS, CHINESE_MONTHS, GREGORIAN_MONTHS, gregorianToHebrew, isHebrewLeapYear } from './calendar.js';
import { getNextActivations, type ScheduleConfig } from './goal-scheduler.js';

export interface ScheduleSummaryRequest {
  scheduleType?: string;
  scheduleRecurrenceType?: string;
  scheduleDaysOfWeek?: number[];
  scheduleDatesOfMonth?: number[];
  scheduleNthDayOfMonth?: { day: string; nth: number };
  scheduleMonthlyRange?: { start: number; end: number };
  scheduleFortnightEvenOdd?: 'even' | 'odd';
  scheduleDatesOfYear?: any[];
  scheduleTimesPerDayDetails?: Array<{ hour: number; minute: number; conditions?: string }>;
  scheduleWeekendsOnly?: boolean;
  scheduleWeekdaysOnly?: boolean;
  calendarType?: string;
  eventType?: string;
  timezone?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ScheduleSummaryResponse {
  summary: string;
  nextOccurrences: string[];
  calendarType?: string;
  recurrenceType?: string;
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDINAL_SUFFIXES = ['st', 'nd', 'rd', 'th'];

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.)
 */
function getOrdinalSuffix(num: number): string {
  const lastDigit = num % 10;
  const lastTwoDigits = num % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return 'th';
  }

  if (lastDigit === 1) return 'st';
  if (lastDigit === 2) return 'nd';
  if (lastDigit === 3) return 'rd';
  return 'th';
}

/**
 * Format a number with ordinal suffix (1st, 2nd, etc.)
 */
function formatOrdinal(num: number): string {
  return `${num}${getOrdinalSuffix(num)}`;
}

/**
 * Convert day number to English day name
 */
function getDayName(dayNum: number): string {
  return WEEKDAY_NAMES[dayNum] || 'Unknown';
}

/**
 * Generate summary for Daily schedules
 */
function summarizeDaily(config: ScheduleSummaryRequest): string {
  if (!config.scheduleTimesPerDayDetails || config.scheduleTimesPerDayDetails.length === 0) {
    return 'Scheduled daily';
  }

  const times = (config.scheduleTimesPerDayDetails as any[]).map(t => {
    const hour = t.hour % 12 || 12;
    const period = t.hour >= 12 ? 'PM' : 'AM';
    return `${hour}:${String(t.minute).padStart(2, '0')} ${period}`;
  });

  if (times.length === 1) {
    return `Scheduled daily at ${times[0]}`;
  }

  return `Scheduled daily at ${times.join(', ')}`;
}

/**
 * Generate summary for Weekly schedules
 */
function summarizeWeekly(config: ScheduleSummaryRequest): string {
  const days = config.scheduleDaysOfWeek || [];

  if (days.length === 0) {
    return 'Scheduled weekly';
  }

  if (config.scheduleWeekendsOnly) {
    return 'Scheduled on weekends (Saturday and Sunday)';
  }

  if (config.scheduleWeekdaysOnly) {
    return 'Scheduled on weekdays (Monday through Friday)';
  }

  if (days.length === 7) {
    return 'Scheduled daily';
  }

  const dayNames = days.map(d => getDayName(d));

  if (days.length === 1) {
    return `Scheduled every ${dayNames[0]}`;
  }

  return `Scheduled every ${dayNames.join(', ')}`;
}

/**
 * Generate summary for Fortnightly schedules
 */
function summarizeFortnightly(config: ScheduleSummaryRequest): string {
  const days = config.scheduleDaysOfWeek || [];
  const weekType = config.scheduleFortnightEvenOdd === 'odd' ? 'odd' : 'even';

  if (days.length === 0) {
    return `Scheduled every ${weekType} week`;
  }

  const dayNames = days.map(d => getDayName(d));
  const weekLabel = weekType === 'odd' ? 'Week 1' : 'Week 2';

  return `Scheduled every ${weekLabel} on ${dayNames.join(', ')}`;
}

/**
 * Generate summary for Monthly schedules
 */
function summarizeMonthly(config: ScheduleSummaryRequest): string {
  const parts: string[] = [];

  // Specific dates
  if (config.scheduleDatesOfMonth && config.scheduleDatesOfMonth.length > 0) {
    const dates = config.scheduleDatesOfMonth.map(d => formatOrdinal(d));
    parts.push(`the ${dates.join(' and ')} of every month`);
  }

  // Nth day of month (e.g., 1st Friday)
  if (config.scheduleNthDayOfMonth) {
    const nthDay = config.scheduleNthDayOfMonth as any;
    const ordinal = formatOrdinal(nthDay.nth);
    parts.push(`the ${ordinal} ${nthDay.day} of every month`);
  }

  // Date range
  if (config.scheduleMonthlyRange && !config.scheduleDatesOfMonth) {
    const range = config.scheduleMonthlyRange as any;
    const startOrdinal = formatOrdinal(range.start);
    const endOrdinal = formatOrdinal(range.end);
    parts.push(`between the ${startOrdinal} and ${endOrdinal} of every month`);
  }

  if (parts.length === 0) {
    return 'Scheduled monthly';
  }

  return `Scheduled on ${parts.join(' and ')}`;
}

/**
 * Generate summary for Yearly schedules
 */
function summarizeYearly(config: ScheduleSummaryRequest): string {
  if (!config.scheduleDatesOfYear || config.scheduleDatesOfYear.length === 0) {
    return 'Scheduled yearly';
  }

  const parts: string[] = [];
  const datesOfYear = config.scheduleDatesOfYear as any[];

  for (const dateRange of datesOfYear) {
    const monthNum = dateRange.month;
    let monthName = '';

    if (config.calendarType === 'hebrew') {
      monthName = HEBREW_MONTHS[monthNum - 1] || `Month ${monthNum}`;
    } else if (config.calendarType === 'islamic') {
      monthName = ISLAMIC_MONTHS[monthNum - 1] || `Month ${monthNum}`;
    } else if (config.calendarType === 'chinese') {
      monthName = CHINESE_MONTHS[monthNum - 1] || `Month ${monthNum}`;
    } else {
      monthName = GREGORIAN_MONTHS[monthNum - 1] || `Month ${monthNum}`;
    }

    if (dateRange.days && dateRange.days.length > 0) {
      const dates = dateRange.days.map((d: number) => formatOrdinal(d));
      parts.push(`${monthName} ${dates.join(' and ')}`);
    } else if (dateRange.start && dateRange.end) {
      const startOrdinal = formatOrdinal(dateRange.start);
      const endOrdinal = formatOrdinal(dateRange.end);
      parts.push(`${monthName} ${startOrdinal}-${endOrdinal}`);
    }
  }

  if (parts.length === 0) {
    return 'Scheduled yearly';
  }

  const calendarLabel = config.calendarType && config.calendarType !== 'gregorian' ? ` (${config.calendarType})` : '';
  return `Scheduled on ${parts.join(', ')} every year${calendarLabel}`;
}

/**
 * Generate summary for Always Active
 */
function summarizeAlwaysActive(): string {
  return 'Always active';
}

/**
 * Generate schedule summary based on configuration
 */
export function generateScheduleSummary(config: ScheduleSummaryRequest): ScheduleSummaryResponse {
  const recurrenceType = config.scheduleRecurrenceType || config.scheduleType || 'Always Active';

  let summary = '';

  switch (recurrenceType.toLowerCase()) {
    case 'daily':
      summary = summarizeDaily(config);
      break;

    case 'weekly':
      summary = summarizeWeekly(config);
      break;

    case 'fortnightly':
      summary = summarizeFortnightly(config);
      break;

    case 'monthly':
      summary = summarizeMonthly(config);
      break;

    case 'yearly':
      summary = summarizeYearly(config);
      break;

    case 'always active':
    case 'alwaysactive':
      summary = summarizeAlwaysActive();
      break;

    default:
      summary = `Scheduled with configuration: ${recurrenceType}`;
  }

  return {
    summary,
    nextOccurrences: [],
    recurrenceType,
    calendarType: config.calendarType,
  };
}

/**
 * Format a date with optional Hebrew calendar equivalent
 */
function formatDateWithCalendar(date: Date, includeHebrew: boolean = false, calendar?: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  let formatted = formatter.format(date);

  if (includeHebrew || calendar === 'hebrew') {
    try {
      const hebrew = gregorianToHebrew(date);
      const hebrewMonth = HEBREW_MONTHS[hebrew.month - 1] || `Month ${hebrew.month}`;
      formatted += ` (${hebrew.day} ${hebrewMonth}, ${hebrew.year})`;
    } catch {
      // Fallback if Hebrew conversion fails
      formatted += ' (Hebrew calendar conversion unavailable)';
    }
  }

  return formatted;
}

/**
 * Generate next occurrences for display
 */
export function getNextOccurrencesForDisplay(
  config: ScheduleSummaryRequest,
  count: number = 3
): string[] {
  try {
    const scheduleConfig: ScheduleConfig = {
      calendarType: (config.calendarType || 'gregorian') as any,
      recurrenceType: (config.scheduleRecurrenceType || config.scheduleType || 'daily') as any,
      startDate: config.startDate,
      endDate: config.endDate,
      timezone: config.timezone || 'UTC',
      daysOfWeek: config.scheduleDaysOfWeek,
      monthlyDates: config.scheduleDatesOfMonth,
      nthDayOfMonth: config.scheduleNthDayOfMonth,
      monthlyRange: config.scheduleMonthlyRange,
      fortnightEvenOdd: config.scheduleFortnightEvenOdd as any,
      yearlyMonths: config.scheduleDatesOfYear ? config.scheduleDatesOfYear.map((r: any) => r.month) : undefined,
      yearlyDatesOrRanges: config.scheduleDatesOfYear,
      weekendsOnly: config.scheduleWeekendsOnly,
      weekdaysOnly: config.scheduleWeekdaysOnly,
    };

    const activations = getNextActivations(scheduleConfig, new Date(), count);

    return activations.map(activation => {
      const date = new Date(`${activation.date}T${activation.time}:00Z`);
      return formatDateWithCalendar(date, false, config.calendarType);
    });
  } catch (error) {
    // Fallback if generation fails
    return ['Next occurrence cannot be calculated'];
  }
}

/**
 * Generate complete schedule summary with next occurrences
 */
export function getScheduleSummaryWithOccurrences(
  config: ScheduleSummaryRequest,
  occurrenceCount: number = 3
): ScheduleSummaryResponse {
  const baseSummary = generateScheduleSummary(config);
  const nextOccurrences = getNextOccurrencesForDisplay(config, occurrenceCount);

  return {
    ...baseSummary,
    nextOccurrences,
  };
}
