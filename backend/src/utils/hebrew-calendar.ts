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
 * Normalize event names for comparison
 * Removes spaces, hyphens, and apostrophes and converts to lowercase
 */
function normalizeEventName(name: string): string {
  return name.toLowerCase().replace(/[\s\-']/g, '');
}

/**
 * Check if a normalized event description matches the normalized search term
 * Handles multi-day events like "Rosh Hashana", "Rosh Hashana II", "Rosh Hashana 5786"
 */
function eventNameMatches(eventDesc: string, normalizedSearchTerm: string): boolean {
  const normalizedDesc = normalizeEventName(eventDesc);

  // Handle "Rosh Hashana" / "Rosh Hashanah" - match variations but not "Rosh Chodesh"
  if (normalizedSearchTerm === 'roshhashana' || normalizedSearchTerm === 'roshhashanah') {
    return normalizedDesc.startsWith('roshhashana') || normalizedDesc.startsWith('roshhashanah');
  }

  // Handle "Rosh Chodesh" - match only Rosh Chodesh variations
  if (normalizedSearchTerm === 'roshchodesh') {
    return normalizedDesc.startsWith('roshchodesh');
  }

  // For other events, use startsWith to catch multi-day events
  return normalizedDesc.startsWith(normalizedSearchTerm);
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
    // Normalize the search term once
    const normalizedSearch = normalizeEventName(eventName);

    // Get all events in the range using the correct HebrewCalendar.calendar() method
    const events = HebrewCalendar.calendar({
      start: startDate,
      end: endDate,
      isHebrewYear: false,
      sedrot: false,
      omer: false,
      shabbat: false,
      noHolidays: false,
    });

    // Filter for matching event names
    for (const event of events) {
      const eventDesc = event.getDesc();
      if (eventDesc && eventNameMatches(eventDesc, normalizedSearch)) {
        const eventDate = event.getDate().toJSDate();
        // Ensure the date is within the requested range
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
    // Normalize the search term once
    const normalizedSearch = normalizeEventName(eventName);

    // Check a range from day before to day after to catch multi-day events
    const startDate = new Date(gregorianDate);
    startDate.setDate(startDate.getDate() - 1);

    const endDate = new Date(gregorianDate);
    endDate.setDate(endDate.getDate() + 1);

    // Get events in the range using the correct HebrewCalendar.calendar() method
    const events = HebrewCalendar.calendar({
      start: startDate,
      end: endDate,
      isHebrewYear: false,
      sedrot: false,
      omer: false,
      shabbat: false,
      noHolidays: false,
    });

    // Check for exact event name match on the specific date
    for (const event of events) {
      const eventDesc = event.getDesc();
      const eventDate = event.getDate().toJSDate();

      // Only match if the event matches AND falls on the exact date being checked
      if (
        eventDesc &&
        eventNameMatches(eventDesc, normalizedSearch) &&
        eventDate.toDateString() === gregorianDate.toDateString()
      ) {
        return true;
      }
    }
  } catch (error) {
    console.error(`Error checking Hebrew calendar event match for "${eventName}":`, error);
  }

  return false;
}
