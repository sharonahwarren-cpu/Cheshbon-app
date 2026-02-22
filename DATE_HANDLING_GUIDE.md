
# Date & Calendar Handling System - Implementation Guide

## Overview

This document describes the comprehensive date and calendar handling system implemented to fix timezone and alternative calendar issues in the Cheshbon app.

## Core Principles

1. **Always store dates as UTC timestamps** (Unix milliseconds)
2. **Interpret user input in local timezone** (e.g., Australia/Melbourne)
3. **Convert back to local timezone for display**
4. **Handle calendar-specific edge cases** (Hebrew leap years, lunar months, DST)

## Architecture

### 1. Date Utilities (`utils/dateUtils.ts`)

Core functions for date conversion and validation:

- `getLocalTimezone()` - Detects device timezone using Intl API
- `calendarDateToUTC()` - Converts calendar date/time to UTC timestamp for storage
- `utcToCalendarDate()` - Converts UTC timestamp back to calendar date for display
- `formatDateInCalendar()` - Formats dates in user's chosen calendar
- `isValidCalendarDate()` - Validates dates in specific calendars
- `getDaysInMonth()` - Gets max days for calendar-specific months
- `debugDateConversion()` - Debug helper for verifying conversions

**Supported Calendars:**
- Gregorian (default)
- Hebrew (with leap year support via @hebcal/core)
- Chinese Lunar (via lunar-javascript)
- Islamic/Hijri (via moment-hijri with Umm al-Qura)

### 2. Alarm Utilities (`utils/alarmUtils.ts`)

Handles notification scheduling with timezone awareness:

- `requestNotificationPermissions()` - Request notification access
- `scheduleAlarm()` - Schedule one-time or repeating alarms
- `scheduleCalendarAlarm()` - Schedule alarms with calendar-specific recurrence
- `cancelAlarm()` - Cancel specific alarm
- `getAllScheduledAlarms()` - Get all scheduled notifications

**Features:**
- Converts UTC timestamps to local time components for expo-notifications
- Supports daily, weekly, monthly, yearly repeats
- Handles DST transitions automatically
- Calendar-aware monthly/yearly recurrence

### 3. Debug Screen (`app/date-debug.tsx`)

Test screen for verifying date conversions:

- Input dates in any calendar
- Convert to UTC and verify storage format
- Convert back to calendar and verify display
- Test current time across calendars
- Test edge cases (midnight AEDT, DST transitions)
- View timezone info and offsets

## Usage Examples

### Converting User Input to UTC for Storage

```typescript
import { calendarDateToUTC, getLocalTimezone } from '@/utils/dateUtils';

// User selects: Feb 22, 2025 at 9:00 AM in Hebrew calendar
const utcTimestamp = calendarDateToUTC(
  5785,  // Hebrew year
  6,     // Adar (month)
  15,    // Day
  9,     // Hour
  0,     // Minute
  'Hebrew',
  getLocalTimezone() // e.g., 'Australia/Melbourne'
);

// Store utcTimestamp in database
await authenticatedPost('/api/goals', {
  title: 'My Goal',
  startDate: new Date(utcTimestamp).toISO8601(), // "2025-02-21T22:00:00.000Z"
});
```

### Displaying Stored UTC Timestamp

```typescript
import { utcToCalendarDate, formatDateInCalendar } from '@/utils/dateUtils';

// Fetch goal from database
const goal = await authenticatedGet('/api/goals/123');
const utcTimestamp = new Date(goal.startDate).getTime();

// Convert to user's calendar for display
const calendarDate = utcToCalendarDate(
  utcTimestamp,
  'Hebrew',
  getLocalTimezone()
);

console.log(calendarDate);
// { year: 5785, month: 6, day: 15, hour: 9, minute: 0, formatted: "15 Adar 5785" }

// Or format directly
const formatted = formatDateInCalendar(utcTimestamp, 'Hebrew', 'long');
console.log(formatted); // "15 Adar 5785"
```

### Scheduling an Alarm

```typescript
import { scheduleAlarm, getLocalTimeComponents } from '@/utils/alarmUtils';
import { calendarDateToUTC } from '@/utils/dateUtils';

// User wants alarm at 9:00 AM on Adar 15, 5785 (Hebrew)
const utcTimestamp = calendarDateToUTC(5785, 6, 15, 9, 0, 'Hebrew');

// Schedule the alarm
await scheduleAlarm({
  id: 'goal-alarm-123',
  title: 'Goal Reminder',
  body: 'Time to work on your goal!',
  utcTimestamp,
  repeat: 'daily', // or 'weekly', 'monthly', 'yearly', 'none'
  calendarType: 'Hebrew',
});
```

### Validating User Input

```typescript
import { isValidCalendarDate, getDaysInMonth } from '@/utils/dateUtils';

// Check if Feb 30 is valid in Gregorian
const isValid = isValidCalendarDate(2025, 2, 30, 'Gregorian');
console.log(isValid); // false

// Get max days in Adar (Hebrew leap year)
const maxDays = getDaysInMonth(5784, 6, 'Hebrew');
console.log(maxDays); // 30 (Adar I in leap year)
```

## Backend Integration

### Database Schema

All date/time columns use `timestamptz` (timezone-aware timestamps):

```sql
CREATE TABLE goals (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  start_date TIMESTAMPTZ,  -- UTC timestamp
  end_date TIMESTAMPTZ,    -- UTC timestamp (nullable)
  calendar_type TEXT,      -- 'Gregorian', 'Hebrew', 'Chinese', 'Islamic'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  timezone TEXT DEFAULT 'UTC',  -- IANA timezone (e.g., 'Australia/Melbourne')
  alternative_calendar TEXT     -- 'gregorian', 'hebrew', 'chinese', 'islamic'
);
```

### API Format

**Request (Frontend → Backend):**
```json
{
  "title": "My Goal",
  "startDate": "2025-02-21T22:00:00.000Z",  // ISO 8601 UTC
  "endDate": "2025-12-31T13:00:00.000Z",
  "calendarType": "Hebrew"
}
```

**Response (Backend → Frontend):**
```json
{
  "id": "123",
  "title": "My Goal",
  "startDate": "2025-02-21T22:00:00.000Z",  // ISO 8601 UTC
  "endDate": "2025-12-31T13:00:00.000Z",
  "calendarType": "Hebrew",
  "createdAt": "2025-02-20T05:30:00.000Z",
  "updatedAt": "2025-02-21T08:15:00.000Z"
}
```

## Edge Cases Handled

### 1. DST Transitions (Australia)

```typescript
// Melbourne switches to AEDT (UTC+11) in October
// User sets alarm for 2:00 AM on Oct 5, 2025 (during DST transition)
const utcTimestamp = calendarDateToUTC(2025, 10, 5, 2, 0, 'Gregorian', 'Australia/Melbourne');

// Luxon handles DST automatically
// Alarm will fire at correct local time regardless of DST
```

### 2. Hebrew Leap Years

```typescript
// 5784 is a Hebrew leap year (has Adar I and Adar II)
const daysInAdarI = getDaysInMonth(5784, 6, 'Hebrew');  // 30 days
const daysInAdarII = getDaysInMonth(5784, 7, 'Hebrew'); // 29 days

// 5785 is NOT a leap year (only one Adar)
const daysInAdar = getDaysInMonth(5785, 6, 'Hebrew');   // 29 days
```

### 3. Invalid Dates

```typescript
// Feb 30 doesn't exist
const isValid = isValidCalendarDate(2025, 2, 30, 'Gregorian');
console.log(isValid); // false

// Prevents crashes and shows user-friendly error
```

### 4. Timezone Travel

```typescript
// User sets goal in Melbourne (UTC+11)
const utcTimestamp = calendarDateToUTC(2025, 2, 22, 9, 0, 'Gregorian', 'Australia/Melbourne');
// Stored as: 2025-02-21T22:00:00.000Z

// User travels to New York (UTC-5)
const nyDate = utcToCalendarDate(utcTimestamp, 'Gregorian', 'America/New_York');
console.log(nyDate); // { year: 2025, month: 2, day: 21, hour: 17, minute: 0 }
// Correctly shows 5:00 PM in New York (same moment in time)
```

## Testing

### Manual Testing with Debug Screen

1. Navigate to `/date-debug` in the app
2. Select a calendar type (Gregorian, Hebrew, Chinese, Islamic)
3. Enter a date/time
4. Click "Convert to UTC" - verify timestamp is correct
5. Click "Convert from UTC" - verify it converts back correctly
6. Check console logs for detailed debug info

### Test Cases

**Test 1: Midnight AEDT**
- Input: Feb 22, 2025 00:00 Melbourne
- Expected UTC: Feb 21, 2025 13:00 UTC
- Verify: DST offset is +11 hours

**Test 2: Hebrew Leap Year**
- Input: 15 Adar I, 5784 (leap year)
- Verify: Converts to correct Gregorian date
- Verify: Adar I has 30 days

**Test 3: Islamic Month Length**
- Input: 30 Ramadan, 1446
- Verify: Valid date (Ramadan has 30 days)

**Test 4: Chinese Lunar New Year**
- Input: 1st day of 1st month, 2025
- Verify: Converts to correct Gregorian date (Jan 29, 2025)

## Migration Guide

### Updating Existing Code

**Before (Incorrect):**
```typescript
// ❌ Storing local time as string
const startDate = new Date(2025, 1, 22, 9, 0).toISOString();
await authenticatedPost('/api/goals', { startDate });
```

**After (Correct):**
```typescript
// ✅ Convert to UTC timestamp first
import { calendarDateToUTC, getLocalTimezone } from '@/utils/dateUtils';

const utcTimestamp = calendarDateToUTC(2025, 2, 22, 9, 0, 'Gregorian', getLocalTimezone());
const startDate = new Date(utcTimestamp).toISOString();
await authenticatedPost('/api/goals', { startDate });
```

**Before (Incorrect):**
```typescript
// ❌ Displaying UTC time directly
<Text>{new Date(goal.startDate).toLocaleString()}</Text>
```

**After (Correct):**
```typescript
// ✅ Convert to user's calendar and timezone
import { formatDateInCalendar } from '@/utils/dateUtils';

const utcTimestamp = new Date(goal.startDate).getTime();
const formatted = formatDateInCalendar(utcTimestamp, userCalendar, 'long');
<Text>{formatted}</Text>
```

## Dependencies

- `luxon` - Timezone-aware date handling
- `@hebcal/core` - Hebrew calendar support
- `moment-hijri` - Islamic/Hijri calendar (Umm al-Qura)
- `lunar-javascript` - Chinese lunar calendar
- `expo-notifications` - Alarm scheduling

## Debugging

### Enable Debug Logs

All date utilities log to console with `[DateUtils]` prefix:

```typescript
import { debugDateConversion } from '@/utils/dateUtils';

// Log comprehensive date info
debugDateConversion(utcTimestamp, 'Hebrew', 'My Goal Start Date');
```

### Common Issues

**Issue: Dates off by one day**
- Cause: Not converting to UTC before storage
- Fix: Use `calendarDateToUTC()` before sending to backend

**Issue: Alarms firing at wrong time**
- Cause: Not using local time components
- Fix: Use `getLocalTimeComponents()` for expo-notifications

**Issue: Hebrew dates showing wrong month**
- Cause: Not handling leap years
- Fix: Use `getDaysInMonth()` and `isValidCalendarDate()`

**Issue: DST causing time shifts**
- Cause: Using naive Date objects
- Fix: Use Luxon's timezone-aware DateTime

## Future Enhancements

1. **Recurring Alarms**: Implement calendar-specific recurrence (e.g., "every Rosh Chodesh")
2. **Timezone Override**: Allow users to set custom timezone in settings
3. **Calendar Conversion**: Show dates in multiple calendars simultaneously
4. **Holiday Integration**: Integrate with @hebcal/core for Jewish holidays
5. **Prayer Times**: Add Islamic prayer time calculations

## Support

For issues or questions:
1. Check console logs with `[DateUtils]` prefix
2. Use `/date-debug` screen to test conversions
3. Verify backend is returning ISO 8601 UTC strings
4. Ensure user preferences include timezone and calendar type

---

**Last Updated:** February 22, 2025
**Version:** 1.0.0
