/**
 * Schedule summary generation for human-readable goal schedule descriptions
 */

import { HEBREW_MONTHS, ISLAMIC_MONTHS, CHINESE_MONTHS, GREGORIAN_MONTHS, gregorianToHebrew, hebrewToGregorian, isHebrewLeapYear, getHebrewDateOccurrences } from './calendar.js';
import { getNextActivations, type ScheduleConfig } from './goal-scheduler.js';
import { getHebrewDate, isHebrewEventMatch, getHebrewCalendarEventDates } from './hebrew-calendar.js';

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
  monthlyUseAlternativeCalendar?: boolean;
  monthlyCalendarType?: string;
  monthlyCalendarEvent?: string;
  eventType?: string;
  timezone?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface OccurrenceSource {
  section: string;  // e.g., "Monthly - Selected Dates", "Weekly", "Daily"
  details: string;  // e.g., "15th of month", "Tuesday", "1st Friday"
}

export interface NextOccurrence {
  date: string;  // Formatted date string with optional calendar equivalent
  source: OccurrenceSource;
}

export interface ScheduleSummaryResponse {
  summary: string;
  nextOccurrences: NextOccurrence[];
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
  // Filter out invalid day values (must be 0-6, not null/undefined)
  const days = (config.scheduleDaysOfWeek || []).filter(
    (day): day is number => day !== null && day !== undefined && day >= 0 && day <= 6
  );

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

  // Map to day names and filter out 'Unknown' entries
  const dayNames = days
    .map(d => getDayName(d))
    .filter(name => name !== 'Unknown');

  // If no valid day names remain, return error message
  if (dayNames.length === 0) {
    return 'Scheduled weekly (no valid days)';
  }

  if (dayNames.length === 1) {
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
  // Check if using Hebrew calendar
  const isHebrewCalendar = config.monthlyUseAlternativeCalendar && config.monthlyCalendarType === 'hebrew';

  // Hebrew calendar event - return immediately with just the event name
  if (isHebrewCalendar && config.monthlyCalendarEvent) {
    return `Scheduled on ${config.monthlyCalendarEvent}`;
  }

  const parts: string[] = [];

  // Hebrew calendar specific dates
  if (isHebrewCalendar && config.scheduleDatesOfMonth && config.scheduleDatesOfMonth.length > 0) {
    const dates = config.scheduleDatesOfMonth.map(d => formatOrdinal(d));
    parts.push(`the ${dates.join(' and ')} of every Hebrew month`);
  }
  // Gregorian calendar specific dates
  else if (config.scheduleDatesOfMonth && config.scheduleDatesOfMonth.length > 0) {
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
    const calendarLabel = isHebrewCalendar ? ' Hebrew' : '';
    parts.push(`between the ${startOrdinal} and ${endOrdinal} of every${calendarLabel} month`);
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

    // Support new format with month/day/endMonth/endDay for multi-month ranges
    if ((dateRange as any).day !== undefined && (dateRange as any).endMonth !== undefined) {
      const startMonth = dateRange.month;
      const startDay = (dateRange as any).day;
      const endMonth = (dateRange as any).endMonth || startMonth;
      const endDay = (dateRange as any).endDay || startDay;

      let startMonthName = '';
      let endMonthName = '';

      if (config.calendarType === 'hebrew') {
        startMonthName = HEBREW_MONTHS[startMonth - 1] || `Month ${startMonth}`;
        endMonthName = HEBREW_MONTHS[endMonth - 1] || `Month ${endMonth}`;
      } else if (config.calendarType === 'islamic') {
        startMonthName = ISLAMIC_MONTHS[startMonth - 1] || `Month ${startMonth}`;
        endMonthName = ISLAMIC_MONTHS[endMonth - 1] || `Month ${endMonth}`;
      } else if (config.calendarType === 'chinese') {
        startMonthName = CHINESE_MONTHS[startMonth - 1] || `Month ${startMonth}`;
        endMonthName = CHINESE_MONTHS[endMonth - 1] || `Month ${endMonth}`;
      } else {
        startMonthName = GREGORIAN_MONTHS[startMonth - 1] || `Month ${startMonth}`;
        endMonthName = GREGORIAN_MONTHS[endMonth - 1] || `Month ${endMonth}`;
      }

      if (startMonth === endMonth) {
        const startOrdinal = formatOrdinal(startDay);
        const endOrdinal = formatOrdinal(endDay);
        parts.push(`${startMonthName} ${startOrdinal}-${endOrdinal}`);
      } else {
        const startOrdinal = formatOrdinal(startDay);
        const endOrdinal = formatOrdinal(endDay);
        parts.push(`${startMonthName} ${startOrdinal} - ${endMonthName} ${endOrdinal}`);
      }
    } else if ((dateRange as any).days && (dateRange as any).days.length > 0) {
      // Support old format with specific days in a month
      const dates = (dateRange as any).days.map((d: number) => formatOrdinal(d));
      parts.push(`${monthName} ${dates.join(' and ')}`);
    } else if ((dateRange as any).start && (dateRange as any).end) {
      // Support old format with range within a month
      const startOrdinal = formatOrdinal((dateRange as any).start);
      const endOrdinal = formatOrdinal((dateRange as any).end);
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
 * Determine the source section for a given date based on schedule configuration
 */
function determineOccurrenceSource(
  date: Date,
  config: ScheduleSummaryRequest
): OccurrenceSource {
  const recurrenceType = config.scheduleRecurrenceType || config.scheduleType || 'daily';
  const dayOfMonth = date.getDate();
  const dayOfWeek = date.getDay();

  switch (recurrenceType.toLowerCase()) {
    case 'daily':
      return {
        section: 'Daily',
        details: 'Every day',
      };

    case 'weekly':
      if (config.scheduleWeekendsOnly) {
        return {
          section: 'Weekly',
          details: 'Weekends',
        };
      }
      if (config.scheduleWeekdaysOnly) {
        return {
          section: 'Weekly',
          details: 'Weekdays',
        };
      }
      const dayName = getDayName(dayOfWeek);
      return {
        section: 'Weekly',
        details: dayName,
      };

    case 'fortnightly':
      const weekNumber = Math.ceil(dayOfMonth / 7);
      const isEvenWeek = (Math.floor((date.getTime() - (config.startDate?.getTime() || 0)) / (7 * 24 * 60 * 60 * 1000)) % 2) === 1;
      const weekLabel = isEvenWeek ? 'Week 2' : 'Week 1';
      const fortDayName = getDayName(dayOfWeek);
      return {
        section: 'Fortnightly',
        details: `${weekLabel} - ${fortDayName}`,
      };

    case 'monthly':
      // Check if it's a Hebrew calendar event
      const isHebrewCalendar = config.monthlyUseAlternativeCalendar && config.monthlyCalendarType === 'hebrew';

      if (isHebrewCalendar && config.monthlyCalendarEvent) {
        // Verify this date actually matches the Hebrew calendar event using exact matching
        if (isHebrewEventMatch(date, config.monthlyCalendarEvent)) {
          return {
            section: 'Monthly - Hebrew Calendar Event',
            details: config.monthlyCalendarEvent,
          };
        }
      }

      // Check if it's a Hebrew calendar selected date
      if (isHebrewCalendar && config.scheduleDatesOfMonth) {
        const hebrewDate = getHebrewDate(date);
        if (config.scheduleDatesOfMonth.includes(hebrewDate.day)) {
          return {
            section: 'Monthly - Hebrew Calendar Selected Dates',
            details: `${formatOrdinal(hebrewDate.day)} of Hebrew month`,
          };
        }
      }

      // Check if it's a selected date (Gregorian)
      if (config.scheduleDatesOfMonth?.includes(dayOfMonth)) {
        return {
          section: 'Monthly - Selected Dates',
          details: `${formatOrdinal(dayOfMonth)} of month`,
        };
      }

      // Check if it's a weekday position
      if (config.scheduleNthDayOfMonth) {
        const nthDay = config.scheduleNthDayOfMonth as any;
        if (getDayName(dayOfWeek) === nthDay.day) {
          return {
            section: 'Monthly - Weekday Position',
            details: `${formatOrdinal(nthDay.nth)} ${nthDay.day}`,
          };
        }
      }

      // Check if it's in a date range
      if (config.scheduleMonthlyRange) {
        const range = config.scheduleMonthlyRange as any;
        if (dayOfMonth >= range.start && dayOfMonth <= range.end) {
          return {
            section: 'Monthly - Date Range',
            details: `${formatOrdinal(range.start)}-${formatOrdinal(range.end)} of month`,
          };
        }
      }

      // Default monthly
      return {
        section: 'Monthly',
        details: `${formatOrdinal(dayOfMonth)} of month`,
      };

    case 'yearly':
      const month = date.getMonth() + 1;
      let monthName = '';

      if (config.calendarType === 'hebrew') {
        monthName = HEBREW_MONTHS[month - 1] || `Month ${month}`;
      } else if (config.calendarType === 'islamic') {
        monthName = ISLAMIC_MONTHS[month - 1] || `Month ${month}`;
      } else if (config.calendarType === 'chinese') {
        monthName = CHINESE_MONTHS[month - 1] || `Month ${month}`;
      } else {
        monthName = GREGORIAN_MONTHS[month - 1] || `Month ${month}`;
      }

      // Check if it matches a specific date range
      if (config.scheduleDatesOfYear) {
        for (const dateRange of config.scheduleDatesOfYear as any[]) {
          if (dateRange.month === month) {
            if (dateRange.days?.includes(dayOfMonth)) {
              return {
                section: 'Yearly - Specific Dates',
                details: `${monthName} ${formatOrdinal(dayOfMonth)}`,
              };
            }
            if (dateRange.start && dateRange.end && dayOfMonth >= dateRange.start && dayOfMonth <= dateRange.end) {
              return {
                section: 'Yearly - Date Range',
                details: `${monthName} ${formatOrdinal(dateRange.start)}-${formatOrdinal(dateRange.end)}`,
              };
            }
          }
        }
      }

      return {
        section: 'Yearly',
        details: `${monthName} ${formatOrdinal(dayOfMonth)}`,
      };

    case 'alwaysactive':
      return {
        section: 'Always Active',
        details: 'Every day',
      };

    default:
      return {
        section: 'Custom',
        details: 'Custom schedule',
      };
  }
}

/**
 * Generate next occurrences for display with source metadata
 */
export function getNextOccurrencesForDisplay(
  config: ScheduleSummaryRequest,
  count: number = 3
): NextOccurrence[] {
  try {
    const scheduleConfig: ScheduleConfig = {
      calendarType: (config.calendarType || 'gregorian') as any,
      recurrenceType: (config.scheduleRecurrenceType || config.scheduleType || 'daily') as any,
      scheduleType: (config.scheduleType as any),
      startDate: config.startDate,
      endDate: config.endDate,
      timezone: config.timezone || 'UTC',
      daysOfWeek: config.scheduleDaysOfWeek,
      monthlyDates: config.scheduleDatesOfMonth,
      nthDayOfMonth: config.scheduleNthDayOfMonth,
      monthlyRange: config.scheduleMonthlyRange,
      monthlyUseAlternativeCalendar: config.monthlyUseAlternativeCalendar,
      monthlyCalendarType: config.monthlyCalendarType,
      monthlyCalendarEvent: config.monthlyCalendarEvent,
      fortnightEvenOdd: config.scheduleFortnightEvenOdd as any,
      yearlyMonths: config.scheduleDatesOfYear ? config.scheduleDatesOfYear.map((r: any) => r.month) : undefined,
      yearlyDatesOrRanges: config.scheduleDatesOfYear,
      weekendsOnly: config.scheduleWeekendsOnly,
      weekdaysOnly: config.scheduleWeekdaysOnly,
    };

    const activations = getNextActivations(scheduleConfig, new Date(), count);

    return activations.map(activation => {
      const date = new Date(`${activation.date}T${activation.time}:00Z`);
      const formattedDate = formatDateWithCalendar(date, false, config.calendarType);
      const source = determineOccurrenceSource(date, config);

      return {
        date: formattedDate,
        source,
      };
    });
  } catch (error) {
    // Fallback if generation fails
    return [
      {
        date: 'Next occurrence cannot be calculated',
        source: {
          section: 'Error',
          details: 'Calculation error',
        },
      },
    ];
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
