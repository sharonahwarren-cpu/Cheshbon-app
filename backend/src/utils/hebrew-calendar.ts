import { HDate, Locale } from '@hebcal/core';

/**
 * Hebrew calendar month names (transliterated)
 */
const HEBREW_MONTHS = [
  'Tishrei',
  'Cheshvan',
  'Kislev',
  'Tevet',
  'Shevat',
  'Adar',
  'Nisan',
  'Iyar',
  'Sivan',
  'Tammuz',
  'Av',
  'Elul',
];

/**
 * Get Hebrew date from Gregorian date
 */
export function getHebrewDate(gregorianDate: Date): { year: number; month: number; day: number } {
  const hdate = new HDate(gregorianDate);
  return {
    year: hdate.getFullYear(),
    month: hdate.getMonth(),
    day: hdate.getDate(),
  };
}

/**
 * Convert Hebrew month/day to Gregorian date for a given Hebrew year
 */
export function hebrewToGregorian(hebrewMonth: number, hebrewDay: number, hebrewYear: number): Date {
  try {
    const hdate = new HDate(hebrewDay, hebrewMonth, hebrewYear);
    return hdate.greg();
  } catch (error) {
    console.error(`Error converting Hebrew date ${hebrewDay}/${hebrewMonth}/${hebrewYear}:`, error);
    return new Date();
  }
}

/**
 * Get Hebrew month name
 */
export function getHebrewMonthName(month: number): string {
  return HEBREW_MONTHS[month - 1] || `Month ${month}`;
}

/**
 * Generate Hebrew date range for a given date
 * Returns an array of Gregorian dates for the specified Hebrew date across multiple years
 */
export function generateHebrewDatesForRange(
  hebrewMonth: number,
  hebrewDay: number,
  startDate: Date,
  endDate: Date
): Date[] {
  const dates: Date[] = [];
  const startHebrew = getHebrewDate(startDate);
  const endHebrew = getHebrewDate(endDate);

  // Iterate through Hebrew years
  for (let hebrewYear = startHebrew.year; hebrewYear <= endHebrew.year + 1; hebrewYear++) {
    try {
      const gregorianDate = hebrewToGregorian(hebrewMonth, hebrewDay, hebrewYear);

      // Only include dates within the requested range
      if (gregorianDate >= startDate && gregorianDate <= endDate) {
        dates.push(gregorianDate);
      }
    } catch (error) {
      // Skip invalid dates (e.g., day 30 in a 29-day month)
      console.warn(`Skipping invalid Hebrew date: ${hebrewDay}/${hebrewMonth}/${hebrewYear}`);
    }
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Check if a Gregorian date falls on a Hebrew calendar date
 */
export function isHebrewDateMatch(gregorianDate: Date, hebrewMonth: number, hebrewDay: number): boolean {
  const hdate = getHebrewDate(gregorianDate);
  return hdate.month === hebrewMonth && hdate.day === hebrewDay;
}
