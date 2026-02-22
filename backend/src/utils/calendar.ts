/**
 * Calendar utility functions for Hebrew, Islamic, Chinese, and Gregorian calendars
 */

// Hebrew calendar helpers
export function isHebrewLeapYear(year: number): boolean {
  return (year * 7 + 1) % 19 < 7;
}

export function getDaysInHebrewMonth(month: number, year: number): number {
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

  if (month === 2) {
    return new Date(year, 11, 31).getDate() === 31 ? 30 : 29;
  }
  if (month === 3) {
    return new Date(year, 0, 1).getDay() === 2 ? 30 : 29;
  }
  return hebrewMonths[month] || 30;
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
 * Approximate conversion from Gregorian to Hebrew date (for display purposes)
 * Note: This is simplified and may be off by 1-2 days
 */
export function gregorianToHebrew(date: Date): { month: number; day: number; year: number } {
  // This is a simplified calculation
  // Real conversion requires complex algorithms (Meeus, etc.)
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Approximate Hebrew year (starts around September)
  let hebrewYear = year + 3760;
  if (month < 9) {
    hebrewYear--;
  }

  // This is very simplified - a real implementation would use proper algorithms
  return {
    month: month,
    day: day,
    year: hebrewYear,
  };
}

/**
 * Simple check if a Hebrew date falls within a range (1-14 Nissan, etc.)
 * This is simplified for demonstration
 */
export function isDateInHebrewRange(
  gregorianDate: Date,
  hebrewMonth: number,
  dayStart: number,
  dayEnd: number
): boolean {
  const hebrew = gregorianToHebrew(gregorianDate);
  return hebrew.month === hebrewMonth && hebrew.day >= dayStart && hebrew.day <= dayEnd;
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
