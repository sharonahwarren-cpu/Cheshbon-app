
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as supabaseApi from '@/utils/supabaseApi';

interface NotificationAlarm {
  id: string;
  name: string;
  time: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: string;
  dayOfMonth?: number;
}

interface UserPreferences {
  notificationsEnabled: boolean;
  notificationAlarms?: NotificationAlarm[];
  notifications_enabled?: boolean;
  notification_alarms?: NotificationAlarm[];
}

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    notificationsEnabled: false,
    notificationAlarms: [],
  });

  const [alarmModalVisible, setAlarmModalVisible] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<NotificationAlarm | null>(null);
  const [alarmName, setAlarmName] = useState('');
  const [alarmTime, setAlarmTime] = useState(new Date());
  const [alarmFrequency, setAlarmFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('daily');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    console.log('[NotificationPreferences] Loading notification preferences');
    setLoading(true);
    try {
      const prefs = await supabaseApi.getUserPreferences();
      console.log('[NotificationPreferences] Loaded preferences:', prefs);
      
      // Handle both snake_case and camelCase
      const notificationsEnabled = prefs?.notifications_enabled ?? prefs?.notificationsEnabled ?? false;
      let alarms = prefs?.notification_alarms ?? prefs?.notificationAlarms ?? [];
      
      // Parse if it's a JSON string
      if (typeof alarms === 'string') {
        try { 
          alarms = JSON.parse(alarms); 
        } catch { 
          alarms = []; 
        }
      }
      
      setPreferences({
        notificationsEnabled,
        notificationAlarms: Array.isArray(alarms) ? alarms : [],
      });
    } catch (error) {
      console.error('[NotificationPreferences] Error loading preferences:', error);
      showError('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (updatedPreferences: UserPreferences) => {
    console.log('[NotificationPreferences] Saving notification preferences:', updatedPreferences);
    setSaving(true);
    try {
      await supabaseApi.updateUserPreferences({
        notifications_enabled: updatedPreferences.notificationsEnabled,
        notification_alarms: updatedPreferences.notificationAlarms,
        // Keep camelCase for compatibility
        notificationsEnabled: updatedPreferences.notificationsEnabled,
        notificationAlarms: updatedPreferences.notificationAlarms,
      });
      showSuccess('Preferences saved');
    } catch (error) {
      console.error('[NotificationPreferences] Error saving preferences:', error);
      showError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(''), 3000);
  };

  const toggleNotifications = async (value: boolean) => {
    const updated = { ...preferences, notificationsEnabled: value };
    setPreferences(updated);
    await savePreferences(updated);
  };

  const openAddAlarmModal = () => {
    setEditingAlarm(null);
    setAlarmName('');
    setAlarmTime(new Date());
    setAlarmFrequency('daily');
    setAlarmModalVisible(true);
  };

  const openEditAlarmModal = (alarm: NotificationAlarm) => {
    console.log('[NotificationPreferences] Opening edit alarm modal for:', alarm);
    setEditingAlarm(alarm);
    setAlarmName(alarm.name);
    const [hours, minutes] = alarm.time.split(':');
    const time = new Date();
    time.setHours(parseInt(hours), parseInt(minutes));
    setAlarmTime(time);
    setAlarmFrequency(alarm.frequency);
    setAlarmModalVisible(true);
    console.log('[NotificationPreferences] Modal opened with time:', formatTime12Hour(time));
  };

  const handleSaveAlarm = async () => {
    const timeString = formatTime(alarmTime);
    const newAlarm: NotificationAlarm = {
      id: editingAlarm?.id || Date.now().toString(),
      name: alarmName,
      time: timeString,
      frequency: alarmFrequency,
    };

    const currentAlarms = preferences.notificationAlarms || [];
    const updatedAlarms = editingAlarm
      ? currentAlarms.map(a => a.id === editingAlarm.id ? newAlarm : a)
      : [...currentAlarms, newAlarm];

    const updated = { ...preferences, notificationAlarms: updatedAlarms };
    setPreferences(updated);
    await savePreferences(updated);
    setAlarmModalVisible(false);
  };

  const handleDeleteAlarm = async (alarmId: string) => {
    const updatedAlarms = (preferences.notificationAlarms || []).filter(a => a.id !== alarmId);
    const updated = { ...preferences, notificationAlarms: updatedAlarms };
    setPreferences(updated);
    await savePreferences(updated);
  };

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatTime12Hour = (date: Date): string => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr}${ampm}`;
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    console.log('[NotificationPreferences] Time picker changed:', event, selectedDate);
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedDate) {
      setAlarmTime(selectedDate);
      console.log('[NotificationPreferences] Alarm time updated to:', formatTime12Hour(selectedDate));
    }
  };

  const handleTimeButtonPress = () => {
    console.log('[NotificationPreferences] Time button pressed - opening time picker');
    setShowTimePicker(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ title: 'Notifications', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const timeDisplayText = formatTime12Hour(alarmTime);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Notifications', headerShown: true }} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Enable Notifications</Text>
            <Switch
              value={preferences.notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: colors.cardBorder, true: colors.primary }}
              thumbColor="#FFFFFF"
              disabled={saving}
            />
          </View>
          <Text style={styles.sectionDescription}>
            Set up notification alarms to remind you to reflect
          </Text>
          
          {preferences.notificationsEnabled && (
            <>
              <TouchableOpacity style={styles.addButton} onPress={openAddAlarmModal}>
                <IconSymbol
                  ios_icon_name="plus.circle.fill"
                  android_material_icon_name="add-circle"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.addButtonText}>Add Alarm</Text>
              </TouchableOpacity>

              {(preferences.notificationAlarms || []).map((alarm) => (
                <View key={alarm.id} style={styles.alarmCard}>
                  <View style={styles.alarmInfo}>
                    <Text style={styles.alarmName}>{alarm.name}</Text>
                    <Text style={styles.alarmDetails}>
                      {alarm.time} • {alarm.frequency}
                    </Text>
                  </View>
                  <View style={styles.alarmActions}>
                    <TouchableOpacity onPress={() => openEditAlarmModal(alarm)}>
                      <IconSymbol
                        ios_icon_name="pencil"
                        android_material_icon_name="edit"
                        size={20}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteAlarm(alarm.id)}>
                      <IconSymbol
                        ios_icon_name="trash"
                        android_material_icon_name="delete"
                        size={20}
                        color={colors.error}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      {/* Alarm Modal */}
      <Modal
        visible={alarmModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAlarmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingAlarm ? 'Edit Alarm' : 'Add Alarm'}
            </Text>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={alarmName}
              onChangeText={setAlarmName}
              placeholder="e.g., Morning Reflection"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Time</Text>
            {Platform.OS === 'ios' ? (
              <View style={styles.iosTimePickerContainer}>
                <DateTimePicker
                  value={alarmTime}
                  mode="time"
                  is24Hour={false}
                  display="spinner"
                  onChange={onTimeChange}
                  style={styles.iosTimePicker}
                  textColor={colors.text}
                />
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={handleTimeButtonPress}
                  activeOpacity={0.7}
                >
                  <Text style={styles.timeButtonText}>{timeDisplayText}</Text>
                  <IconSymbol
                    ios_icon_name="clock"
                    android_material_icon_name="access-time"
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
                {showTimePicker && (
                  <DateTimePicker
                    value={alarmTime}
                    mode="time"
                    is24Hour={false}
                    display="default"
                    onChange={onTimeChange}
                  />
                )}
              </>
            )}

            <Text style={styles.inputLabel}>Frequency</Text>
            <View style={styles.frequencyContainer}>
              {['daily', 'weekly', 'biweekly', 'monthly'].map((freq) => (
                <TouchableOpacity
                  key={freq}
                  style={[
                    styles.frequencyChip,
                    alarmFrequency === freq && styles.frequencyChipActive,
                  ]}
                  onPress={() => setAlarmFrequency(freq as any)}
                >
                  <Text
                    style={[
                      styles.frequencyChipText,
                      alarmFrequency === freq && styles.frequencyChipTextActive,
                    ]}
                  >
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setAlarmModalVisible(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveAlarm}
              >
                <Text style={styles.modalButtonTextSave}>Save</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  successBanner: {
    backgroundColor: colors.success,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: colors.error,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  alarmCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  alarmInfo: {
    flex: 1,
  },
  alarmName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  alarmDetails: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  alarmActions: {
    flexDirection: 'row',
    gap: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  timeButton: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timeButtonText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  iosTimePickerContainer: {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosTimePicker: {
    width: '100%',
    height: 180,
  },
  frequencyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  frequencyChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  frequencyChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  frequencyChipText: {
    fontSize: 14,
    color: colors.text,
  },
  frequencyChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modalButtonSave: {
    backgroundColor: colors.primary,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalButtonTextSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
