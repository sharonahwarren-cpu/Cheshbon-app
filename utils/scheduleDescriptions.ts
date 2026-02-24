
import { ScheduleConfig, WeekdayPosition, YearlyDateEntry } from '@/components/GoalScheduler';

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

  // REBUILT FROM SCRATCH: Yearly schedule description (following Monthly pattern)
  // yearlyDates is now Array<{month, day}> matching backend jsonb format
  if (scheduleType === 'Yearly') {
    const calendarType = config.yearlyUseAlternativeCalendar && config.yearlyCalendarType
      ? config.yearlyCalendarType
      : 'gregorian';
    const calendarLabel = calendarType !== 'gregorian' ? ` (${CALENDAR_NAMES[calendarType]})` : '';

    const monthNames = calendarType === 'gregorian' ? GREGORIAN_MONTH_NAMES :
                       calendarType === 'hebrew' ? HEBREW_MONTH_NAMES :
                       GREGORIAN_MONTH_NAMES;

    // Calendar event takes precedence
    if (config.yearlyCalendarEvent) {
      return `Scheduled on ${config.yearlyCalendarEvent} every year${calendarLabel}`;
    }

    const parts: string[] = [];

    // Specific dates - now Array<{month, day}> objects
    if (config.yearlyDates && config.yearlyDates.length > 0) {
      // Sort by month then day
      const sortedDates = [...config.yearlyDates].sort((a, b) =>
        a.month !== b.month ? a.month - b.month : a.day - b.day
      );
      const dateStrings = sortedDates.map(d => {
        const monthName = monthNames[d.month - 1] || `Month ${d.month}`;
        return `${monthName} ${formatOrdinal(d.day)}`;
      });

      if (dateStrings.length === 1) {
        parts.push(`${dateStrings[0]} every year`);
      } else if (dateStrings.length === 2) {
        parts.push(`${dateStrings[0]} and ${dateStrings[1]} every year`);
      } else {
        const lastDate = dateStrings.pop();
        parts.push(`${dateStrings.join(', ')}, and ${lastDate} every year`);
      }
    }

    // Date ranges
    if (config.yearlyRanges && config.yearlyRanges.length > 0) {
      const rangeStrings = config.yearlyRanges.map(range => {
        const startMonthName = monthNames[range.startMonth - 1] || `Month ${range.startMonth}`;
        const endMonthName = monthNames[range.endMonth - 1] || `Month ${range.endMonth}`;
        return `${startMonthName} ${formatOrdinal(range.startDay)} to ${endMonthName} ${formatOrdinal(range.endDay)}`;
      });

      if (rangeStrings.length === 1) {
        const prefix = parts.length > 0 ? ' and' : '';
        parts.push(`${prefix} from ${rangeStrings[0]} every year`);
      } else if (rangeStrings.length === 2) {
        const prefix = parts.length > 0 ? ' and' : '';
        parts.push(`${prefix} from ${rangeStrings[0]} and ${rangeStrings[1]} every year`);
      } else {
        const lastRange = rangeStrings.pop();
        const prefix = parts.length > 0 ? ' and' : '';
        parts.push(`${prefix} from ${rangeStrings.join(', ')}, and ${lastRange} every year`);
      }
    }

    if (parts.length === 0) {
      return `Yearly${calendarLabel} (no dates selected)`;
    }

    let summary = 'Scheduled on ' + parts.join('');
    
    // Capitalize first letter
    summary = summary.charAt(0).toUpperCase() + summary.slice(1);

    return summary;
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

  // REBUILT FROM SCRATCH: Yearly short summary (following Monthly pattern)
  // yearlyDates is now Array<{month, day}> objects
  if (scheduleType === 'Yearly') {
    if (config.yearlyCalendarEvent) {
      return config.yearlyCalendarEvent;
    }
    const dateCount = (config.yearlyDates?.length || 0) + (config.yearlyRanges?.length || 0);
    if (dateCount > 0) return `${dateCount} date${dateCount > 1 ? 's' : ''}/year`;
    return 'Yearly';
  }

  return scheduleType;
}
