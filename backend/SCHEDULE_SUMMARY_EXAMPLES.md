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
    "Monday, February 24, 2025 (15 Adar, 5785)",
    "Tuesday, February 25, 2025 (16 Adar, 5785)",
    "Wednesday, February 26, 2025 (17 Adar, 5785)"
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
    "Monday, February 24, 2025",
    "Tuesday, February 25, 2025",
    "Wednesday, February 26, 2025"
  ]
}
```

### Weekly Schedules

**Specific Days**
```json
{
  "summary": "Scheduled every Monday, Wednesday, and Friday",
  "nextOccurrences": [
    "Monday, February 24, 2025",
    "Wednesday, February 26, 2025",
    "Friday, February 28, 2025"
  ]
}
```

**Weekends Only**
```json
{
  "summary": "Scheduled on weekends (Saturday and Sunday)",
  "nextOccurrences": [
    "Saturday, February 22, 2025",
    "Sunday, February 23, 2025",
    "Saturday, March 1, 2025"
  ]
}
```

**Weekdays Only**
```json
{
  "summary": "Scheduled on weekdays (Monday through Friday)",
  "nextOccurrences": [
    "Monday, February 24, 2025",
    "Tuesday, February 25, 2025",
    "Wednesday, February 26, 2025"
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
    "Monday, February 24, 2025",
    "Tuesday, February 25, 2025",
    "Wednesday, February 26, 2025",
    "Thursday, February 27, 2025",
    "Friday, February 28, 2025"
  ],
  "recurrenceType": "daily",
  "calendarType": "gregorian"
}
```
