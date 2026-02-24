/**
 * Schedule summary generation for human-readable goal schedule descriptions
 */

import { HEBREW_MONTHS, ISLAMIC_MONTHS, CHINESE_MONTHS, GREGORIAN_MONTHS, gregorianToHebrew, hebrewToGregorian, isHebrewLeapYear, getHebrewDateOccurrences } from './calendar.js';
import { getNextActivations, type ScheduleConfig } from './goal-scheduler.js';

export interface ScheduleSummaryRequest {
  scheduleType?: string;
  scheduleRecurrenceType?: string;
  scheduleDaysOfWeek?: number[];
  scheduleDatesOfMonth?: number[];
  scheduleNthDayOfMonth?: { day: string; nth: number };
  scheduleMonthlyRange?: { start: number; end: number };
  scheduleFortnightEvenOdd?: 'even' | 'odd';
  scheduleYearlyDates?: Array<{ month: number; day: number }>;
  scheduleYearlyRanges?: Array<{ startMonth: number; startDay: number; endMonth: number; endDay: number }>;
  scheduleTimesPerDayDetails?: Array<{ hour: number; minute: number; conditions?: string }>;
  scheduleWeekendsOnly?: boolean;
  scheduleWeekdaysOnly?: boolean;
  calendarType?: string;
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
  const parts: string[] = [];

  // Handle yearly dates (specific month/day combinations)
  if (config.scheduleYearlyDates && config.scheduleYearlyDates.length > 0) {
    for (const date of config.scheduleYearlyDates) {
      const monthName = getMonthName(date.month, config.calendarType);
      const dayOrdinal = formatOrdinal(date.day);
      parts.push(`${monthName} ${dayOrdinal}`);
    }
  }

  // Handle yearly ranges (date ranges within a year)
  if (config.scheduleYearlyRanges && config.scheduleYearlyRanges.length > 0) {
    for (const range of config.scheduleYearlyRanges) {
      const startMonthName = getMonthName(range.startMonth, config.calendarType);
      const endMonthName = getMonthName(range.endMonth, config.calendarType);
      const startOrdinal = formatOrdinal(range.startDay);
      const endOrdinal = formatOrdinal(range.endDay);

      if (range.startMonth === range.endMonth) {
        parts.push(`${startMonthName} ${startOrdinal}-${endOrdinal}`);
      } else {
        parts.push(`${startMonthName} ${startOrdinal} - ${endMonthName} ${endOrdinal}`);
      }
    }
  }

  if (parts.length === 0) {
    return 'Scheduled yearly';
  }

  const calendarLabel = config.calendarType && config.calendarType !== 'gregorian' ? ` (${config.calendarType})` : '';
  return `Scheduled on ${parts.join(', ')} every year${calendarLabel}`;
}

/**
 * Helper function to get month name based on calendar type
 */
function getMonthName(monthNum: number, calendarType?: string): string {
  if (calendarType === 'hebrew') {
    return HEBREW_MONTHS[monthNum - 1] || `Month ${monthNum}`;
  } else if (calendarType === 'islamic') {
    return ISLAMIC_MONTHS[monthNum - 1] || `Month ${monthNum}`;
  } else if (calendarType === 'chinese') {
    return CHINESE_MONTHS[monthNum - 1] || `Month ${monthNum}`;
  } else {
    return GREGORIAN_MONTHS[monthNum - 1] || `Month ${monthNum}`;
  }
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
      // Check if it's a selected date
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
      let monthName = getMonthName(month, config.calendarType);

      // Check if it matches a specific yearly date
      if (config.scheduleYearlyDates) {
        const match = config.scheduleYearlyDates.find(d => d.month === month && d.day === dayOfMonth);
        if (match) {
          return {
            section: 'Yearly - Specific Date',
            details: `${monthName} ${formatOrdinal(dayOfMonth)}`,
          };
        }
      }

      // Check if it falls within a yearly range
      if (config.scheduleYearlyRanges) {
        for (const range of config.scheduleYearlyRanges) {
          const startMonthDay = range.startMonth * 100 + range.startDay;
          const endMonthDay = range.endMonth * 100 + range.endDay;
          const currentMonthDay = month * 100 + dayOfMonth;

          if (startMonthDay <= endMonthDay) {
            if (currentMonthDay >= startMonthDay && currentMonthDay <= endMonthDay) {
              const startMonthName = getMonthName(range.startMonth, config.calendarType);
              const endMonthName = getMonthName(range.endMonth, config.calendarType);
              const details = range.startMonth === range.endMonth
                ? `${startMonthName} ${formatOrdinal(range.startDay)}-${formatOrdinal(range.endDay)}`
                : `${startMonthName} ${formatOrdinal(range.startDay)} - ${endMonthName} ${formatOrdinal(range.endDay)}`;
              return {
                section: 'Yearly - Date Range',
                details,
              };
            }
          } else {
            // Range wraps around year
            if (currentMonthDay >= startMonthDay || currentMonthDay <= endMonthDay) {
              const startMonthName = getMonthName(range.startMonth, config.calendarType);
              const endMonthName = getMonthName(range.endMonth, config.calendarType);
              return {
                section: 'Yearly - Date Range',
                details: `${startMonthName} ${formatOrdinal(range.startDay)} - ${endMonthName} ${formatOrdinal(range.endDay)}`,
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
      fortnightEvenOdd: config.scheduleFortnightEvenOdd as any,
      yearlyDates: config.scheduleYearlyDates,
      yearlyRanges: config.scheduleYearlyRanges,
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
