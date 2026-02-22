
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
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { authenticatedGet, authenticatedPost, authenticatedPut } from '@/utils/api';
import { getLocalTimezone } from '@/utils/dateUtils';
import type { Alarm, AlarmTrigger, CalendarType, TriggerType } from '@/types/alarm';
import { requestAllAlarmPermissions, checkAllPermissions } from '@/utils/alarmPermissions';
import { getCurrentLocation } from '@/utils/alarmGeofencing';

const CALENDAR_TYPES: { value: CalendarType; label: string }[] = [
  { value: 'gregorian', label: 'Gregorian' },
  { value: 'hebrew', label: 'Hebrew' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'islamic', label: 'Islamic' },
];

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

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Alarm fields
  const [title, setTitle] = useState('');
  const [calendarType, setCalendarType] = useState<CalendarType | undefined>();
  const [eventType, setEventType] = useState<string | undefined>();
  const [triggers, setTriggers] = useState<AlarmTrigger[]>([]);
  const [recurring, setRecurring] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [useLocation, setUseLocation] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('100');

  // UI state
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [showEventPicker, setShowEventPicker] = useState(false);
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

  useEffect(() => {
    checkPermissions();
    if (isEditing) {
      loadAlarm();
    }
  }, []);

  const checkPermissions = async () => {
    const perms = await checkAllPermissions();
    setPermissions(perms);
  };

  const requestPermissions = async () => {
    const granted = await requestAllAlarmPermissions();
    if (granted) {
      await checkPermissions();
    }
  };

  const loadAlarm = async () => {
    console.log('Loading alarm for editing:', params.id);
    setLoading(true);

    try {
      console.log(`[API] Requesting GET /api/alarms/${params.id}...`);
      const response = await authenticatedGet<Alarm>(`/api/alarms/${params.id}`);
      const alarm = (response as any)?.data || response;

      setTitle(alarm.title);
      setCalendarType(alarm.calendarType);
      setEventType(alarm.eventType);
      setTriggers(alarm.triggers || []);
      setRecurring(alarm.recurring ?? false);
      setEnabled(alarm.enabled ?? true);

      if (alarm.location) {
        setUseLocation(true);
        setLatitude(alarm.location.latitude.toString());
        setLongitude(alarm.location.longitude.toString());
        setRadius((alarm.location.radius || 100).toString());
      }

      console.log('Alarm loaded for editing');
    } catch (err: any) {
      console.error('Error loading alarm:', err);
      setError(err.message || 'Failed to load alarm');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentLocation = async () => {
    console.log('Fetching current location');
    const location = await getCurrentLocation();

    if (location) {
      setLatitude(location.latitude.toString());
      setLongitude(location.longitude.toString());
      console.log('Current location set');
    } else {
      setError('Failed to get current location');
    }
  };

  const addTrigger = () => {
    setNewTrigger({ type: 'time', value: '09:00' });
    setEditingTriggerIndex(null);
    setShowTriggerModal(true);
  };

  const editTrigger = (index: number) => {
    setNewTrigger({ ...triggers[index] });
    setEditingTriggerIndex(index);
    setShowTriggerModal(true);
  };

  const saveTrigger = () => {
    if (editingTriggerIndex !== null) {
      const updated = [...triggers];
      updated[editingTriggerIndex] = newTrigger;
      setTriggers(updated);
    } else {
      setTriggers([...triggers, newTrigger]);
    }
    setShowTriggerModal(false);
  };

  const removeTrigger = (index: number) => {
    setTriggers(triggers.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    console.log('Saving alarm');

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

      if (useLocation && latitude && longitude) {
        alarmData.location = {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          radius: parseInt(radius) || 100,
        };
      }

      if (isEditing) {
        console.log(`[API] Requesting PUT /api/alarms/${params.id}...`);
        await authenticatedPut(`/api/alarms/${params.id}`, alarmData);
        console.log('Alarm updated successfully');
      } else {
        console.log('[API] Requesting POST /api/alarms...');
        await authenticatedPost('/api/alarms', alarmData);
        console.log('Alarm created successfully');
      }

      router.back();
    } catch (err: any) {
      console.error('Error saving alarm:', err);
      setError(err.message || 'Failed to save alarm');
    } finally {
      setSaving(false);
    }
  };

  const renderTriggerItem = (trigger: AlarmTrigger, index: number) => {
    let triggerText = '';

    switch (trigger.type) {
      case 'time':
        triggerText = `Time: ${trigger.value}`;
        break;
      case 'astronomical':
        triggerText = `Astronomical: ${trigger.value}`;
        if (trigger.min) triggerText += ` (not before ${trigger.min})`;
        if (trigger.max) triggerText += ` (not after ${trigger.max})`;
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

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: isEditing ? 'Edit Alarm' : 'Create Alarm',
          headerShown: true,
        }}
      />

      <ScrollView style={styles.scrollView}>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Permissions Warning */}
        {(!permissions.notifications || !permissions.foregroundLocation) && (
          <View style={styles.warningBanner}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle"
              android_material_icon_name="warning"
              size={20}
              color={colors.warning}
            />
            <Text style={styles.warningText}>
              Some permissions are missing. Alarms may not work correctly.
            </Text>
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
            placeholder="e.g., Rosh Chodesh Reminder"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Calendar Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Calendar Type (Optional)</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowCalendarPicker(true)}
          >
            <Text style={styles.pickerText}>
              {calendarType
                ? CALENDAR_TYPES.find(c => c.value === calendarType)?.label
                : 'Select calendar type'}
            </Text>
            <IconSymbol
              ios_icon_name="chevron.down"
              android_material_icon_name="arrow-drop-down"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Event Type (if Hebrew calendar selected) */}
        {calendarType === 'hebrew' && (
          <View style={styles.section}>
            <Text style={styles.label}>Event Type</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowEventPicker(true)}
            >
              <Text style={styles.pickerText}>
                {eventType
                  ? HEBREW_EVENTS.find(e => e.value === eventType)?.label
                  : 'Select event'}
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
            <Text style={styles.label}>Triggers *</Text>
            <TouchableOpacity onPress={addTrigger}>
              <IconSymbol
                ios_icon_name="plus.circle"
                android_material_icon_name="add-circle"
                size={24}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          {triggers.length === 0 ? (
            <Text style={styles.emptyText}>No triggers added yet</Text>
          ) : (
            triggers.map((trigger, index) => renderTriggerItem(trigger, index))
          )}
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

        {/* Location */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={styles.label}>Use Specific Location</Text>
            <Switch
              value={useLocation}
              onValueChange={setUseLocation}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={useLocation ? colors.background : colors.textSecondary}
            />
          </View>

          {useLocation && (
            <>
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

              <View style={styles.locationInputs}>
                <View style={styles.locationInputRow}>
                  <Text style={styles.locationLabel}>Latitude:</Text>
                  <TextInput
                    style={styles.locationInput}
                    value={latitude}
                    onChangeText={setLatitude}
                    placeholder="-37.8136"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.locationInputRow}>
                  <Text style={styles.locationLabel}>Longitude:</Text>
                  <TextInput
                    style={styles.locationInput}
                    value={longitude}
                    onChangeText={setLongitude}
                    placeholder="144.9631"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.locationInputRow}>
                  <Text style={styles.locationLabel}>Radius (m):</Text>
                  <TextInput
                    style={styles.locationInput}
                    value={radius}
                    onChangeText={setRadius}
                    placeholder="100"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </>
          )}
        </View>

        {/* Enabled */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={styles.label}>Enabled</Text>
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

      {/* Calendar Type Picker Modal */}
      <Modal visible={showCalendarPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Calendar Type</Text>
            {CALENDAR_TYPES.map(cal => (
              <TouchableOpacity
                key={cal.value}
                style={styles.modalOption}
                onPress={() => {
                  setCalendarType(cal.value);
                  setShowCalendarPicker(false);
                }}
              >
                <Text style={styles.modalOptionText}>{cal.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowCalendarPicker(false)}
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
            <Text style={styles.modalTitle}>Select Event</Text>
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
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingTriggerIndex !== null ? 'Edit Trigger' : 'Add Trigger'}
            </Text>

            {/* Trigger Type */}
            <Text style={styles.label}>Trigger Type</Text>
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
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Trigger Value */}
            {newTrigger.type === 'time' && (
              <>
                <Text style={styles.label}>Time (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={newTrigger.value || ''}
                  onChangeText={val => setNewTrigger({ ...newTrigger, value: val })}
                  placeholder="09:00"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numbers-and-punctuation"
                />
              </>
            )}

            {newTrigger.type === 'astronomical' && (
              <>
                <Text style={styles.label}>Astronomical Event</Text>
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

                <Text style={styles.label}>Not Before (optional, HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={newTrigger.min || ''}
                  onChangeText={val => setNewTrigger({ ...newTrigger, min: val || undefined })}
                  placeholder="06:00"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numbers-and-punctuation"
                />

                <Text style={styles.label}>Not After (optional, HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={newTrigger.max || ''}
                  onChangeText={val => setNewTrigger({ ...newTrigger, max: val || undefined })}
                  placeholder="22:00"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numbers-and-punctuation"
                />
              </>
            )}

            {newTrigger.type === 'location' && (
              <>
                <Text style={styles.label}>Location Event</Text>
                {[
                  { value: 'enterHome', label: 'Enter Home' },
                  { value: 'exitHome', label: 'Exit Home' },
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
              </>
            )}

            {/* Logic (AND/OR) for combining with other triggers */}
            {triggers.length > 0 && (
              <>
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
        </View>
      </Modal>
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
    flex: 1,
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
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
    marginTop: 8,
  },
  locationButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  locationInputs: {
    marginTop: 12,
  },
  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationLabel: {
    fontSize: 14,
    color: colors.text,
    width: 100,
  },
  locationInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: colors.text,
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
