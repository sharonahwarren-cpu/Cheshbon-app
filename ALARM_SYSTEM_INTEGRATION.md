
# Alarm System Integration Guide

## Overview
Comprehensive alarm system with support for:
- Multiple calendar types (Gregorian, Hebrew, Chinese, Islamic)
- Flexible triggers (time, astronomical, location-based)
- Recurring alarms with automatic recalculation
- Geofencing for location-based triggers
- Background task management

## Backend Integration Status
✅ Backend endpoints created via `make_backend_change`
- GET /api/alarms - List all alarms
- POST /api/alarms - Create new alarm
- GET /api/alarms/:id - Get single alarm
- PUT /api/alarms/:id - Update alarm
- DELETE /api/alarms/:id - Delete alarm

## Frontend Components Created

### Core Utilities
1. **types/alarm.ts** - TypeScript interfaces for alarm system
2. **utils/alarmCalculations.ts** - Astronomical and calendar calculations
3. **utils/alarmPermissions.ts** - Permission management
4. **utils/alarmGeofencing.ts** - Geofencing setup
5. **utils/alarmNotifications.ts** - Notification scheduling

### UI Screens
1. **app/alarms/index.tsx** - Alarm list view
2. **app/alarms/create.tsx** - Create/edit alarm screen

## Integration Points

### In Goal Scheduling (app/create-goal.tsx)
Add alarm scheduling option:
```typescript
import { Alarm } from '@/types/alarm';
import { calculateNextTriggerTime } from '@/utils/alarmCalculations';

// Add alarm field to goal
const [goalAlarms, setGoalAlarms] = useState<string[]>([]); // Array of alarm IDs

// Link alarms to goals when saving
```

### In Profile Settings (app/(tabs)/settings.tsx)
Add navigation to alarm management:
```typescript
<TouchableOpacity onPress={() => router.push('/alarms')}>
  <Text>Manage Alarms</Text>
</TouchableOpacity>
```

### In Preferences/Notifications (app/preferences/notification.tsx)
Add home location setup:
```typescript
import { getCurrentLocation } from '@/utils/alarmGeofencing';
import { UserLocationPreferences } from '@/types/alarm';

// Add home location picker
// Save to user preferences
```

## Required Dependencies
✅ Installed:
- suncalc - Astronomical calculations
- expo-location - Location and geofencing
- expo-task-manager - Background tasks
- @hebcal/core - Hebrew calendar (already installed)
- luxon - Timezone handling (already installed)

## Permissions Required
1. **Foreground Location** - For current location and astronomical calculations
2. **Background Location** - For geofencing (optional)
3. **Notifications** - For alarm notifications

## Background Task Setup
The geofencing task needs to be defined at app startup:

```typescript
// In app/_layout.tsx or index.ts
import { defineGeofencingTask } from '@/utils/alarmGeofencing';
import * as Notifications from 'expo-notifications';

defineGeofencingTask(async (event) => {
  console.log('Geofence event:', event);
  // Trigger alarm notification if conditions met
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Location Alarm',
      body: 'You have entered the geofence area',
    },
    trigger: null, // Immediate
  });
});
```

## App.json Configuration
Add location permissions:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location for alarm triggers."
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["location"]
      }
    }
  }
}
```

## Usage Examples

### Create Time-Based Alarm
```typescript
const alarm: Alarm = {
  title: "Morning Prayer",
  triggers: [{ type: 'time', value: '06:00' }],
  recurring: true,
  timezone: 'Australia/Melbourne',
  enabled: true,
};
```

### Create Astronomical Alarm
```typescript
const alarm: Alarm = {
  title: "Sunset Reminder",
  triggers: [
    { 
      type: 'astronomical', 
      value: 'sunset',
      min: '18:00', // Not before 6 PM
    }
  ],
  recurring: true,
  location: { latitude: -37.8136, longitude: 144.9631 },
  timezone: 'Australia/Melbourne',
  enabled: true,
};
```

### Create Hebrew Calendar Alarm
```typescript
const alarm: Alarm = {
  title: "Rosh Chodesh Reminder",
  calendarType: 'hebrew',
  eventType: 'roshChodesh',
  triggers: [
    { 
      type: 'astronomical', 
      value: 'sunset',
      logic: 'AND'
    },
    {
      type: 'location',
      value: 'enterHome',
      logic: 'AND'
    }
  ],
  recurring: true,
  location: { latitude: -37.8136, longitude: 144.9631, radius: 100 },
  timezone: 'Australia/Melbourne',
  enabled: true,
};
```

## Next Steps
1. ✅ Backend endpoints created
2. ✅ Frontend utilities and screens created
3. ⏳ Integrate alarm selection into goal scheduling
4. ⏳ Add home location setup in preferences
5. ⏳ Add alarm management link in settings
6. ⏳ Test background geofencing
7. ⏳ Test notification scheduling
8. ⏳ Test recurring alarm recalculation

## Testing Checklist
- [ ] Create time-based alarm
- [ ] Create astronomical alarm (sunrise/sunset)
- [ ] Create location-based alarm with geofencing
- [ ] Create Hebrew calendar alarm (Rosh Chodesh)
- [ ] Test recurring alarm recalculation
- [ ] Test alarm enable/disable
- [ ] Test alarm editing
- [ ] Test alarm deletion
- [ ] Test background location triggers
- [ ] Test notification delivery
- [ ] Test permission requests
- [ ] Test with different timezones
- [ ] Test with alternative calendars

## Known Limitations
1. Chinese and Islamic calendar calculations are placeholders - need proper libraries
2. Background geofencing requires development build (not available in Expo Go)
3. iOS limits geofencing to 20 regions maximum
4. Android allows up to 100 geofences per app
5. Background location may be restricted by battery optimization settings

## Troubleshooting
- **Notifications not appearing**: Check notification permissions
- **Geofencing not working**: Ensure background location permission granted
- **Astronomical times incorrect**: Verify location coordinates are accurate
- **Hebrew dates wrong**: Check @hebcal/core version and timezone settings
