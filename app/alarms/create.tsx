
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Modal,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '@/utils/api';
import { getLocalTimezone } from '@/utils/dateUtils';
import { DatePickerModal } from '@/components/DatePickerModal';
import type { Alarm, AlarmTrigger, CalendarType, TriggerType } from '@/types/alarm';
import { requestAllAlarmPermissions, checkAllPermissions } from '@/utils/alarmPermissions';
import { areNotificationsSupported } from '@/utils/alarmNotifications';
import { getCurrentLocation } from '@/utils/alarmGeofencing';
import Constants from 'expo-constants';

const HEBREW_EVENTS = [
  { value: 'roshChodesh', label: 'Rosh Chodesh' },
  { value: 'roshHashanah', label: 'Rosh Hashanah' },
  { value: 'yomKippur', label: 'Yom Kippur' },
  { value: 'sukkot', label: 'Sukkot' },
  { value: 'pesach', label: 'Pesach' },
  { value: 'shavuot', label: 'Shavuot' },
];

const ASTRONOMICAL_EVENTS = [
  { value: 'sunrise', label: 'Sunrise' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'dawn', label: 'Dawn' },
  { value: 'dusk', label: 'Dusk' },
  { value: 'solarNoon', label: 'Solar Noon' },
  { value: 'goldenHour', label: 'Golden Hour' },
];

export default function CreateAlarmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEditing = !!params.id;
  const isFromGoal = !!params.goalId;
  const goalScheduleType = params.scheduleType as string | undefined;
  const goalScheduleDays = params.scheduleDays ? (params.scheduleDays as string).split(',').map(Number) : [];
  const quickAlarmTime = params.quickAlarmTime as string | undefined;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // User preferences
  const [alternativeCalendar, setAlternativeCalendar] = useState<CalendarType | null>(null);

  // Alarm fields
  const [title, setTitle] = useState('');
  const [calendarType, setCalendarType] = useState<CalendarType>('gregorian');
  const [eventType, setEventType] = useState<string | undefined>();
  const [triggers, setTriggers] = useState<AlarmTrigger[]>([]);
  const [recurring, setRecurring] = useState(false);
  const [enabled, setEnabled] = useState(true);

  // UI state
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showCalendarTypePicker, setShowCalendarTypePicker] = useState(false);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [editingTriggerIndex, setEditingTriggerIndex] = useState<number | null>(null);
  const [newTrigger, setNewTrigger] = useState<AlarmTrigger>({
    type: 'time',
    value: '09:00',
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<'value' | 'min' | 'max'>('value');
  const [permissions, setPermissions] = useState({
    foregroundLocation: false,
    backgroundLocation: false,
    notifications: false,
  });

  // Location state - moved to trigger modal
  const [homeLocation, setHomeLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    loadPreferencesAndAlarm();
  }, []);

  const loadPreferencesAndAlarm = async () => {
    console.log('Loading user preferences and alarm data');
    setLoading(true);

    try {
      // Load user preferences to get alternative calendar setting
      const prefsResponse = await authenticatedGet<any>('/api/user-preferences');
      const prefs = (prefsResponse as any)?.data || prefsResponse;
      const userAltCalendar = prefs.alternativeCalendar as CalendarType | undefined;
      
      console.log('User alternative calendar preference:', userAltCalendar);
      setAlternativeCalendar(userAltCalendar === 'gregorian' ? null : (userAltCalendar || null));
      
      // Always default to Gregorian calendar
      setCalendarType('gregorian');

      // Check permissions
      await checkPermissions();

      // If editing, load the alarm
      if (isEditing) {
        await loadAlarm();
      } else {
        // For new alarms, NO default trigger - leave blank unless quick alarm time is provided
        if (quickAlarmTime) {
          setTriggers([{ type: 'time', value: quickAlarmTime }]);
          console.log('Pre-filled alarm time from quick alarm:', quickAlarmTime);
        } else {
          setTriggers([]);
        }
        
        // Pre-fill title if coming from goal
        if (params.goalTitle) {
          setTitle(params.goalTitle as string);
          console.log('Pre-filled alarm title from goal:', params.goalTitle);
        }
      }
    } catch (err: any) {
      console.error('Error loading preferences or alarm:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const checkPermissions = async () => {
    const perms = await checkAllPermissions();
    setPermissions(perms);
  };

  const requestPermissions = async () => {
    console.log('User tapped Grant Permissions button');
    
    if (Platform.OS === 'web') {
      setError('Web browsers have limited notification support. Location-based alarms are not available on web. For full functionality, please use the mobile app.');
      console.warn('[Web] Notification and location permissions are limited on web browsers');
      
      try {
        const granted = await requestAllAlarmPermissions();
        if (granted) {
          await checkPermissions();
          setError('');
        }
      } catch (err) {
        console.error('[Web] Error requesting permissions:', err);
      }
      return;
    }

    const granted = await requestAllAlarmPermissions();
    if (granted) {
      await checkPermissions();
      setError('');
      console.log('Permissions granted successfully');
    } else {
      setError('Some permissions were denied. Alarms may not work correctly.');
      console.warn('Not all permissions were granted');
    }
  };

  const loadAlarm = async () => {
    console.log('Loading alarm for editing:', params.id);

    try {
      console.log(`[API] Requesting GET /api/alarms/${params.id}...`);
      const response = await authenticatedGet<Alarm>(`/api/alarms/${params.id}`);
      const alarm = (response as any)?.data || response;

      setTitle(alarm.title);
      setCalendarType(alarm.calendarType || 'gregorian');
      setEventType(alarm.eventType);
      setTriggers(alarm.triggers || []);
      setRecurring(alarm.recurring ?? false);
      setEnabled(alarm.enabled ?? true);

      console.log('Alarm loaded for editing');
    } catch (err: any) {
      console.error('Error loading alarm:', err);
      setError(err.message || 'Failed to load alarm');
    }
  };

  const fetchCurrentLocation = async () => {
    console.log('User tapped Use Current Location button');
    const location = await getCurrentLocation();

    if (location) {
      setHomeLocation(location);
      console.log('Current location set:', location);
    } else {
      setError('Failed to get current location. Please check location permissions.');
    }
  };

  const addTrigger = () => {
    console.log('User tapped Add Alternative Alarm Time');
    setNewTrigger({ type: 'time', value: '09:00' });
    setEditingTriggerIndex(null);
    setShowTriggerModal(true);
  };

  const editTrigger = (index: number) => {
    console.log('User tapped Edit Trigger at index:', index);
    setNewTrigger({ ...triggers[index] });
    setEditingTriggerIndex(index);
    setShowTriggerModal(true);
  };

  const saveTrigger = () => {
    console.log('User tapped Save Trigger');
    
    // Validate trigger has a value
    if (!newTrigger.value) {
      setError('Please set a value for this trigger');
      return;
    }
    
    if (editingTriggerIndex !== null) {
      const updated = [...triggers];
      updated[editingTriggerIndex] = newTrigger;
      setTriggers(updated);
      console.log('Trigger updated at index:', editingTriggerIndex);
    } else {
      setTriggers([...triggers, newTrigger]);
      console.log('New trigger added');
    }
    setShowTriggerModal(false);
    setError(''); // Clear any errors
  };

  const removeTrigger = (index: number) => {
    console.log('User tapped Remove Trigger at index:', index);
    setTriggers(triggers.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    console.log('User tapped Save Alarm button');

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (triggers.length === 0) {
      setError('Please add at least one trigger');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const timezone = getLocalTimezone();
      const alarmData: any = {
        title: title.trim(),
        calendarType,
        eventType,
        triggers,
        recurring,
        enabled,
        timezone,
      };

      // Add goalId if creating from goal
      if (isFromGoal && params.goalId) {
        alarmData.goalId = params.goalId;
      }

      if (isEditing) {
        console.log(`[API] Requesting PUT /api/alarms/${params.id}...`);
        await authenticatedPut(`/api/alarms/${params.id}`, alarmData);
        console.log('Alarm updated successfully');
      } else {
        console.log('[API] Requesting POST /api/alarms...');
        const createdAlarm = await authenticatedPost<any>('/api/alarms', alarmData);
        const alarmId = createdAlarm?.id || (createdAlarm as any)?.data?.id;
        console.log('Alarm created successfully:', alarmId);
        
        // If creating from a goal, update the goal's alarms field to track this alarm
        if (isFromGoal && params.goalId && alarmId) {
          console.log('[API] Updating goal alarms field with new alarm ID:', alarmId);
          try {
            // Fetch current goal to get existing alarm IDs
            const goalData = await authenticatedGet<any>(`/api/goals/${params.goalId}`);
            const goal = (goalData as any)?.data || goalData;
            
            // Parse existing alarms field
            let existingAlarmIds: string[] = [];
            if (goal?.alarms) {
              const parsedAlarms = typeof goal.alarms === 'string' 
                ? JSON.parse(goal.alarms) 
                : goal.alarms;
              if (Array.isArray(parsedAlarms)) {
                existingAlarmIds = parsedAlarms.map((a: any) => 
                  typeof a === 'string' ? a : a.id
                ).filter(Boolean);
              }
            }
            
            // Add new alarm ID
            const updatedAlarmIds = [...existingAlarmIds, alarmId];
            console.log('[API] Updated goal alarm IDs:', updatedAlarmIds);
            
            await authenticatedPut(`/api/goals/${params.goalId}`, {
              alarms: updatedAlarmIds.map(id => ({ id })),
            });
            console.log('[API] Goal alarms field updated successfully');
          } catch (goalUpdateError: any) {
            console.error('[API] Error updating goal alarms field:', goalUpdateError);
            // Non-critical - alarm was created, just the goal reference wasn't updated
          }
        }
      }

      // Navigate back to Edit Goal screen
      console.log('[Navigation] Returning to Edit Goal screen');
      router.back();
    } catch (err: any) {
      console.error('Error saving alarm:', err);
      setError(err.message || 'Failed to save alarm');
    } finally {
      setSaving(false);
    }
  };

  const handleTimePickerConfirm = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    if (timePickerMode === 'value') {
      setNewTrigger({ ...newTrigger, value: timeString });
    } else if (timePickerMode === 'min') {
      setNewTrigger({ ...newTrigger, min: timeString });
    } else if (timePickerMode === 'max') {
      setNewTrigger({ ...newTrigger, max: timeString });
    }

    setShowTimePicker(false);
  };

  const handleTimePickerCancel = () => {
    setShowTimePicker(false);
  };

  const parseTimeString = (timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours || 9, minutes || 0, 0, 0);
    return date;
  };

  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const renderTriggerItem = (trigger: AlarmTrigger, index: number) => {
    let triggerText = '';

    switch (trigger.type) {
      case 'time':
        triggerText = `Time: ${formatTime12Hour(trigger.value || '09:00')}`;
        break;
      case 'astronomical':
        triggerText = `Astronomical: ${trigger.value}`;
        if (trigger.min) triggerText += ` (not before ${formatTime12Hour(trigger.min)})`;
        if (trigger.max) triggerText += ` (not after ${formatTime12Hour(trigger.max)})`;
        break;
      case 'location':
        triggerText = `Location: ${trigger.value}`;
        break;
    }

    if (trigger.logic) {
      triggerText += ` [${trigger.logic}]`;
    }

    return (
      <View key={index} style={styles.triggerItem}>
        <Text style={styles.triggerText}>{triggerText}</Text>
        <View style={styles.triggerActions}>
          <TouchableOpacity onPress={() => editTrigger(index)}>
            <IconSymbol
              ios_icon_name="pencil"
              android_material_icon_name="edit"
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => removeTrigger(index)}>
            <IconSymbol
              ios_icon_name="trash"
              android_material_icon_name="delete"
              size={20}
              color={colors.error}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Loading...', headerShown: true }} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const showCalendarTypeSelector = alternativeCalendar !== null;
  const calendarOptions = ['gregorian'];
  if (alternativeCalendar) {
    calendarOptions.push(alternativeCalendar);
  }

  const isExpoGo = Constants.appOwnership === 'expo';
  const notificationsSupported = areNotificationsSupported();

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: isEditing ? 'Edit Alarm' : 'Create Alarm',
          headerShown: true,
        }}
      />

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scrollView}>
          {/* Expo Go Warning Banner */}
          {isExpoGo && !notificationsSupported && (
            <View style={styles.expoGoWarningBanner}>
              <IconSymbol
                ios_icon_name="exclamationmark.triangle.fill"
                android_material_icon_name="warning"
                size={24}
                color="#FF9500"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.expoGoWarningTitle}>Limited Functionality in Expo Go</Text>
                <Text style={styles.expoGoWarningText}>
                  Push notifications are not supported in Expo Go on Android (SDK 53+). Alarms can be created but will not trigger notifications. For full functionality, please use a development build.
                </Text>
              </View>
            </View>
          )}

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Goal Schedule Info Banner - shown when creating alarm from a goal */}
          {isFromGoal && !isEditing && (
            <View style={styles.scheduleInfoBanner}>
              <IconSymbol
                ios_icon_name="calendar.badge.clock"
                android_material_icon_name="event"
                size={20}
                color={colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.scheduleInfoTitle}>Goal-Linked Alarm</Text>
                <Text style={styles.scheduleInfoText}>
                  {goalScheduleType && goalScheduleType !== 'Always Active'
                    ? `This alarm will only trigger on days when the goal is scheduled (${goalScheduleType}${goalScheduleDays.length > 0 ? `, ${goalScheduleDays.length} days/week` : ''}).`
                    : 'This alarm is linked to your goal and will trigger every day (goal is always active).'}
                </Text>
              </View>
            </View>
          )}

          {/* Permissions Warning */}
          {(!permissions.notifications || !permissions.foregroundLocation) && (
            <View style={styles.warningBanner}>
              <IconSymbol
                ios_icon_name="exclamationmark.triangle"
                android_material_icon_name="warning"
                size={20}
                color={colors.warning}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.warningText}>
                  Some permissions are missing. Alarms may not work correctly.
                </Text>
                {Platform.OS === 'web' && (
                  <Text style={styles.warningSubtext}>
                    Note: Web browsers have limited notification support. For full functionality, use the mobile app.
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={requestPermissions}>
                <Text style={styles.warningLink}>Grant Permissions</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Brush Teeth Reminder"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Calendar Type - Only show if alternative calendar is active */}
          {showCalendarTypeSelector && (
            <View style={styles.section}>
              <Text style={styles.label}>Calendar Type</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowCalendarTypePicker(true)}
              >
                <Text style={styles.pickerText}>
                  {calendarType.charAt(0).toUpperCase() + calendarType.slice(1)}
                </Text>
                <IconSymbol
                  ios_icon_name="chevron.down"
                  android_material_icon_name="arrow-drop-down"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
              <Text style={styles.helpText}>
                Choose between Gregorian and {alternativeCalendar} calendar
              </Text>
            </View>
          )}

          {/* Event Type (if Hebrew calendar selected) */}
          {calendarType === 'hebrew' && (
            <View style={styles.section}>
              <Text style={styles.label}>Event Type (Optional)</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowEventPicker(true)}
              >
                <Text style={styles.pickerText}>
                  {eventType
                    ? HEBREW_EVENTS.find(e => e.value === eventType)?.label
                    : 'Select Hebrew event'}
                </Text>
                <IconSymbol
                  ios_icon_name="chevron.down"
                  android_material_icon_name="arrow-drop-down"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Triggers */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.label}>Time *</Text>
                <Text style={styles.helpText}>Primary alarm time</Text>
              </View>
            </View>

            {triggers.length === 0 ? (
              <Text style={styles.emptyText}>No triggers added yet</Text>
            ) : (
              triggers.map((trigger, index) => renderTriggerItem(trigger, index))
            )}

            <TouchableOpacity style={styles.addTriggerButton} onPress={addTrigger}>
              <IconSymbol
                ios_icon_name="plus.circle"
                android_material_icon_name="add-circle"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.addTriggerText}>Add Alternative Alarm Time</Text>
            </TouchableOpacity>
          </View>

          {/* Recurring */}
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Recurring</Text>
              <Switch
                value={recurring}
                onValueChange={setRecurring}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={recurring ? colors.background : colors.textSecondary}
              />
            </View>
            <Text style={styles.helpText}>
              Automatically recalculate and reschedule this alarm
            </Text>
          </View>

          {/* Enabled */}
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Enabled</Text>
                <Text style={styles.helpText}>
                  Toggle to activate or deactivate this alarm without deleting it
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={enabled ? colors.background : colors.textSecondary}
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.saveButtonText}>
                {isEditing ? 'Update Alarm' : 'Create Alarm'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Calendar Type Picker Modal */}
      <Modal visible={showCalendarTypePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Calendar Type</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {calendarOptions.map(cal => (
                <TouchableOpacity
                  key={cal}
                  style={styles.modalOption}
                  onPress={() => {
                    setCalendarType(cal as CalendarType);
                    setShowCalendarTypePicker(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>
                    {cal.charAt(0).toUpperCase() + cal.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowCalendarTypePicker(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Event Type Picker Modal */}
      <Modal visible={showEventPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Hebrew Event</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {HEBREW_EVENTS.map(event => (
                <TouchableOpacity
                  key={event.value}
                  style={styles.modalOption}
                  onPress={() => {
                    setEventType(event.value);
                    setShowEventPicker(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{event.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowEventPicker(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Trigger Modal */}
      <Modal visible={showTriggerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingTriggerIndex !== null ? 'Edit Trigger' : 'Add Trigger'}
              </Text>

              <ScrollView style={{ maxHeight: 500 }} nestedScrollEnabled={true}>
                {/* Trigger Type */}
                <Text style={styles.label}>Alarm Type</Text>
                <View style={styles.triggerTypeRow}>
                  {(['time', 'astronomical', 'location'] as const).map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.triggerTypeButton,
                        newTrigger.type === type && styles.triggerTypeButtonActive,
                      ]}
                      onPress={() => setNewTrigger({ ...newTrigger, type, value: undefined })}
                    >
                      <Text
                        style={[
                          styles.triggerTypeText,
                          newTrigger.type === type && styles.triggerTypeTextActive,
                        ]}
                      >
                        {type === 'time' ? 'Time' : type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Trigger Value */}
                {newTrigger.type === 'time' && (
                  <>
                    <Text style={styles.label}>Time</Text>
                    <TouchableOpacity
                      style={styles.timePickerButton}
                      onPress={() => {
                        setTimePickerMode('value');
                        setShowTimePicker(true);
                      }}
                    >
                      <IconSymbol
                        ios_icon_name="clock"
                        android_material_icon_name="schedule"
                        size={20}
                        color={colors.primary}
                      />
                      <Text style={styles.timePickerButtonText}>
                        {newTrigger.value ? formatTime12Hour(newTrigger.value) : 'Set time'}
                      </Text>
                    </TouchableOpacity>
                    
                    {/* AND/OR Logic - Show AFTER time selection */}
                    <Text style={styles.label}>Combine with other triggers using</Text>
                    <View style={styles.triggerTypeRow}>
                      {(['AND', 'OR'] as const).map(logic => (
                        <TouchableOpacity
                          key={logic}
                          style={[
                            styles.triggerTypeButton,
                            newTrigger.logic === logic && styles.triggerTypeButtonActive,
                          ]}
                          onPress={() =>
                            setNewTrigger({ ...newTrigger, logic: newTrigger.logic === logic ? undefined : logic })
                          }
                        >
                          <Text
                            style={[
                              styles.triggerTypeText,
                              newTrigger.logic === logic && styles.triggerTypeTextActive,
                            ]}
                          >
                            {logic}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {newTrigger.type === 'astronomical' && (
                  <>
                    <Text style={styles.label}>Astronomical Event</Text>
                    {/* Fixed: Non-scrollable event selection */}
                    <View>
                      {ASTRONOMICAL_EVENTS.map(event => (
                        <TouchableOpacity
                          key={event.value}
                          style={[
                            styles.modalOption,
                            newTrigger.value === event.value && styles.modalOptionSelected,
                          ]}
                          onPress={() => setNewTrigger({ ...newTrigger, value: event.value })}
                        >
                          <Text
                            style={[
                              styles.modalOptionText,
                              newTrigger.value === event.value && styles.modalOptionTextSelected,
                            ]}
                          >
                            {event.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.label}>Not Before (optional)</Text>
                    <TouchableOpacity
                      style={styles.timePickerButton}
                      onPress={() => {
                        setTimePickerMode('min');
                        setShowTimePicker(true);
                      }}
                    >
                      <IconSymbol
                        ios_icon_name="clock"
                        android_material_icon_name="schedule"
                        size={20}
                        color={colors.primary}
                      />
                      <Text style={styles.timePickerButtonText}>
                        {newTrigger.min ? formatTime12Hour(newTrigger.min) : 'Set minimum time'}
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.label}>Not After (optional)</Text>
                    <TouchableOpacity
                      style={styles.timePickerButton}
                      onPress={() => {
                        setTimePickerMode('max');
                        setShowTimePicker(true);
                      }}
                    >
                      <IconSymbol
                        ios_icon_name="clock"
                        android_material_icon_name="schedule"
                        size={20}
                        color={colors.primary}
                      />
                      <Text style={styles.timePickerButtonText}>
                        {newTrigger.max ? formatTime12Hour(newTrigger.max) : 'Set maximum time'}
                      </Text>
                    </TouchableOpacity>
                    
                    {/* AND/OR Logic - Show AFTER astronomical event selection */}
                    <Text style={styles.label}>Combine with other triggers using</Text>
                    <View style={styles.triggerTypeRow}>
                      {(['AND', 'OR'] as const).map(logic => (
                        <TouchableOpacity
                          key={logic}
                          style={[
                            styles.triggerTypeButton,
                            newTrigger.logic === logic && styles.triggerTypeButtonActive,
                          ]}
                          onPress={() =>
                            setNewTrigger({ ...newTrigger, logic: newTrigger.logic === logic ? undefined : logic })
                          }
                        >
                          <Text
                            style={[
                              styles.triggerTypeText,
                              newTrigger.logic === logic && styles.triggerTypeTextActive,
                            ]}
                          >
                            {logic}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {newTrigger.type === 'location' && (
                  <>
                    <Text style={styles.label}>Location Event</Text>
                    {[
                      { value: 'enterHome', label: 'Enter Home' },
                      { value: 'exitHome', label: 'Exit Home' },
                      { value: 'useSpecific', label: 'Use Specific Location' },
                    ].map(event => (
                      <TouchableOpacity
                        key={event.value}
                        style={[
                          styles.modalOption,
                          newTrigger.value === event.value && styles.modalOptionSelected,
                        ]}
                        onPress={() => setNewTrigger({ ...newTrigger, value: event.value })}
                      >
                        <Text
                          style={[
                            styles.modalOptionText,
                            newTrigger.value === event.value && styles.modalOptionTextSelected,
                          ]}
                        >
                          {event.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    
                    {(newTrigger.value === 'enterHome' || newTrigger.value === 'exitHome') && (
                      <View style={styles.locationInfo}>
                        <IconSymbol
                          ios_icon_name="info.circle"
                          android_material_icon_name="info"
                          size={18}
                          color={colors.accent}
                        />
                        <Text style={styles.locationInfoText}>
                          Make sure your home location is set in Preferences. Location permissions are required for this feature to work.
                        </Text>
                      </View>
                    )}

                    {newTrigger.value === 'useSpecific' && (
                      <View style={styles.locationSection}>
                        <TouchableOpacity
                          style={styles.locationButton}
                          onPress={fetchCurrentLocation}
                        >
                          <IconSymbol
                            ios_icon_name="location"
                            android_material_icon_name="my-location"
                            size={20}
                            color={colors.primary}
                          />
                          <Text style={styles.locationButtonText}>Use Current Location</Text>
                        </TouchableOpacity>
                        
                        {homeLocation && (
                          <>
                            <View style={styles.locationDisplay}>
                              <Text style={styles.locationDisplayText}>
                                Lat: {homeLocation.latitude.toFixed(4)}, Lon: {homeLocation.longitude.toFixed(4)}
                              </Text>
                            </View>
                            
                            <Text style={styles.label}>Radius (km)</Text>
                            <TextInput
                              style={styles.input}
                              value={newTrigger.radius?.toString() || '5'}
                              onChangeText={(text) => {
                                const radius = parseFloat(text) || 5;
                                setNewTrigger({ ...newTrigger, radius });
                              }}
                              placeholder="5"
                              placeholderTextColor={colors.textSecondary}
                              keyboardType="decimal-pad"
                            />
                          </>
                        )}
                        
                        <Text style={styles.helpText}>
                          Alarm will trigger when you enter/exit the specified radius of this location
                        </Text>
                      </View>
                    )}
                    
                    {/* AND/OR Logic - Show AFTER location selection */}
                    <Text style={styles.label}>Combine with other triggers using</Text>
                    <View style={styles.triggerTypeRow}>
                      {(['AND', 'OR'] as const).map(logic => (
                        <TouchableOpacity
                          key={logic}
                          style={[
                            styles.triggerTypeButton,
                            newTrigger.logic === logic && styles.triggerTypeButtonActive,
                          ]}
                          onPress={() =>
                            setNewTrigger({ ...newTrigger, logic: newTrigger.logic === logic ? undefined : logic })
                          }
                        >
                          <Text
                            style={[
                              styles.triggerTypeText,
                              newTrigger.logic === logic && styles.triggerTypeTextActive,
                            ]}
                          >
                            {logic}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </ScrollView>

              <View style={styles.triggerModalButtons}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setShowTriggerModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.triggerSaveButton}
                  onPress={saveTrigger}
                >
                  <Text style={styles.triggerSaveButtonText}>
                    {editingTriggerIndex !== null ? 'Update' : 'Add'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Time Picker Modal - Using cross-platform DatePickerModal */}
      <DatePickerModal
        visible={showTimePicker}
        mode="time"
        value={parseTimeString(
          timePickerMode === 'value' ? (newTrigger.value || '09:00') :
          timePickerMode === 'min' ? (newTrigger.min || '06:00') :
          (newTrigger.max || '22:00')
        )}
        onConfirm={handleTimePickerConfirm}
        onCancel={handleTimePickerCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  errorBanner: {
    backgroundColor: '#FDECEA',
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
  },
  expoGoWarningBanner: {
    backgroundColor: '#FFF3CD',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 2,
    borderColor: '#FF9500',
  },
  expoGoWarningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#856404',
    marginBottom: 6,
  },
  expoGoWarningText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  scheduleInfoBanner: {
    backgroundColor: `${colors.primary}15`,
    padding: 12,
    margin: 16,
    marginBottom: 0,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  scheduleInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 2,
  },
  scheduleInfoText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  warningBanner: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '600',
  },
  warningSubtext: {
    color: '#856404',
    fontSize: 12,
    marginTop: 4,
  },
  warningLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  picker: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 16,
    color: colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helpText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  triggerItem: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  triggerText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  triggerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  addTriggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addTriggerText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    margin: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  modalOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalOptionText: {
    fontSize: 16,
    color: colors.text,
  },
  modalCancel: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  modalOptionSelected: {
    backgroundColor: `${colors.primary}20`,
  },
  modalOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  triggerTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  triggerTypeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  triggerTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  triggerTypeText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  triggerTypeTextActive: {
    color: colors.background,
    fontWeight: '600',
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  timePickerButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  locationInfo: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: `${colors.accent}15`,
    borderRadius: 8,
    marginTop: 12,
  },
  locationInfoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  locationSection: {
    marginTop: 12,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  locationButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  locationDisplay: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  locationDisplayText: {
    fontSize: 14,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  triggerModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  triggerSaveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  triggerSaveButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
});
