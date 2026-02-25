
import { DateTime } from 'luxon';
import { RRule, RRuleSet, rrulestr } from 'rrule';
import { HDate, HebrewCalendar } from '@hebcal/core';
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
  calendarEvent?: string; // Hebrew calendar event name (e.g., "Rosh Chodesh")

  // Yearly - REBUILT FROM SCRATCH (following Monthly pattern)
  months?: number[]; // 1-12 (Gregorian) or specific Hebrew/Chinese/Islamic month indices
  // datesOrRanges: each entry can be a specific date (days array) or a range (start/end)
  datesOrRanges?: Array<{ month: number; days?: number[]; start?: number; end?: number; endMonth?: number }>;
  // yearlyDates: new {month, day} format from backend jsonb (alternative to datesOrRanges)
  yearlyDates?: Array<{ month: number; day: number }>;
  // yearlyRanges: new range format from backend jsonb
  yearlyRanges?: Array<{ startMonth: number; startDay: number; endMonth: number; endDay: number }>;
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
 * Generate next N occurrences of a Hebrew calendar event (e.g., "Rosh Chodesh")
 * Uses @hebcal/core HebrewCalendar to find matching events.
 */
function generateHebrewCalendarEventActivations(
  eventName: string,
  now: DateTime,
  count: number,
  timezone: string,
  schedule: GoalSchedule,
  alarms?: GoalAlarm[],
  location?: { latitude: number; longitude: number }
): ActivationPreview[] {
  const activations: ActivationPreview[] = [];
  try {
    const startHDate = new HDate(now.toJSDate());
    const endHDate = new HDate(now.plus({ years: 3 }).toJSDate());

    const events = HebrewCalendar.calendar({
      start: startHDate,
      end: endHDate,
      isHebrewYear: false,
      sedrot: false,
      omer: false,
      shabbat: false,
      noHolidays: false,
    });

    const normalizedEventName = eventName.toLowerCase().replace(/[\s']/g, '');

    for (const event of events) {
      if (activations.length >= count) break;
      const desc = event.getDesc().toLowerCase().replace(/[\s']/g, '');
      // Match event name - handle partial matches for events like "Rosh Chodesh Tishrei"
      // "roshchodesh" should match "roshchodesh tishrei", "roshchodesh nisan", etc.
      const matches = desc.startsWith(normalizedEventName) ||
        normalizedEventName.startsWith(desc.substring(0, Math.min(10, desc.length)));

      if (matches) {
        const gregDate = event.getDate().greg();
        const activation = DateTime.fromJSDate(gregDate, { zone: timezone }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
        if (activation > now) {
          activations.push(createActivationPreview(activation, schedule, alarms, location));
        }
      }
    }
  } catch (error) {
    console.warn('[ScheduleCalc] Failed to generate Hebrew calendar event activations:', error);
  }
  return activations;
}

/**
 * Convert a Hebrew month/day in a given Hebrew year to a Gregorian DateTime.
 * @internal
 */
function getGregorianDateForHebrewMonthDay(
  hebrewMonth: number,
  hebrewDay: number,
  afterDate: DateTime,
  timezone: string
): DateTime | null {
  try {
    // Try Hebrew years that could contain this month/day after the given date
    // Hebrew year starts in Tishrei (around Sep/Oct)
    // We need to try a range of Hebrew years
    const approxHebrewYear = afterDate.year + 3760;

    for (let yearOffset = -1; yearOffset <= 3; yearOffset++) {
      const hebrewYear = approxHebrewYear + yearOffset;
      try {
        const hdate = new HDate(hebrewDay, hebrewMonth, hebrewYear);
        const gregDate = hdate.greg();
        const activation = DateTime.fromJSDate(gregDate, { zone: timezone }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
        if (activation > afterDate) {
          return activation;
        }
      } catch {
        // Invalid Hebrew date (e.g., day 30 in a month with only 29 days), skip
      }
    }
    return null;
  } catch (error) {
    console.warn('[ScheduleCalc] Failed to convert Hebrew month/day to Gregorian:', error);
    return null;
  }
}

/**
 * Generate monthly activations with Hebrew calendar support
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

  // Check if this is a Hebrew calendar monthly schedule
  const isHebrew = schedule.calendarType === 'Hebrew';

  // Handle Hebrew calendar event (e.g., "Rosh Chodesh")
  // These are stored in the schedule details as a special marker
  const calendarEvent = (schedule.details as any).calendarEvent;
  if (isHebrew && calendarEvent) {
    console.log('[ScheduleCalc] Generating Hebrew calendar event activations for:', calendarEvent);
    return generateHebrewCalendarEventActivations(calendarEvent, now, count, timezone, schedule, alarms, location);
  }

  // Handle Hebrew calendar with specific day numbers (e.g., 21st of each Hebrew month)
  if (isHebrew && dates && dates.length > 0) {
    console.log('[ScheduleCalc] Generating Hebrew monthly activations for days:', dates);

    try {
      // Get the current Hebrew date to start from
      const currentHDate = new HDate(now.toJSDate());
      let currentHebrewMonth = currentHDate.getMonth();
      let currentHebrewYear = currentHDate.getFullYear();

      // Iterate through Hebrew months to find next occurrences
      let monthsChecked = 0;
      const maxMonthsToCheck = count * 15 + 24; // Safety limit

      while (activations.length < count && monthsChecked < maxMonthsToCheck) {
        monthsChecked++;

        // Handle Adar in non-leap years (skip Adar II = month 7 in non-leap years)
        const isLeap = isHebrewLeapYear(currentHebrewYear);
        if (!isLeap && currentHebrewMonth === 7) {
          // Skip Adar II in non-leap years, go to Nisan (month 8 in leap = month 7 in non-leap)
          currentHebrewMonth = 8;
        }

        for (const hebrewDay of dates) {
          if (activations.length >= count) break;
          try {
            const hdate = new HDate(hebrewDay, currentHebrewMonth, currentHebrewYear);
            const gregDate = hdate.greg();
            const activation = DateTime.fromJSDate(gregDate, { zone: timezone }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
            if (activation > now && activation <= end) {
              activations.push(createActivationPreview(activation, schedule, alarms, location));
            }
          } catch {
            // Invalid Hebrew date (e.g., day 30 in a 29-day month), skip
          }
        }

        // Advance to next Hebrew month
        currentHebrewMonth++;
        // Hebrew year has 12 months (non-leap) or 13 months (leap)
        const monthsInYear = isHebrewLeapYear(currentHebrewYear) ? 13 : 12;
        if (currentHebrewMonth > monthsInYear) {
          currentHebrewMonth = 1;
          currentHebrewYear++;
        }
      }
    } catch (error) {
      console.warn('[ScheduleCalc] Error in Hebrew monthly calculation:', error);
    }

    return activations.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Standard Gregorian monthly calculation
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
 * Convert a Hebrew date (month/day/year) to a Gregorian DateTime using @hebcal/core
 * Hebrew months: Tishrei=1, Cheshvan=2, Kislev=3, Tevet=4, Shevat=5, Adar=6,
 *                Nissan=7, Iyar=8, Sivan=9, Tammuz=10, Av=11, Elul=12
 * Note: In leap years Adar I=6, Adar II=7, Nissan=8
 */
function hebrewToGregorianDate(hebrewYear: number, hebrewMonth: number, hebrewDay: number, timezone: string): DateTime | null {
  try {
    const hdate = new HDate(hebrewDay, hebrewMonth, hebrewYear);
    const gregDate = hdate.greg();
    return DateTime.fromJSDate(gregDate, { zone: timezone }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
  } catch (error) {
    console.warn('[ScheduleCalc] Failed to convert Hebrew date to Gregorian:', { hebrewYear, hebrewMonth, hebrewDay, error });
    return null;
  }
}

/**
 * REBUILT FROM SCRATCH: Generate yearly activations (following Monthly pattern)
 * Supports both new {month, day} format (yearlyDates/yearlyRanges) and legacy datesOrRanges format
 * 
 * FIXED: Hebrew calendar yearly calculation now properly iterates through Hebrew years
 * like the working monthly section does.
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
  const { datesOrRanges, yearlyDates, yearlyRanges, startDate, endDate } = schedule.details;

  // Build a unified list of date entries from all sources
  // New format: yearlyDates (Array<{month, day}>) and yearlyRanges (Array<{startMonth, startDay, endMonth, endDay}>)
  // Legacy format: datesOrRanges (Array<{month, days?, start?, end?, endMonth?}>)
  const hasNewFormat = (yearlyDates && yearlyDates.length > 0) || (yearlyRanges && yearlyRanges.length > 0);
  const hasLegacyFormat = datesOrRanges && datesOrRanges.length > 0;

  if (!hasNewFormat && !hasLegacyFormat) {
    console.warn('[ScheduleCalc] No dates or ranges specified for yearly schedule');
    return [];
  }

  const start = startDate ? DateTime.fromISO(startDate, { zone: 'UTC' }).setZone(timezone) : now;
  const end = endDate ? DateTime.fromISO(endDate, { zone: 'UTC' }).setZone(timezone) : now.plus({ years: 10 });

  const isHebrew = schedule.calendarType === 'Hebrew';

  // FIXED: For Hebrew calendar, use the same iteration pattern as monthly
  if (isHebrew) {
    console.log('[ScheduleCalc] Generating Hebrew yearly activations');
    
    try {
      // Get the current Hebrew date to start from
      const currentHDate = new HDate(now.toJSDate());
      let currentHebrewYear = currentHDate.getFullYear();

      // Iterate through Hebrew years to find next occurrences
      let yearsChecked = 0;
      const maxYearsToCheck = count + 10; // Safety limit

      while (activations.length < count && yearsChecked < maxYearsToCheck) {
        yearsChecked++;

        // Process new format: yearlyDates (Array<{month, day}>)
        if (yearlyDates && yearlyDates.length > 0) {
          for (const entry of yearlyDates) {
            if (activations.length >= count) break;
            try {
              const hdate = new HDate(entry.day, entry.month, currentHebrewYear);
              const gregDate = hdate.greg();
              const activation = DateTime.fromJSDate(gregDate, { zone: timezone }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
              if (activation > now && activation <= end) {
                activations.push(createActivationPreview(activation, schedule, alarms, location));
              }
            } catch {
              // Invalid Hebrew date (e.g., day 30 in a 29-day month), skip
            }
          }
        }

        // Process new format: yearlyRanges (Array<{startMonth, startDay, endMonth, endDay}>)
        if (yearlyRanges && yearlyRanges.length > 0) {
          for (const range of yearlyRanges) {
            if (activations.length >= count) break;
            // For Hebrew calendar, iterate through each day in the range
            for (let day = range.startDay; day <= range.endDay; day++) {
              if (activations.length >= count) break;
              try {
                const hdate = new HDate(day, range.startMonth, currentHebrewYear);
                const gregDate = hdate.greg();
                const activation = DateTime.fromJSDate(gregDate, { zone: timezone }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
                if (activation > now && activation <= end) {
                  activations.push(createActivationPreview(activation, schedule, alarms, location));
                }
              } catch {
                // Invalid Hebrew date, skip
              }
            }
          }
        }

        // Process legacy format: datesOrRanges
        if (datesOrRanges && datesOrRanges.length > 0) {
          for (const dateRange of datesOrRanges) {
            if (activations.length >= count) break;
            
            if (dateRange.days && dateRange.days.length > 0) {
              for (const day of dateRange.days) {
                if (activations.length >= count) break;
                try {
                  const hdate = new HDate(day, dateRange.month, currentHebrewYear);
                  const gregDate = hdate.greg();
                  const activation = DateTime.fromJSDate(gregDate, { zone: timezone }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
                  if (activation > now && activation <= end) {
                    activations.push(createActivationPreview(activation, schedule, alarms, location));
                  }
                } catch {
                  // Invalid Hebrew date, skip
                }
              }
            } else if (dateRange.start !== undefined && dateRange.end !== undefined) {
              for (let day = dateRange.start; day <= dateRange.end; day++) {
                if (activations.length >= count) break;
                try {
                  const hdate = new HDate(day, dateRange.month, currentHebrewYear);
                  const gregDate = hdate.greg();
                  const activation = DateTime.fromJSDate(gregDate, { zone: timezone }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
                  if (activation > now && activation <= end) {
                    activations.push(createActivationPreview(activation, schedule, alarms, location));
                  }
                } catch {
                  // Invalid Hebrew date, skip
                }
              }
            }
          }
        }

        // Advance to next Hebrew year
        currentHebrewYear++;
      }
    } catch (error) {
      console.warn('[ScheduleCalc] Error in Hebrew yearly calculation:', error);
    }

    return activations.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Standard Gregorian yearly calculation
  let currentYear = start.year;
  if (start < now) {
    currentYear = now.year;
  }

  while (activations.length < count && currentYear <= end.year) {
    // Process new format: yearlyDates (Array<{month, day}>)
    if (yearlyDates && yearlyDates.length > 0) {
      for (const entry of yearlyDates) {
        const activation = DateTime.fromObject(
          { year: currentYear, month: entry.month, day: entry.day, hour: 9, minute: 0 },
          { zone: timezone }
        );
        if (activation.isValid && activation > now && activation <= end) {
          activations.push(createActivationPreview(activation, schedule, alarms, location));
        }
        if (activations.length >= count) break;
      }
    }

    if (activations.length >= count) break;

    // Process new format: yearlyRanges (Array<{startMonth, startDay, endMonth, endDay}>)
    if (yearlyRanges && yearlyRanges.length > 0) {
      for (const range of yearlyRanges) {
        // Cross-month range: iterate from start date to end date
        let current = DateTime.fromObject(
          { year: currentYear, month: range.startMonth, day: range.startDay, hour: 9, minute: 0 },
          { zone: timezone }
        );
        const rangeEnd = DateTime.fromObject(
          { year: currentYear, month: range.endMonth, day: range.endDay, hour: 9, minute: 0 },
          { zone: timezone }
        );
        while (current <= rangeEnd && activations.length < count) {
          if (current > now && current <= end) {
            activations.push(createActivationPreview(current, schedule, alarms, location));
          }
          current = current.plus({ days: 1 });
        }
        if (activations.length >= count) break;
      }
    }

    if (activations.length >= count) break;

    // Process legacy format: datesOrRanges
    if (datesOrRanges && datesOrRanges.length > 0) {
      for (const dateRange of datesOrRanges) {
        if (dateRange.days && dateRange.days.length > 0) {
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
        } else if (dateRange.start !== undefined && dateRange.end !== undefined) {
          const startMonth = dateRange.month;
          const endMonth = (dateRange as any).endMonth || dateRange.month;
          
          if (endMonth === startMonth) {
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
          } else {
            let current = DateTime.fromObject(
              { year: currentYear, month: startMonth, day: dateRange.start, hour: 9, minute: 0 },
              { zone: timezone }
            );
            const rangeEnd = DateTime.fromObject(
              { year: currentYear, month: endMonth, day: dateRange.end, hour: 9, minute: 0 },
              { zone: timezone }
            );
            while (current <= rangeEnd && activations.length < count) {
              if (current > now && current <= end) {
                activations.push(createActivationPreview(current, schedule, alarms, location));
              }
              current = current.plus({ days: 1 });
            }
          }
        }
        if (activations.length >= count) break;
      }
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
    const isHebrew = schedule.calendarType === 'Hebrew';
    const { yearlyDates, yearlyRanges, datesOrRanges } = schedule.details;
    
    if (isHebrew) {
      // For Hebrew calendar, convert the check date to Hebrew and compare
      try {
        const hdate = new HDate(checkDate.toJSDate());
        const hebrewMonth = hdate.getMonth();
        const hebrewDay = hdate.getDate();

        // Check new yearlyDates format
        if (yearlyDates?.some(d => d.month === hebrewMonth && d.day === hebrewDay)) return true;

        // Check legacy datesOrRanges format
        return datesOrRanges?.some(dr => {
          if (dr.month !== hebrewMonth) return false;
          if (dr.days?.includes(hebrewDay)) return true;
          if (dr.start !== undefined && dr.end !== undefined && hebrewDay >= dr.start && hebrewDay <= dr.end) return true;
          return false;
        }) || false;
      } catch {
        return false;
      }
    }
    
    const month = checkDate.month;
    const day = checkDate.day;

    // Check new yearlyDates format ({month, day} objects)
    if (yearlyDates?.some(d => d.month === month && d.day === day)) return true;

    // Check new yearlyRanges format
    if (yearlyRanges?.some(r => {
      if (r.startMonth === r.endMonth) {
        return month === r.startMonth && day >= r.startDay && day <= r.endDay;
      }
      // Cross-month range
      const checkDt = checkDate;
      const startDt = DateTime.fromObject({ year: checkDate.year, month: r.startMonth, day: r.startDay });
      const endDt = DateTime.fromObject({ year: checkDate.year, month: r.endMonth, day: r.endDay });
      return checkDt >= startDt && checkDt <= endDt;
    })) return true;

    // Check legacy datesOrRanges format
    return datesOrRanges?.some(dr => {
      if (dr.month !== month) return false;
      if (dr.days?.includes(day)) return true;
      if (dr.start !== undefined && dr.end !== undefined && day >= dr.start && day <= dr.end) return true;
      return false;
    }) || false;
  }

  return false;
}
