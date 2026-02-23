# Schedule Summary Endpoint Examples

## Overview
The `GET /api/goals/:id/schedule-summary` endpoint generates human-readable descriptions of goal schedules along with the next 3-5 occurrences formatted for display.

## Endpoint Details

**URL:** `GET /api/goals/:id/schedule-summary?occurrences=3`

**Query Parameters:**
- `occurrences` (optional): Number of occurrences to display (default: 3, max: 10)

**Response Format:**
```json
{
  "goalId": "550e8400-e29b-41d4-a716-446655440000",
  "goalTitle": "Morning Prayer",
  "summary": "Scheduled daily at 6:30 AM",
  "nextOccurrences": [
    {
      "date": "Monday, February 24, 2025 (15 Adar, 5785)",
      "source": {
        "section": "Daily",
        "details": "Every day"
      }
    },
    {
      "date": "Tuesday, February 25, 2025 (16 Adar, 5785)",
      "source": {
        "section": "Daily",
        "details": "Every day"
      }
    },
    {
      "date": "Wednesday, February 26, 2025 (17 Adar, 5785)",
      "source": {
        "section": "Daily",
        "details": "Every day"
      }
    }
  ],
  "recurrenceType": "daily",
  "calendarType": "hebrew"
}
```

## Schedule Summary Examples

### Daily Schedules

**Single Time**
```json
{
  "summary": "Scheduled daily at 6:30 AM",
  "nextOccurrences": [
    "Monday, February 24, 2025",
    "Tuesday, February 25, 2025",
    "Wednesday, February 26, 2025"
  ]
}
```

**Multiple Times**
```json
{
  "summary": "Scheduled daily at 6:30 AM, 12:00 PM, 6:00 PM",
  "nextOccurrences": [
    {
      "date": "Monday, February 24, 2025",
      "source": {
        "section": "Daily",
        "details": "Every day"
      }
    },
    {
      "date": "Tuesday, February 25, 2025",
      "source": {
        "section": "Daily",
        "details": "Every day"
      }
    },
    {
      "date": "Wednesday, February 26, 2025",
      "source": {
        "section": "Daily",
        "details": "Every day"
      }
    }
  ]
}
```

### Weekly Schedules

**Specific Days**
```json
{
  "summary": "Scheduled every Monday, Wednesday, and Friday",
  "nextOccurrences": [
    {
      "date": "Monday, February 24, 2025",
      "source": {
        "section": "Weekly",
        "details": "Monday"
      }
    },
    {
      "date": "Wednesday, February 26, 2025",
      "source": {
        "section": "Weekly",
        "details": "Wednesday"
      }
    },
    {
      "date": "Friday, February 28, 2025",
      "source": {
        "section": "Weekly",
        "details": "Friday"
      }
    }
  ]
}
```

**Weekends Only**
```json
{
  "summary": "Scheduled on weekends (Saturday and Sunday)",
  "nextOccurrences": [
    {
      "date": "Saturday, February 22, 2025",
      "source": {
        "section": "Weekly",
        "details": "Weekends"
      }
    },
    {
      "date": "Sunday, February 23, 2025",
      "source": {
        "section": "Weekly",
        "details": "Weekends"
      }
    },
    {
      "date": "Saturday, March 1, 2025",
      "source": {
        "section": "Weekly",
        "details": "Weekends"
      }
    }
  ]
}
```

**Weekdays Only**
```json
{
  "summary": "Scheduled on weekdays (Monday through Friday)",
  "nextOccurrences": [
    {
      "date": "Monday, February 24, 2025",
      "source": {
        "section": "Weekly",
        "details": "Weekdays"
      }
    },
    {
      "date": "Tuesday, February 25, 2025",
      "source": {
        "section": "Weekly",
        "details": "Weekdays"
      }
    },
    {
      "date": "Wednesday, February 26, 2025",
      "source": {
        "section": "Weekly",
        "details": "Weekdays"
      }
    }
  ]
}
```

### Fortnightly Schedules

**Even Weeks**
```json
{
  "summary": "Scheduled every Week 2 on Monday and Wednesday",
  "nextOccurrences": [
    "Monday, February 24, 2025",
    "Wednesday, February 26, 2025",
    "Monday, March 10, 2025"
  ]
}
```

**Odd Weeks**
```json
{
  "summary": "Scheduled every Week 1 on Friday",
  "nextOccurrences": [
    "Friday, February 21, 2025",
    "Friday, March 7, 2025",
    "Friday, March 21, 2025"
  ]
}
```

### Monthly Schedules

**Specific Dates**
```json
{
  "summary": "Scheduled on the 15th and 28th of every month",
  "nextOccurrences": [
    "Monday, February 24, 2025",
    "Monday, March 15, 2025",
    "Sunday, March 28, 2025"
  ]
}
```

**Nth Day of Month**
```json
{
  "summary": "Scheduled on the 1st Friday and last Sunday of every month",
  "nextOccurrences": [
    "Friday, February 28, 2025",
    "Sunday, February 23, 2025",
    "Friday, March 7, 2025"
  ]
}
```

**Date Range**
```json
{
  "summary": "Scheduled between the 15th and 20th of every month",
  "nextOccurrences": [
    "Monday, February 17, 2025",
    "Tuesday, February 18, 2025",
    "Wednesday, February 19, 2025"
  ]
}
```

**Hebrew Calendar - Specific Dates**
```json
{
  "summary": "Scheduled on the 15th of every Hebrew month",
  "nextOccurrences": [
    "Monday, February 24, 2025 (15 Adar, 5785)",
    "Thursday, March 27, 2025 (15 Nisan, 5785)",
    "Saturday, April 26, 2025 (15 Iyar, 5785)"
  ],
  "calendarType": "hebrew"
}
```

### Yearly Schedules

**Gregorian Calendar**
```json
{
  "summary": "Scheduled on January 15th and March 20th every year",
  "nextOccurrences": [
    "Sunday, January 15, 2025",
    "Wednesday, March 20, 2025",
    "Tuesday, January 15, 2026"
  ]
}
```

**Hebrew Calendar Events**
```json
{
  "summary": "Scheduled on 1st-14th of Nissan (Passover season) every Hebrew year",
  "nextOccurrences": [
    "Thursday, March 27, 2025 (1st of Nissan, 5785)",
    "Friday, March 28, 2025 (2nd of Nissan, 5785)",
    "Saturday, March 29, 2025 (3rd of Nissan, 5785)"
  ],
  "calendarType": "hebrew"
}
```

**Multiple Months/Ranges**
```json
{
  "summary": "Scheduled on January 1st-5th and December 25th-31st every year",
  "nextOccurrences": [
    "Wednesday, January 1, 2025",
    "Thursday, January 2, 2025",
    "Friday, January 3, 2025"
  ]
}
```

### Always Active

```json
{
  "summary": "Always active",
  "nextOccurrences": [
    "Monday, February 24, 2025",
    "Tuesday, February 25, 2025",
    "Wednesday, February 26, 2025"
  ]
}
```

## Source Metadata Reference

Each occurrence includes source metadata indicating which schedule configuration generated it:

### Daily Schedules
- **Section:** "Daily"
- **Details:** "Every day"

### Weekly Schedules
- **Section:** "Weekly"
- **Details:** Day name (e.g., "Monday"), "Weekends", or "Weekdays"

### Fortnightly Schedules
- **Section:** "Fortnightly"
- **Details:** Week number and day (e.g., "Week 1 - Monday", "Week 2 - Friday")

### Monthly Schedules
- **Section:** "Monthly - Selected Dates" (for specific dates like 15, 28)
  - **Details:** "15th of month", "28th of month"
- **Section:** "Monthly - Weekday Position" (for Nth weekday like 1st Friday)
  - **Details:** "1st Friday", "Last Sunday"
- **Section:** "Monthly - Date Range" (for ranges like 15-20)
  - **Details:** "15th-20th of month"
- **Section:** "Monthly" (fallback)
  - **Details:** Day description

### Yearly Schedules
- **Section:** "Yearly - Specific Dates" (for specific dates like Feb 1)
  - **Details:** "February 1st", "March 15th"
- **Section:** "Yearly - Date Range" (for month ranges)
  - **Details:** "January 1st-5th", "December 25th-31st"
- **Section:** "Yearly" (fallback)
  - **Details:** Month and day description

### Special Cases
- **Section:** "Always Active"
  - **Details:** "Every day"
- **Section:** "Error"
  - **Details:** "Calculation error" (if generation fails)

## Implementation Details

### Summary Generation Logic

The summary is generated based on the following hierarchy:

1. **Recurrence Type Check** - Determines if schedule is Daily, Weekly, Fortnightly, Monthly, Yearly, or Always Active
2. **Configuration Analysis** - Examines specific schedule parameters:
   - Days of week (0-6 for Sunday-Saturday)
   - Dates of month (1-31)
   - Nth day patterns (e.g., "1st Friday")
   - Monthly ranges (e.g., 15-20)
   - Yearly dates/ranges
   - Calendar type (Gregorian, Hebrew, Islamic, Chinese)
3. **Formatting** - Converts configuration to human-readable English
4. **Occurrence Calculation** - Uses goal scheduler to compute next N occurrences
5. **Date Formatting** - Displays dates in long format (e.g., "Monday, February 24, 2025")
   - For Hebrew calendar: Includes Hebrew date equivalent (e.g., "15 Adar, 5785")

### Calendar Support

- **Gregorian** (default): Standard Western calendar
- **Hebrew**: Jewish calendar with month names (Tishrei, Cheshvan, etc.)
  - Automatically adjusts for leap years
  - Displays Hebrew date equivalent in responses
- **Islamic**: Islamic lunar calendar with month names
- **Chinese**: Lunar calendar with ordinal month names

### Special Handling

**Hebrew Leap Years**: Automatically detected and handled
- Regular years: 12 months (Tishrei to Elul)
- Leap years: 13 months (Adar I and Adar II instead of single Adar)

**Fortnightly Even/Odd Weeks**:
- Uses start date as reference point
- Week 1 = odd week, Week 2 = even week
- Cycles every 2 weeks

**Nth Day Patterns**:
- "1st Friday" = First Friday of the month
- "2nd Tuesday" = Second Tuesday of the month
- "Last Sunday" = Last Sunday of the month

### Calendar Type Toggle Behavior

When updating a goal's `calendarType`:

**Switching TO Alternative Calendar** (e.g., Gregorian → Hebrew):
- All Gregorian-specific date selections are cleared:
  - `scheduleDatesOfMonth` → null
  - `scheduleMonthlyRange` → null
  - `scheduleDatesOfYear` → null
- This prevents conflicting schedule rules from coexisting
- Example: User selects "15th of month" in Gregorian, then switches to Hebrew calendar
  - The "15th of month" selection is cleared
  - User must reconfigure with Hebrew calendar dates

**Switching TO Gregorian Calendar**:
- Alternative calendar date fields are cleared
- `calendarType` is set to 'gregorian'
- Allows user to reconfigure with Gregorian calendar dates

### Empty Weekday Selection

In Monthly "Select Weekday Position", it's possible to unselect all options:

- **Empty Selection**: `scheduleNthDayOfMonth` → null
- **Non-Empty Selection**: `scheduleNthDayOfMonth` → { day: "Monday", nth: 1 }
- This allows flexible configuration where no Nth day is currently selected
- Users can toggle weekday positions on/off without losing other schedule rules

## Error Handling

The endpoint handles various error cases:

- **Goal Not Found** (404): Returned when goal ID doesn't exist
- **Unauthorized** (403): Returned when user doesn't own the goal
- **Invalid Configuration** (500): Returned if schedule config causes calculation errors
- **Calculation Failure**: Falls back to "Next occurrence cannot be calculated"

## Performance Notes

- Occurrence calculation is limited to max 10 occurrences (for performance)
- Hebrew calendar conversion is simplified (may be 1-2 days off in some edge cases)
- Results are calculated on-demand (not cached)

## API Examples

**Example Request:**
```bash
curl -X GET "https://api.example.com/api/goals/550e8400-e29b-41d4-a716-446655440000/schedule-summary?occurrences=5" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**
```json
{
  "goalId": "550e8400-e29b-41d4-a716-446655440000",
  "goalTitle": "Morning Prayer",
  "summary": "Scheduled daily at 6:30 AM",
  "nextOccurrences": [
    {
      "date": "Monday, February 24, 2025",
      "source": {
        "section": "Daily",
        "details": "Every day"
      }
    },
    {
      "date": "Tuesday, February 25, 2025",
      "source": {
        "section": "Daily",
        "details": "Every day"
      }
    },
    {
      "date": "Wednesday, February 26, 2025",
      "source": {
        "section": "Daily",
        "details": "Every day"
      }
    },
    {
      "date": "Thursday, February 27, 2025",
      "source": {
        "section": "Daily",
        "details": "Every day"
      }
    },
    {
      "date": "Friday, February 28, 2025",
      "source": {
        "section": "Daily",
        "details": "Every day"
      }
    }
  ],
  "recurrenceType": "daily",
  "calendarType": "gregorian"
}
```
