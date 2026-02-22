
import { DateTime } from 'luxon';
import { HDate, HebrewCalendar, months as hebrewMonths } from '@hebcal/core';
import moment from 'moment-hijri';
import { Lunar, Solar } from 'lunar-javascript';

/**
 * CRITICAL DATE HANDLING UTILITIES
 * 
 * This module provides timezone-aware, calendar-aware date handling for:
 * - Gregorian, Hebrew, Chinese (Lunar), and Islamic calendars
 * - UTC storage with local timezone interpretation
 * - DST-aware conversions
 * - Alarm scheduling with expo-notifications
 * 
 * CORE PRINCIPLES:
 * 1. Always store dates as Unix timestamps (milliseconds) in UTC
 * 2. Interpret user input in local timezone
 * 3. Convert back to local timezone for display
 * 4. Handle calendar-specific edge cases (leap years, variable month lengths)
 */

export type CalendarType = 'Gregorian' | 'Hebrew' | 'Chinese' | 'Islamic';

/**
 * Get the device's local timezone
 * Uses Intl API to detect timezone (e.g., 'Australia/Melbourne')
 */
export function getLocalTimezone(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log('[DateUtils] Detected local timezone:', timezone);
    return timezone;
  } catch (error) {
    console.error('[DateUtils] Failed to detect timezone, defaulting to UTC:', error);
    return 'UTC';
  }
}

/**
 * Convert local calendar date/time to UTC timestamp for storage
 * 
 * @param year - Year in the selected calendar
 * @param month - Month (1-based) in the selected calendar
 * @param day - Day in the selected calendar
 * @param hour - Hour (0-23), defaults to 0
 * @param minute - Minute (0-59), defaults to 0
 * @param calendarType - Calendar system to use
 * @param timezone - Local timezone (defaults to device timezone)
 * @returns Unix timestamp in milliseconds (UTC)
 */
export function calendarDateToUTC(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  calendarType: CalendarType = 'Gregorian',
  timezone?: string
): number {
  const localZone = timezone || getLocalTimezone();
  
  console.log(`[DateUtils] Converting ${calendarType} date to UTC:`, {
    year, month, day, hour, minute, timezone: localZone
  });

  try {
    if (calendarType === 'Gregorian') {
      // Direct conversion using Luxon
      const dt = DateTime.fromObject(
        { year, month, day, hour, minute },
        { zone: localZone }
      );
      
      if (!dt.isValid) {
        console.error('[DateUtils] Invalid Gregorian date:', dt.invalidReason);
        throw new Error(`Invalid Gregorian date: ${dt.invalidReason}`);
      }
      
      const utcMillis = dt.toUTC().toMillis();
      console.log('[DateUtils] Gregorian -> UTC:', utcMillis, 'ISO:', dt.toUTC().toISO());
      return utcMillis;
    }
    
    if (calendarType === 'Hebrew') {
      // Convert Hebrew date to Gregorian first
      const hdate = new HDate(day, hebrewMonths[month - 1] || month, year);
      const greg = hdate.greg();
      
      const dt = DateTime.fromObject(
        { 
          year: greg.getFullYear(), 
          month: greg.getMonth() + 1, 
          day: greg.getDate(),
          hour,
          minute
        },
        { zone: localZone }
      );
      
      if (!dt.isValid) {
        console.error('[DateUtils] Invalid Hebrew->Gregorian conversion:', dt.invalidReason);
        throw new Error(`Invalid Hebrew date conversion: ${dt.invalidReason}`);
      }
      
      const utcMillis = dt.toUTC().toMillis();
      console.log('[DateUtils] Hebrew -> UTC:', utcMillis, 'ISO:', dt.toUTC().toISO());
      return utcMillis;
    }
    
    if (calendarType === 'Islamic') {
      // Convert Islamic (Hijri) date to Gregorian using moment-hijri
      const hijriDate = moment(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`, 'iYYYY-iMM-iDD');
      
      if (!hijriDate.isValid()) {
        console.error('[DateUtils] Invalid Islamic date');
        throw new Error('Invalid Islamic date');
      }
      
      const dt = DateTime.fromObject(
        {
          year: hijriDate.year(),
          month: hijriDate.month() + 1,
          day: hijriDate.date(),
          hour,
          minute
        },
        { zone: localZone }
      );
      
      if (!dt.isValid) {
        console.error('[DateUtils] Invalid Islamic->Gregorian conversion:', dt.invalidReason);
        throw new Error(`Invalid Islamic date conversion: ${dt.invalidReason}`);
      }
      
      const utcMillis = dt.toUTC().toMillis();
      console.log('[DateUtils] Islamic -> UTC:', utcMillis, 'ISO:', dt.toUTC().toISO());
      return utcMillis;
    }
    
    if (calendarType === 'Chinese') {
      // Convert Chinese lunar date to Gregorian using lunar-javascript
      const lunar = Lunar.fromYmd(year, month, day);
      const solar = lunar.getSolar();
      
      const dt = DateTime.fromObject(
        {
          year: solar.getYear(),
          month: solar.getMonth(),
          day: solar.getDay(),
          hour,
          minute
        },
        { zone: localZone }
      );
      
      if (!dt.isValid) {
        console.error('[DateUtils] Invalid Chinese->Gregorian conversion:', dt.invalidReason);
        throw new Error(`Invalid Chinese date conversion: ${dt.invalidReason}`);
      }
      
      const utcMillis = dt.toUTC().toMillis();
      console.log('[DateUtils] Chinese -> UTC:', utcMillis, 'ISO:', dt.toUTC().toISO());
      return utcMillis;
    }
    
    throw new Error(`Unsupported calendar type: ${calendarType}`);
  } catch (error) {
    console.error('[DateUtils] Error converting calendar date to UTC:', error);
    throw error;
  }
}

/**
 * Convert UTC timestamp to local calendar date/time for display
 * 
 * @param utcMillis - Unix timestamp in milliseconds (UTC)
 * @param calendarType - Calendar system to use
 * @param timezone - Local timezone (defaults to device timezone)
 * @returns Object with calendar-specific date components
 */
export function utcToCalendarDate(
  utcMillis: number,
  calendarType: CalendarType = 'Gregorian',
  timezone?: string
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
  formatted: string;
} {
  const localZone = timezone || getLocalTimezone();
  
  console.log(`[DateUtils] Converting UTC to ${calendarType}:`, {
    utcMillis, timezone: localZone
  });

  try {
    // First convert to local Gregorian
    const dt = DateTime.fromMillis(utcMillis, { zone: localZone });
    
    if (!dt.isValid) {
      console.error('[DateUtils] Invalid UTC timestamp:', dt.invalidReason);
      throw new Error(`Invalid UTC timestamp: ${dt.invalidReason}`);
    }
    
    if (calendarType === 'Gregorian') {
      const result = {
        year: dt.year,
        month: dt.month,
        day: dt.day,
        hour: dt.hour,
        minute: dt.minute,
        weekday: dt.weekday % 7, // Convert to 0-6 (Sunday-Saturday)
        formatted: dt.toFormat('MMMM d, yyyy h:mm a')
      };
      console.log('[DateUtils] UTC -> Gregorian:', result);
      return result;
    }
    
    if (calendarType === 'Hebrew') {
      const jsDate = dt.toJSDate();
      const hdate = new HDate(jsDate);
      
      const result = {
        year: hdate.getFullYear(),
        month: hdate.getMonth(),
        day: hdate.getDate(),
        hour: dt.hour,
        minute: dt.minute,
        weekday: dt.weekday % 7,
        formatted: hdate.toString()
      };
      console.log('[DateUtils] UTC -> Hebrew:', result);
      return result;
    }
    
    if (calendarType === 'Islamic') {
      const hijriDate = moment(dt.toJSDate()).format('iYYYY-iMM-iDD');
      const parts = hijriDate.split('-');
      
      const result = {
        year: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10),
        day: parseInt(parts[2], 10),
        hour: dt.hour,
        minute: dt.minute,
        weekday: dt.weekday % 7,
        formatted: moment(dt.toJSDate()).format('iMMMM iD, iYYYY')
      };
      console.log('[DateUtils] UTC -> Islamic:', result);
      return result;
    }
    
    if (calendarType === 'Chinese') {
      const solar = Solar.fromDate(dt.toJSDate());
      const lunar = solar.getLunar();
      
      const result = {
        year: lunar.getYear(),
        month: lunar.getMonth(),
        day: lunar.getDay(),
        hour: dt.hour,
        minute: dt.minute,
        weekday: dt.weekday % 7,
        formatted: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`
      };
      console.log('[DateUtils] UTC -> Chinese:', result);
      return result;
    }
    
    throw new Error(`Unsupported calendar type: ${calendarType}`);
  } catch (error) {
    console.error('[DateUtils] Error converting UTC to calendar date:', error);
    throw error;
  }
}

/**
 * Format a UTC timestamp for display in the user's chosen calendar
 * 
 * @param utcMillis - Unix timestamp in milliseconds (UTC)
 * @param calendarType - Calendar system to use
 * @param format - Format string (Luxon format tokens for Gregorian, or 'long'/'short')
 * @param timezone - Local timezone (defaults to device timezone)
 * @returns Formatted date string
 */
export function formatDateInCalendar(
  utcMillis: number,
  calendarType: CalendarType = 'Gregorian',
  format: string = 'long',
  timezone?: string
): string {
  const localZone = timezone || getLocalTimezone();
  
  try {
    const calendarDate = utcToCalendarDate(utcMillis, calendarType, localZone);
    
    if (format === 'long' || format === 'short') {
      return calendarDate.formatted;
    }
    
    // For Gregorian, support custom Luxon format strings
    if (calendarType === 'Gregorian') {
      const dt = DateTime.fromMillis(utcMillis, { zone: localZone });
      return dt.toFormat(format);
    }
    
    return calendarDate.formatted;
  } catch (error) {
    console.error('[DateUtils] Error formatting date:', error);
    return 'Invalid Date';
  }
}

/**
 * Get the current date/time as a UTC timestamp
 * 
 * @returns Unix timestamp in milliseconds (UTC)
 */
export function nowUTC(): number {
  return DateTime.now().toUTC().toMillis();
}

/**
 * Get local time components for scheduling alarms
 * Converts UTC timestamp back to local time for expo-notifications
 * 
 * @param utcMillis - Unix timestamp in milliseconds (UTC)
 * @param timezone - Local timezone (defaults to device timezone)
 * @returns Object with year, month, day, hour, minute for alarm scheduling
 */
export function getLocalTimeComponents(
  utcMillis: number,
  timezone?: string
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const localZone = timezone || getLocalTimezone();
  const dt = DateTime.fromMillis(utcMillis, { zone: localZone });
  
  if (!dt.isValid) {
    console.error('[DateUtils] Invalid UTC timestamp for alarm:', dt.invalidReason);
    throw new Error(`Invalid UTC timestamp: ${dt.invalidReason}`);
  }
  
  const components = {
    year: dt.year,
    month: dt.month,
    day: dt.day,
    hour: dt.hour,
    minute: dt.minute,
    second: dt.second
  };
  
  console.log('[DateUtils] Local time components for alarm:', components);
  return components;
}

/**
 * Check if a date is valid in a specific calendar
 * Handles edge cases like Feb 30, invalid Hebrew months, etc.
 * 
 * @param year - Year in the calendar
 * @param month - Month (1-based) in the calendar
 * @param day - Day in the calendar
 * @param calendarType - Calendar system to validate against
 * @returns true if valid, false otherwise
 */
export function isValidCalendarDate(
  year: number,
  month: number,
  day: number,
  calendarType: CalendarType = 'Gregorian'
): boolean {
  try {
    if (calendarType === 'Gregorian') {
      const dt = DateTime.fromObject({ year, month, day });
      return dt.isValid;
    }
    
    if (calendarType === 'Hebrew') {
      try {
        const hdate = new HDate(day, hebrewMonths[month - 1] || month, year);
        return hdate.greg() !== null;
      } catch {
        return false;
      }
    }
    
    if (calendarType === 'Islamic') {
      const hijriDate = moment(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`, 'iYYYY-iMM-iDD');
      return hijriDate.isValid();
    }
    
    if (calendarType === 'Chinese') {
      try {
        const lunar = Lunar.fromYmd(year, month, day);
        return lunar.getSolar() !== null;
      } catch {
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.error('[DateUtils] Error validating calendar date:', error);
    return false;
  }
}

/**
 * Get the maximum number of days in a month for a specific calendar
 * 
 * @param year - Year in the calendar
 * @param month - Month (1-based) in the calendar
 * @param calendarType - Calendar system
 * @returns Number of days in the month
 */
export function getDaysInMonth(
  year: number,
  month: number,
  calendarType: CalendarType = 'Gregorian'
): number {
  try {
    if (calendarType === 'Gregorian') {
      const dt = DateTime.fromObject({ year, month, day: 1 });
      return dt.daysInMonth || 31;
    }
    
    if (calendarType === 'Hebrew') {
      const hdate = new HDate(1, hebrewMonths[month - 1] || month, year);
      return hdate.daysInMonth();
    }
    
    if (calendarType === 'Islamic') {
      // Islamic months alternate between 29 and 30 days
      const hijriDate = moment(`${year}-${month.toString().padStart(2, '0')}-01`, 'iYYYY-iMM-DD');
      return hijriDate.iDaysInMonth();
    }
    
    if (calendarType === 'Chinese') {
      // Chinese lunar months are either 29 or 30 days
      const lunar = Lunar.fromYmd(year, month, 1);
      // Try to create the next month to determine length
      try {
        Lunar.fromYmd(year, month, 30);
        return 30;
      } catch {
        return 29;
      }
    }
    
    return 31;
  } catch (error) {
    console.error('[DateUtils] Error getting days in month:', error);
    return 31;
  }
}

/**
 * Check if DST is in effect for a given timestamp in a timezone
 * 
 * @param utcMillis - Unix timestamp in milliseconds (UTC)
 * @param timezone - Timezone to check (defaults to device timezone)
 * @returns true if DST is in effect
 */
export function isDSTInEffect(utcMillis: number, timezone?: string): boolean {
  const localZone = timezone || getLocalTimezone();
  const dt = DateTime.fromMillis(utcMillis, { zone: localZone });
  return dt.isInDST;
}

/**
 * Get timezone offset in minutes for a given timestamp
 * Useful for debugging timezone issues
 * 
 * @param utcMillis - Unix timestamp in milliseconds (UTC)
 * @param timezone - Timezone to check (defaults to device timezone)
 * @returns Offset in minutes from UTC
 */
export function getTimezoneOffset(utcMillis: number, timezone?: string): number {
  const localZone = timezone || getLocalTimezone();
  const dt = DateTime.fromMillis(utcMillis, { zone: localZone });
  return dt.offset;
}

/**
 * Debug helper: Log comprehensive date information
 * Use this to verify conversions are working correctly
 * 
 * @param utcMillis - Unix timestamp to debug
 * @param calendarType - Calendar to display
 * @param label - Label for the log entry
 */
export function debugDateConversion(
  utcMillis: number,
  calendarType: CalendarType = 'Gregorian',
  label: string = 'Date Debug'
): void {
  const localZone = getLocalTimezone();
  const dt = DateTime.fromMillis(utcMillis, { zone: localZone });
  const calendarDate = utcToCalendarDate(utcMillis, calendarType);
  
  console.log(`\n========== ${label} ==========`);
  console.log('UTC Timestamp:', utcMillis);
  console.log('UTC ISO:', DateTime.fromMillis(utcMillis, { zone: 'UTC' }).toISO());
  console.log('Local Timezone:', localZone);
  console.log('Local ISO:', dt.toISO());
  console.log('DST Active:', dt.isInDST);
  console.log('Offset (minutes):', dt.offset);
  console.log(`${calendarType} Date:`, calendarDate);
  console.log('Formatted:', formatDateInCalendar(utcMillis, calendarType));
  console.log('====================================\n');
}
