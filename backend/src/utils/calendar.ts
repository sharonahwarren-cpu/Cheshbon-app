/**
 * Calendar utility functions for Hebrew, Islamic, Chinese, and Gregorian calendars
 */

import { HDate, months } from '@hebcal/core';

// Hebrew calendar helpers using hebcal library for accuracy
export function isHebrewLeapYear(year: number): boolean {
  return (year * 7 + 1) % 19 < 7;
}

export function getDaysInHebrewMonth(month: number, year: number): number {
  try {
    // Use hebcal to get accurate days in month
    const hdate = new HDate(1, month, year);
    const lastDay = new HDate(1, month === 12 ? 1 : month + 1, month === 12 ? year + 1 : year);
    return lastDay.abs() - hdate.abs();
  } catch {
    // Fallback to approximation if hebcal fails
    const hebrewMonths: Record<number, number> = {
      1: 30, // Tishrei
      2: 29, // Cheshvan (varies)
      3: 30, // Kislev (varies)
      4: 29, // Tevet
      5: 30, // Shevat
      6: 29, // Adar (or first Adar in leap year)
      7: 30, // Adar II (or Adar in non-leap year)
      8: 21, // Nisan
      9: 15, // Iyar
      10: 30, // Sivan
      11: 29, // Tammuz
      12: 30, // Av
      13: 29, // Elul
    };
    return hebrewMonths[month] || 30;
  }
}

// Hebrew month names (1-based indexing)
export const HEBREW_MONTHS = [
  'Tishrei',    // 1
  'Cheshvan',   // 2
  'Kislev',     // 3
  'Tevet',      // 4
  'Shevat',     // 5
  'Adar',       // 6
  'Adar II',    // 7
  'Nisan',      // 8
  'Iyar',       // 9
  'Sivan',      // 10
  'Tammuz',     // 11
  'Av',         // 12
  'Elul',       // 13
];

// Islamic calendar helpers
export function getDaysInIslamicMonth(month: number, year: number): number {
  // Alternate 30 and 29 days, with last month having 29 or 30 based on observation
  return month % 2 === 1 ? 30 : 29;
}

export const ISLAMIC_MONTHS = [
  'Muharram',
  'Safar',
  'Rabi\' al-awwal',
  'Rabi\' al-thani',
  'Jumada al-awwal',
  'Jumada al-thani',
  'Rajab',
  'Sha\'ban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qi\'dah',
  'Dhu al-Hijjah',
];

// Chinese calendar helpers (simplified)
export function getDaysInChineseMonth(month: number, year: number): number {
  // Simplified: assume small months have 29, big months have 30
  // In reality, this requires lunar calculations
  const smallMonths = [2, 4, 6, 8, 10, 12];
  return smallMonths.includes(month) ? 29 : 30;
}

export const CHINESE_MONTHS = [
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
  'Eleventh',
  'Twelfth',
];

// Gregorian month names (0-based indexing for JavaScript Date compatibility)
export const GREGORIAN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Accurate conversion from Gregorian to Hebrew date using hebcal library
 */
export function gregorianToHebrew(date: Date): { month: number; day: number; year: number } {
  try {
    const hdate = new HDate(date);
    return {
      month: hdate.getMonth(),
      day: hdate.getDate(),
      year: hdate.getFullYear(),
    };
  } catch (error) {
    // Fallback to approximation if hebcal fails
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    let hebrewYear = year + 3760;
    if (month < 9) {
      hebrewYear--;
    }
    return { month, day, year: hebrewYear };
  }
}

/**
 * Accurate conversion from Hebrew date to Gregorian date using hebcal library
 */
export function hebrewToGregorian(hebrewYear: number, hebrewMonth: number, hebrewDay: number): Date {
  try {
    const hdate = new HDate(hebrewDay, hebrewMonth, hebrewYear);
    return hdate.toJSDate();
  } catch (error) {
    // If conversion fails, return a date in the approximate range
    const gregorianYear = hebrewYear - 3760;
    return new Date(gregorianYear, 8, 1); // Approximate
  }
}

/**
 * Accurate check if a Hebrew date falls within a range using hebcal library
 */
export function isDateInHebrewRange(
  gregorianDate: Date,
  hebrewMonth: number,
  dayStart: number,
  dayEnd: number
): boolean {
  try {
    const hebrew = gregorianToHebrew(gregorianDate);
    return hebrew.month === hebrewMonth && hebrew.day >= dayStart && hebrew.day <= dayEnd;
  } catch {
    return false;
  }
}

/**
 * Get all occurrences of a Hebrew month/day in a given Gregorian year range
 */
export function getHebrewDateOccurrences(
  hebrewMonth: number,
  hebrewDay: number,
  startYear: number,
  endYear: number
): Date[] {
  const occurrences: Date[] = [];

  try {
    for (let year = startYear; year <= endYear; year++) {
      // Estimate the Hebrew year range that could fall in this Gregorian year
      // Hebrew year is roughly gregorian + 3760, but adjust for month
      const hebrewYearStart = year + 3760 - 1;
      const hebrewYearEnd = year + 3760 + 1;

      for (let hYear = hebrewYearStart; hYear <= hebrewYearEnd; hYear++) {
        try {
          const gregDate = hebrewToGregorian(hYear, hebrewMonth, hebrewDay);
          // Check if this date falls within our target Gregorian year
          if (gregDate.getFullYear() === year) {
            occurrences.push(gregDate);
          }
        } catch {
          // Skip invalid Hebrew dates
        }
      }
    }
  } catch {
    // If all conversions fail, return empty
  }

  return occurrences.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Calculate sunrise/sunset times for astronomical triggers
 * Simplified calculation using algorithm from NOAA
 */
export function calculateSunsetTime(
  date: Date,
  latitude: number,
  longitude: number,
  timezone: string
): Date {
  // Simplified calculation - in production use 'suncalc' library
  // This is a very rough approximation
  const julianDate = getJulianDate(date);
  const noonMinutes = getTimeSinceNoon(date);
  const eqTime = getEquationOfTime(julianDate);
  const solarDec = getSolarDeclination(julianDate);

  const cosH = Math.cos(toRadians(90.833)) / (Math.cos(toRadians(latitude)) * Math.cos(toRadians(solarDec))) -
    Math.tan(toRadians(latitude)) * Math.tan(toRadians(solarDec));

  if (cosH > 1) {
    // Sun never sets
    return new Date(date.getTime() + 24 * 60 * 60 * 1000);
  }
  if (cosH < -1) {
    // Sun never rises
    return new Date(date.getTime());
  }

  const h = toDegrees(Math.acos(cosH));
  const sunset = 720 - 4 * (longitude + h) - eqTime;

  const result = new Date(date);
  result.setHours(0, sunset, 0, 0);
  return result;
}

export function calculateSunriseTime(
  date: Date,
  latitude: number,
  longitude: number,
  timezone: string
): Date {
  const julianDate = getJulianDate(date);
  const solarDec = getSolarDeclination(julianDate);
  const eqTime = getEquationOfTime(julianDate);

  const cosH = Math.cos(toRadians(90.833)) / (Math.cos(toRadians(latitude)) * Math.cos(toRadians(solarDec))) -
    Math.tan(toRadians(latitude)) * Math.tan(toRadians(solarDec));

  if (cosH > 1) {
    return new Date(date.getTime());
  }
  if (cosH < -1) {
    return new Date(date.getTime() + 24 * 60 * 60 * 1000);
  }

  const h = toDegrees(Math.acos(cosH));
  const sunrise = 720 - 4 * (longitude + h) - eqTime;

  const result = new Date(date);
  result.setHours(0, sunrise, 0, 0);
  return result;
}

// Helper functions for sun calculations
function getJulianDate(date: Date): number {
  const a = Math.floor((14 - (date.getMonth() + 1)) / 12);
  const y = date.getFullYear() + 4800 - a;
  const m = (date.getMonth() + 1) + 12 * a - 3;
  return date.getDate() + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function getTimeSinceNoon(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() - 720;
}

function getEquationOfTime(julianDate: number): number {
  const t = (julianDate - 2451545) / 36525;
  const epsilon = 23.439291 - 0.0130042 * t;
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  const m = 357.52911 + 35999.05029 * t - 0.0001536 * t * t;

  const y = Math.tan(toRadians(epsilon / 2));
  const y2 = y * y;

  const sin2l0 = Math.sin(toRadians(2 * l0));
  const sinm = Math.sin(toRadians(m));
  const cos2l0 = Math.cos(toRadians(2 * l0));
  const sin4l0 = Math.sin(toRadians(4 * l0));
  const sin2m = Math.sin(toRadians(2 * m));

  const eq = y2 * sin2l0 - 2 * e * sinm + 4 * e * y2 * sinm * cos2l0 -
    0.5 * y2 * y2 * sin4l0 - 1.25 * e * e * sin2m;

  return toDegrees(eq) * 4;
}

function getSolarDeclination(julianDate: number): number {
  const t = (julianDate - 2451545) / 36525;
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const m = 357.52911 + 35999.05029 * t - 0.0001536 * t * t;
  const c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(toRadians(m)) +
    (0.019993 - 0.000101 * t) * Math.sin(toRadians(2 * m)) +
    0.000029 * Math.sin(toRadians(3 * m));
  const trueL = l0 + c;
  const app = trueL - 0.00569 - 0.00478 * Math.sin(toRadians(125.04 - 1934.136 * t));
  const epsilon = 23.43929111 - 0.0130042 * t - 0.00000016 * t * t + 0.000000504 * t * t * t;

  return toDegrees(Math.asin(Math.sin(toRadians(epsilon)) * Math.sin(toRadians(app))));
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}
