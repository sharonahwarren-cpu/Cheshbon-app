
import { ScheduleConfig, WeekdayPosition } from '@/components/GoalScheduler';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const POSITION_NAMES = ['1st', '2nd', '3rd', '4th', 'Last'];
const CALENDAR_NAMES = {
  gregorian: 'Gregorian',
  hebrew: 'Hebrew',
  chinese: 'Chinese',
  islamic: 'Islamic',
};

// Hebrew month names (1-indexed, matching @hebcal/core month numbering)
// Tishrei=1, Cheshvan=2, Kislev=3, Tevet=4, Shevat=5, Adar=6,
// Nissan=7, Iyar=8, Sivan=9, Tammuz=10, Av=11, Elul=12
const HEBREW_MONTH_NAMES = [
  'Tishrei',   // 1
  'Cheshvan',  // 2
  'Kislev',    // 3
  'Tevet',     // 4
  'Shevat',    // 5
  'Adar',      // 6
  'Nissan',    // 7
  'Iyar',      // 8
  'Sivan',     // 9
  'Tammuz',    // 10
  'Av',        // 11
  'Elul',      // 12
];

const GREGORIAN_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Generate a human-readable summary of a goal schedule configuration
 */
export function generateScheduleSummary(config: ScheduleConfig): string {
  const scheduleType = config.scheduleType;

  if (scheduleType === 'Always Active') {
    return 'Active every day';
  }

  if (scheduleType === 'Weekly') {
    if (!config.weekdays || config.weekdays.length === 0) {
      return 'Weekly (no days selected)';
    }

    if (config.weekendsOnly) {
      return 'Every weekend (Saturday and Sunday)';
    }

    if (config.weekdaysOnly) {
      return 'Every weekday (Monday through Friday)';
    }

    const sortedDays = [...config.weekdays].sort((a, b) => a - b);
    const dayNames = sortedDays.map(day => WEEKDAY_NAMES[day]);

    if (dayNames.length === 7) {
      return 'Every day of the week';
    }

    if (dayNames.length === 1) {
      return `Every ${dayNames[0]}`;
    }

    if (dayNames.length === 2) {
      return `Every ${dayNames[0]} and ${dayNames[1]}`;
    }

    const lastDay = dayNames.pop();
    return `Every ${dayNames.join(', ')}, and ${lastDay}`;
  }

  if (scheduleType === 'Fortnightly') {
    const weekLabel = config.fortnightWeek === 'week1' ? 'Week 1' : 'Week 2';
    
    if (!config.fortnightDays || config.fortnightDays.length === 0) {
      return `Every ${weekLabel} (no days selected)`;
    }

    const dayIndices = config.fortnightDays.map(d => d % 7);
    const dayNames = dayIndices.map(d => WEEKDAY_SHORT[d]);

    if (dayNames.length === 1) {
      return `Every ${weekLabel} on ${WEEKDAY_NAMES[dayIndices[0]]}`;
    }

    if (dayNames.length === 2) {
      return `Every ${weekLabel} on ${WEEKDAY_NAMES[dayIndices[0]]} and ${WEEKDAY_NAMES[dayIndices[1]]}`;
    }

    const lastDay = dayNames.pop();
    return `Every ${weekLabel} on ${dayNames.join(', ')}, and ${lastDay}`;
  }

  if (scheduleType === 'Monthly') {
    const parts: string[] = [];
    const calendarType = config.monthlyUseAlternativeCalendar && config.monthlyCalendarType
      ? config.monthlyCalendarType
      : 'gregorian';
    const calendarLabel = calendarType !== 'gregorian' ? ` ${CALENDAR_NAMES[calendarType]}` : '';

    // Calendar event takes precedence
    if (config.monthlyCalendarEvent) {
      return `Scheduled on ${config.monthlyCalendarEvent}`;
    }

    // Specific dates
    if (config.monthlyDates && config.monthlyDates.length > 0) {
      const sortedDates = [...config.monthlyDates].sort((a, b) => a - b);
      const dateStrings = sortedDates.map(d => formatOrdinal(d));

      if (dateStrings.length === 1) {
        parts.push(`the ${dateStrings[0]} of every${calendarLabel} month`);
      } else if (dateStrings.length === 2) {
        parts.push(`the ${dateStrings[0]} and ${dateStrings[1]} of every${calendarLabel} month`);
      } else {
        const lastDate = dateStrings.pop();
        parts.push(`the ${dateStrings.join(', ')}, and ${lastDate} of every${calendarLabel} month`);
      }
    }

    // Weekday positions
    if (config.monthlyWeekdayPositions && config.monthlyWeekdayPositions.length > 0) {
      const positionStrings = config.monthlyWeekdayPositions.map(wp => {
        const positionName = wp.position === 5 ? 'last' : POSITION_NAMES[wp.position - 1];
        const weekdayName = WEEKDAY_NAMES[wp.weekday];
        return `${positionName} ${weekdayName}`;
      });

      if (positionStrings.length === 1) {
        const prefix = parts.length > 0 ? ' and the' : 'the';
        parts.push(`${prefix} ${positionStrings[0]} of every${calendarLabel} month`);
      } else if (positionStrings.length === 2) {
        const prefix = parts.length > 0 ? ' and the' : 'the';
        parts.push(`${prefix} ${positionStrings[0]} and ${positionStrings[1]} of every${calendarLabel} month`);
      } else {
        const lastPosition = positionStrings.pop();
        const prefix = parts.length > 0 ? ' and the' : 'the';
        parts.push(`${prefix} ${positionStrings.join(', ')}, and ${lastPosition} of every${calendarLabel} month`);
      }
    }

    // Date range
    if (config.monthlyRangeStart && config.monthlyRangeEnd) {
      const prefix = parts.length > 0 ? ' and' : '';
      parts.push(`${prefix} from the ${formatOrdinal(config.monthlyRangeStart)} to ${formatOrdinal(config.monthlyRangeEnd)} of every${calendarLabel} month`);
    }

    // Random count
    if (config.monthlyRandomCount && config.monthlyRandomCount > 0) {
      const prefix = parts.length > 0 ? ' and' : '';
      parts.push(`${prefix} ${config.monthlyRandomCount} random day${config.monthlyRandomCount > 1 ? 's' : ''} per${calendarLabel} month`);
    }

    if (parts.length === 0) {
      return `Monthly${calendarLabel} (no dates selected)`;
    }

    let summary = 'Scheduled on ' + parts.join('');
    
    // Capitalize first letter
    summary = summary.charAt(0).toUpperCase() + summary.slice(1);

    return summary;
  }

  if (scheduleType === 'Yearly') {
    const calendarType = config.yearlyUseAlternativeCalendar && config.yearlyCalendarType
      ? config.yearlyCalendarType
      : 'gregorian';
    const calendarLabel = calendarType !== 'gregorian' ? ` (${CALENDAR_NAMES[calendarType]})` : '';

    // Calendar event takes precedence
    if (config.yearlyCalendarEvent) {
      return `Scheduled on ${config.yearlyCalendarEvent} every year${calendarLabel}`;
    }

    // Specific dates
    if (config.yearlyDates && config.yearlyDates.length > 0) {
      const isHebrew = calendarType === 'hebrew';

      // CRITICAL FIX: Normalize each entry to handle both:
      // - New JSONB format: { month: 1, day: 3, endMonth: 2, endDay: 2 } (objects)
      // - Legacy text[] format: strings that may be JSON-encoded objects
      const normalizedDates = config.yearlyDates
        .map((entry: any) => {
          if (typeof entry === 'string') {
            // Legacy string format - try to parse as JSON
            try {
              const parsed = JSON.parse(entry);
              if (parsed && typeof parsed === 'object' && typeof parsed.month === 'number' && typeof parsed.day === 'number') {
                return parsed;
              }
            } catch {
              // Not parseable JSON - skip
            }
            return null; // Invalid legacy string entry
          }
          if (entry && typeof entry === 'object' && typeof entry.month === 'number' && typeof entry.day === 'number') {
            return entry; // Valid object format
          }
          return null; // Invalid entry
        })
        .filter(Boolean);

      const dateStrings = normalizedDates
        .map((dateRange: any) => {
          const monthName = isHebrew
            ? (HEBREW_MONTH_NAMES[dateRange.month - 1] || `Month ${dateRange.month}`)
            : (GREGORIAN_MONTH_NAMES[dateRange.month - 1] || new Date(2024, dateRange.month - 1, 1).toLocaleDateString('en-US', { month: 'long' }));
          
          if (dateRange.endMonth && dateRange.endDay) {
            const endMonthName = isHebrew
              ? (HEBREW_MONTH_NAMES[dateRange.endMonth - 1] || `Month ${dateRange.endMonth}`)
              : (GREGORIAN_MONTH_NAMES[dateRange.endMonth - 1] || new Date(2024, dateRange.endMonth - 1, 1).toLocaleDateString('en-US', { month: 'long' }));
            return `${monthName} ${formatOrdinal(dateRange.day)} to ${endMonthName} ${formatOrdinal(dateRange.endDay)}`;
          }
          
          return `${monthName} ${formatOrdinal(dateRange.day)}`;
        });

      // CRITICAL FIX: Check if we have any valid date strings after filtering
      if (dateStrings.length === 0) {
        return `Yearly${calendarLabel} (no valid dates)`;
      }

      if (dateStrings.length === 1) {
        return `Scheduled on ${dateStrings[0]} every year${calendarLabel}`;
      }

      if (dateStrings.length === 2) {
        return `Scheduled on ${dateStrings[0]} and ${dateStrings[1]} every year${calendarLabel}`;
      }

      const lastDate = dateStrings.pop();
      return `Scheduled on ${dateStrings.join(', ')}, and ${lastDate} every year${calendarLabel}`;
    }

    return `Yearly${calendarLabel} (no dates selected)`;
  }

  return scheduleType;
}

/**
 * Format a number with ordinal suffix (1st, 2nd, 3rd, etc.)
 */
function formatOrdinal(num: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const value = num % 100;
  const suffix = suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0];
  return num + suffix;
}

/**
 * Generate a short summary for display in lists
 */
export function generateShortScheduleSummary(config: ScheduleConfig): string {
  const scheduleType = config.scheduleType;

  if (scheduleType === 'Always Active') {
    return 'Every day';
  }

  if (scheduleType === 'Weekly') {
    const dayCount = config.weekdays?.length || 0;
    if (dayCount === 0) return 'Weekly';
    if (dayCount === 7) return 'Every day';
    return `${dayCount} days/week`;
  }

  if (scheduleType === 'Fortnightly') {
    const weekLabel = config.fortnightWeek === 'week1' ? 'Week 1' : 'Week 2';
    const dayCount = config.fortnightDays?.length || 0;
    return `${weekLabel} (${dayCount} days)`;
  }

  if (scheduleType === 'Monthly') {
    if (config.monthlyCalendarEvent) {
      return config.monthlyCalendarEvent;
    }
    const dateCount = (config.monthlyDates?.length || 0) + (config.monthlyWeekdayPositions?.length || 0);
    if (dateCount === 0) return 'Monthly';
    return `${dateCount} day${dateCount > 1 ? 's' : ''}/month`;
  }

  if (scheduleType === 'Yearly') {
    if (config.yearlyCalendarEvent) {
      return config.yearlyCalendarEvent;
    }
    // CRITICAL FIX: Count only valid object entries (not legacy strings)
    const validDates = config.yearlyDates?.filter((d: any) => {
      if (typeof d === 'string') return false;
      return d && typeof d === 'object' && typeof d.month === 'number' && typeof d.day === 'number';
    }) || [];
    const dateCount = validDates.length;
    if (dateCount > 0) return `${dateCount} date${dateCount > 1 ? 's' : ''}/year`;
    return 'Yearly';
  }

  return scheduleType;
}
