import { HDate, Locale, HebrewCalendar } from '@hebcal/core';

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

/**
 * Get all occurrences of a Hebrew calendar event (e.g., "Rosh Hashana", "Rosh Chodesh") within a date range
 * Uses EXACT string matching to prevent confusion between similar event names
 * (e.g., "Rosh Hashana" should NOT match "Rosh Chodesh")
 */
export function getHebrewCalendarEventDates(
  eventName: string,
  startDate: Date,
  endDate: Date
): Date[] {
  const dates: Date[] = [];

  try {
    // Create a Hebrew calendar instance for the range
    const hcal = new HebrewCalendar({
      isHebrewYear: false,
      noModern: false,
      noMinorFast: true,
      noMinorHoliday: false,
      noHolidays: false,
      sedrot: false,
    });

    // Get all events in the range
    const events = hcal.between(startDate, endDate);

    // Filter for exact event name match (case-insensitive comparison)
    for (const event of events) {
      const eventDesc = event.getDesc();
      // Use EXACT matching with === comparison (case-insensitive)
      if (eventDesc && eventDesc.toLowerCase() === eventName.toLowerCase()) {
        const eventDate = event.getDate().toJSDate();
        if (eventDate >= startDate && eventDate <= endDate) {
          dates.push(eventDate);
        }
      }
    }
  } catch (error) {
    console.error(`Error getting Hebrew calendar events for "${eventName}":`, error);
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Check if a Gregorian date matches a specific Hebrew calendar event name
 * Uses EXACT string matching to prevent confusion between similar event names
 */
export function isHebrewEventMatch(gregorianDate: Date, eventName: string): boolean {
  try {
    // Create a Hebrew calendar instance for just this date
    const hcal = new HebrewCalendar({
      isHebrewYear: false,
      noModern: false,
      noMinorFast: true,
      noMinorHoliday: false,
      noHolidays: false,
      sedrot: false,
    });

    // Get events for this specific date
    const endDate = new Date(gregorianDate);
    endDate.setDate(endDate.getDate() + 1);

    const events = hcal.between(gregorianDate, endDate);

    // Check for exact event name match (case-insensitive)
    for (const event of events) {
      const eventDesc = event.getDesc();
      if (eventDesc && eventDesc.toLowerCase() === eventName.toLowerCase()) {
        return true;
      }
    }
  } catch (error) {
    console.error(`Error checking Hebrew calendar event match for "${eventName}":`, error);
  }

  return false;
}
