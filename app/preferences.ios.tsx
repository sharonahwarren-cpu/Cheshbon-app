
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
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedGet, authenticatedPut } from '@/utils/api';

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
  reflectionCategoriesEnabled?: boolean;
  reflectionCategories?: string[];
  preferredHomeScreen?: 'reflect' | 'goals-detailed' | 'goals-concise';
}

const BEHAVIOR_CATEGORIES = ['Action', 'Speech', 'Thought', 'Feeling'];
const HOME_SCREEN_OPTIONS = [
  { value: 'reflect', label: 'Reflect' },
  { value: 'goals-detailed', label: 'Goals Detailed' },
  { value: 'goals-concise', label: 'Goals Concise' },
];

export default function PreferencesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    notificationsEnabled: false,
    notificationAlarms: [],
    reflectionCategoriesEnabled: true,
    reflectionCategories: BEHAVIOR_CATEGORIES,
    preferredHomeScreen: 'reflect',
  });

  const [alarmModalVisible, setAlarmModalVisible] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<NotificationAlarm | null>(null);
  const [alarmName, setAlarmName] = useState('');
  const [alarmTime, setAlarmTime] = useState(new Date());
  const [alarmFrequency, setAlarmFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('daily');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    console.log('Loading user preferences');
    setLoading(true);
    try {
      const data = await authenticatedGet<UserPreferences>('/api/user-preferences');
      console.log('Preferences loaded:', data);
      // Handle both direct and nested response formats
      const prefs = (data as any)?.data || data;
      // Parse notificationAlarms if it's a JSON string
      let alarms = prefs.notificationAlarms ?? [];
      if (typeof alarms === 'string') {
        try { alarms = JSON.parse(alarms); } catch { alarms = []; }
      }
      // Parse reflectionCategories if it's a JSON string
      let categories = prefs.reflectionCategories ?? BEHAVIOR_CATEGORIES;
      if (typeof categories === 'string') {
        try { categories = JSON.parse(categories); } catch { categories = BEHAVIOR_CATEGORIES; }
      }
      setPreferences({
        notificationsEnabled: prefs.notificationsEnabled ?? false,
        notificationAlarms: Array.isArray(alarms) ? alarms : [],
        reflectionCategoriesEnabled: prefs.reflectionCategoriesEnabled ?? true,
        reflectionCategories: Array.isArray(categories) ? categories : BEHAVIOR_CATEGORIES,
        preferredHomeScreen: prefs.preferredHomeScreen ?? 'reflect',
      });
    } catch (error) {
      console.error('Error loading preferences:', error);
      showError('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (updatedPreferences: UserPreferences) => {
    console.log('Saving preferences:', updatedPreferences);
    setSaving(true);
    try {
      await authenticatedPut('/api/user-preferences', updatedPreferences);
      console.log('Preferences saved successfully');
      showSuccess('Preferences saved');
    } catch (error) {
      console.error('Error saving preferences:', error);
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

  const toggleReflectionCategories = async (value: boolean) => {
    const updated = { ...preferences, reflectionCategoriesEnabled: value };
    setPreferences(updated);
    await savePreferences(updated);
  };

  const toggleCategory = async (category: string) => {
    const currentCategories = preferences.reflectionCategories || [];
    const updatedCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];
    
    const updated = { ...preferences, reflectionCategories: updatedCategories };
    setPreferences(updated);
    await savePreferences(updated);
  };

  const selectHomeScreen = async (value: 'reflect' | 'goals-detailed' | 'goals-concise') => {
    const updated = { ...preferences, preferredHomeScreen: value };
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
    setEditingAlarm(alarm);
    setAlarmName(alarm.name);
    const [hours, minutes] = alarm.time.split(':');
    const time = new Date();
    time.setHours(parseInt(hours), parseInt(minutes));
    setAlarmTime(time);
    setAlarmFrequency(alarm.frequency);
    setAlarmModalVisible(true);
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

  const onTimeChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setAlarmTime(selectedDate);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ title: 'Preferences', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Preferences', headerShown: true }} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Success/Error Messages */}
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

        {/* Home Screen Preference */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Home Screen</Text>
          <Text style={styles.sectionDescription}>
            Choose which screen to show first when you open the app
          </Text>
          {HOME_SCREEN_OPTIONS.map((option) => {
            const isSelected = preferences.preferredHomeScreen === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => selectHomeScreen(option.value as any)}
              >
                <View style={styles.optionContent}>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {option.label}
                  </Text>
                  {isSelected && (
                    <IconSymbol
                      ios_icon_name="checkmark.circle.fill"
                      android_material_icon_name="check-circle"
                      size={24}
                      color={colors.primary}
                    />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Reflection Preferences */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reflection Preferences</Text>
            <Switch
              value={preferences.reflectionCategoriesEnabled}
              onValueChange={toggleReflectionCategories}
              trackColor={{ false: colors.cardBorder, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <Text style={styles.sectionDescription}>
            Enable or disable specific behavior categories for reflections
          </Text>
          {preferences.reflectionCategoriesEnabled && (
            <View style={styles.categoriesContainer}>
              {BEHAVIOR_CATEGORIES.map((category) => {
                const isEnabled = (preferences.reflectionCategories || []).includes(category);
                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.categoryChip, isEnabled && styles.categoryChipActive]}
                    onPress={() => toggleCategory(category)}
                  >
                    <Text style={[styles.categoryChipText, isEnabled && styles.categoryChipTextActive]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <Switch
              value={preferences.notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: colors.cardBorder, true: colors.primary }}
              thumbColor="#FFFFFF"
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
            <DateTimePicker
              value={alarmTime}
              mode="time"
              is24Hour={true}
              display="spinner"
              onChange={onTimeChange}
              style={styles.timePicker}
            />

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
    paddingHorizontal: 20,
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
  optionCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.cardBorder,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  optionLabelSelected: {
    color: colors.primary,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: colors.text,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
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
  timePicker: {
    marginBottom: 16,
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
