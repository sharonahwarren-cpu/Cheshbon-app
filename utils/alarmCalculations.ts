
import { DateTime } from 'luxon';
import SunCalc from 'suncalc';
import { HDate, HebrewCalendar, months } from '@hebcal/core';
import type { Alarm, AlarmTrigger, AstronomicalEvent } from '@/types/alarm';

/**
 * Calculate astronomical times for a given date and location
 */
export function calculateAstronomicalTimes(
  date: Date,
  latitude: number,
  longitude: number
): Record<AstronomicalEvent, Date> {
  console.log('Calculating astronomical times for:', { date, latitude, longitude });
  
  const times = SunCalc.getTimes(date, latitude, longitude);
  
  return {
    sunrise: times.sunrise,
    sunset: times.sunset,
    dawn: times.dawn,
    dusk: times.dusk,
    solarNoon: times.solarNoon,
    goldenHour: times.goldenHour,
  };
}

/**
 * Calculate next Rosh Chodesh date
 */
export function calculateNextRoshChodesh(fromDate: Date = new Date()): Date {
  console.log('Calculating next Rosh Chodesh from:', fromDate);
  
  const hDate = new HDate(fromDate);
  let nextMonth = hDate.getMonth() + 1;
  let nextYear = hDate.getFullYear();
  
  // Handle year rollover
  const monthsInYear = hDate.isLeapYear() ? 13 : 12;
  if (nextMonth > monthsInYear) {
    nextMonth = 1;
    nextYear += 1;
  }
  
  // Rosh Chodesh is the first day of the Hebrew month
  const nextRoshChodesh = new HDate(1, nextMonth, nextYear);
  const gregorianDate = nextRoshChodesh.greg();
  
  console.log('Next Rosh Chodesh:', gregorianDate);
  return gregorianDate;
}

/**
 * Calculate next Chinese New Year
 */
export function calculateNextChineseNewYear(fromDate: Date = new Date()): Date {
  console.log('Calculating next Chinese New Year from:', fromDate);
  
  // Chinese New Year falls between January 21 and February 20
  const currentYear = fromDate.getFullYear();
  const currentMonth = fromDate.getMonth();
  
  // Approximate dates for Chinese New Year (would need lunar-javascript for exact calculation)
  // For now, use a simple approximation
  let targetYear = currentYear;
  if (currentMonth > 1) { // After February
    targetYear = currentYear + 1;
  }
  
  // Placeholder: February 1st (would need proper lunar calendar calculation)
  const chineseNewYear = new Date(targetYear, 1, 1);
  console.log('Next Chinese New Year (approximate):', chineseNewYear);
  return chineseNewYear;
}

/**
 * Calculate next Islamic event (e.g., Ramadan)
 */
export function calculateNextIslamicEvent(eventType: string, fromDate: Date = new Date()): Date {
  console.log('Calculating next Islamic event:', eventType, 'from:', fromDate);
  
  // Placeholder: Would need moment-hijri for accurate Islamic calendar calculations
  // For now, return a date 30 days in the future
  const nextEvent = new Date(fromDate);
  nextEvent.setDate(nextEvent.getDate() + 30);
  
  console.log('Next Islamic event (placeholder):', nextEvent);
  return nextEvent;
}

/**
 * Apply time constraints (min/max) to a calculated time
 */
export function applyTimeConstraints(
  calculatedTime: Date,
  timezone: string,
  minTime?: string, // e.g., "06:00"
  maxTime?: string  // e.g., "22:00"
): Date {
  console.log('Applying time constraints:', { calculatedTime, timezone, minTime, maxTime });
  
  let dt = DateTime.fromJSDate(calculatedTime, { zone: timezone });
  
  if (minTime) {
    const [minHour, minMinute] = minTime.split(':').map(Number);
    const minDateTime = dt.set({ hour: minHour, minute: minMinute, second: 0, millisecond: 0 });
    
    if (dt < minDateTime) {
      console.log('Clamping to minimum time:', minTime);
      dt = minDateTime;
    }
  }
  
  if (maxTime) {
    const [maxHour, maxMinute] = maxTime.split(':').map(Number);
    const maxDateTime = dt.set({ hour: maxHour, minute: maxMinute, second: 0, millisecond: 0 });
    
    if (dt > maxDateTime) {
      console.log('Clamping to maximum time:', maxTime);
      dt = maxDateTime;
    }
  }
  
  return dt.toJSDate();
}

/**
 * Calculate the next trigger time for an alarm
 */
export function calculateNextTriggerTime(
  alarm: Alarm,
  currentLocation?: { latitude: number; longitude: number }
): Date | null {
  console.log('Calculating next trigger time for alarm:', alarm.title);
  
  const now = new Date();
  const timezone = alarm.timezone;
  
  // Use alarm location or current location or fallback
  const latitude = alarm.location?.latitude || currentLocation?.latitude || -37.8136; // Melbourne default
  const longitude = alarm.location?.longitude || currentLocation?.longitude || 144.9631;
  
  let baseDate: Date = now;
  
  // Calculate base date for calendar-based events
  if (alarm.calendarType && alarm.eventType) {
    switch (alarm.calendarType) {
      case 'hebrew':
        if (alarm.eventType === 'roshChodesh') {
          baseDate = calculateNextRoshChodesh(now);
        }
        break;
      case 'chinese':
        baseDate = calculateNextChineseNewYear(now);
        break;
      case 'islamic':
        baseDate = calculateNextIslamicEvent(alarm.eventType, now);
        break;
      default:
        break;
    }
  }
  
  // Process triggers
  const triggerTimes: Date[] = [];
  
  for (const trigger of alarm.triggers) {
    let triggerTime: Date | null = null;
    
    switch (trigger.type) {
      case 'time':
        // Fixed time trigger
        if (trigger.value) {
          const [hour, minute] = trigger.value.split(':').map(Number);
          const dt = DateTime.fromJSDate(baseDate, { zone: timezone }).set({
            hour,
            minute,
            second: 0,
            millisecond: 0,
          });
          triggerTime = dt.toJSDate();
        }
        break;
        
      case 'astronomical':
        // Astronomical event trigger (sunrise, sunset, etc.)
        if (trigger.value) {
          const astroTimes = calculateAstronomicalTimes(baseDate, latitude, longitude);
          const astroEvent = trigger.value as AstronomicalEvent;
          triggerTime = astroTimes[astroEvent];
          
          // Apply min/max constraints
          if (triggerTime && (trigger.min || trigger.max)) {
            triggerTime = applyTimeConstraints(triggerTime, timezone, trigger.min, trigger.max);
          }
        }
        break;
        
      case 'location':
        // Location-based trigger (handled by geofencing in background)
        // For calculation purposes, we'll use the current time
        triggerTime = baseDate;
        break;
    }
    
    if (triggerTime) {
      triggerTimes.push(triggerTime);
    }
  }
  
  if (triggerTimes.length === 0) {
    console.log('No valid trigger times calculated');
    return null;
  }
  
  // Combine triggers based on logic (AND = latest time, OR = earliest time)
  const hasAndLogic = alarm.triggers.some(t => t.logic === 'AND');
  const nextTrigger = hasAndLogic
    ? new Date(Math.max(...triggerTimes.map(t => t.getTime())))
    : new Date(Math.min(...triggerTimes.map(t => t.getTime())));
  
  // If the calculated time is in the past, and it's recurring, calculate for next occurrence
  if (nextTrigger < now && alarm.recurring) {
    console.log('Trigger time is in the past, calculating next occurrence');
    // For recurring alarms, add appropriate interval
    if (alarm.calendarType === 'hebrew' && alarm.eventType === 'roshChodesh') {
      // Next month
      return calculateNextTriggerTime(
        { ...alarm },
        currentLocation
      );
    }
    // Add one day and recalculate
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return calculateNextTriggerTime(
      { ...alarm },
      currentLocation
    );
  }
  
  console.log('Next trigger time calculated:', nextTrigger);
  return nextTrigger;
}

/**
 * Format next trigger time for display
 */
export function formatNextTriggerTime(
  alarm: Alarm,
  currentLocation?: { latitude: number; longitude: number }
): string {
  const nextTrigger = calculateNextTriggerTime(alarm, currentLocation);
  
  if (!nextTrigger) {
    return 'No trigger time calculated';
  }
  
  const dt = DateTime.fromJSDate(nextTrigger, { zone: alarm.timezone });
  const formatted = dt.toFormat('MMM dd, yyyy \'at\' h:mm a ZZZZ');
  
  // Add trigger condition description
  const conditions: string[] = [];
  for (const trigger of alarm.triggers) {
    if (trigger.type === 'astronomical' && trigger.value) {
      conditions.push(`after ${trigger.value}`);
    } else if (trigger.type === 'location' && trigger.value) {
      conditions.push(`on ${trigger.value}`);
    } else if (trigger.type === 'time' && trigger.value) {
      conditions.push(`at ${trigger.value}`);
    }
  }
  
  const conditionText = conditions.length > 0 ? ` (${conditions.join(' and ')})` : '';
  
  return `Next: ${formatted}${conditionText}`;
}
