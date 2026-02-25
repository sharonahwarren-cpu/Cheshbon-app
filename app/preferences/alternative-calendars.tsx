
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedGet, authenticatedPut } from '@/utils/api';
import { getLocalTimezone } from '@/utils/dateUtils';

export type CalendarType = 'gregorian' | 'hebrew' | 'chinese' | 'islamic';

const CALENDAR_OPTIONS: { value: CalendarType; label: string; description: string; emoji: string }[] = [
  {
    value: 'gregorian',
    label: 'Gregorian (Default)',
    description: 'Standard international calendar used worldwide',
    emoji: '📅',
  },
  {
    value: 'hebrew',
    label: 'Hebrew Calendar',
    description: 'Lunisolar calendar used in Jewish tradition. Dates will show both Gregorian and Hebrew.',
    emoji: '✡️',
  },
  {
    value: 'chinese',
    label: 'Chinese Calendar',
    description: 'Traditional lunisolar calendar. Dates will show both Gregorian and Chinese.',
    emoji: '🏮',
  },
  {
    value: 'islamic',
    label: 'Islamic Calendar',
    description: 'Lunar calendar used in Islamic tradition. Dates will show both Gregorian and Islamic.',
    emoji: '☪️',
  },
];

function toHebrewDate(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return formatter.format(date);
  } catch {
    return 'Hebrew date unavailable';
  }
}

function toChineseDate(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return formatter.format(date);
  } catch {
    return 'Chinese date unavailable';
  }
}

function toIslamicDate(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return formatter.format(date);
  } catch {
    return 'Islamic date unavailable';
  }
}

export function formatDualDate(date: Date, calendarType: CalendarType): string {
  const gregorian = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (calendarType === 'gregorian') {
    return gregorian;
  }

  if (calendarType === 'hebrew') {
    const hebrew = toHebrewDate(date);
    return `${gregorian} / ${hebrew}`;
  }

  if (calendarType === 'chinese') {
    const chinese = toChineseDate(date);
    return `${gregorian} / ${chinese}`;
  }

  if (calendarType === 'islamic') {
    const islamic = toIslamicDate(date);
    return `${gregorian} / ${islamic}`;
  }

  return gregorian;
}

export default function AlternativeCalendarsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCalendar, setSelectedCalendar] = useState<CalendarType>('gregorian');
  const [mitzvotGoalsEnabled, setMitzvotGoalsEnabled] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const today = new Date();
  const deviceTimezone = getLocalTimezone();

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    console.log('[AlternativeCalendars] Loading preferences');
    setLoading(true);
    try {
      const data = await authenticatedGet<any>('/api/user-preferences');
      console.log('[AlternativeCalendars] Preferences loaded:', data);
      const prefs = (data as any)?.data || data;
      setSelectedCalendar((prefs.alternativeCalendar as CalendarType) ?? 'gregorian');
      setMitzvotGoalsEnabled(prefs.mitzvotGoalsEnabled ?? false);
      
      // Log the stored timezone vs device timezone for debugging
      const storedTimezone = prefs.timezone;
      const currentDeviceTimezone = getLocalTimezone();
      console.log('[AlternativeCalendars] Timezone info:', {
        stored: storedTimezone,
        device: currentDeviceTimezone,
        match: storedTimezone === currentDeviceTimezone,
      });
      
      // If timezone has changed (e.g., user traveled), auto-update it
      if (storedTimezone && storedTimezone !== currentDeviceTimezone) {
        console.log('[AlternativeCalendars] Timezone changed, updating to:', currentDeviceTimezone);
        try {
          await authenticatedPut('/api/user-preferences', { timezone: currentDeviceTimezone });
          console.log('[AlternativeCalendars] Timezone updated to:', currentDeviceTimezone);
        } catch (tzError) {
          console.warn('[AlternativeCalendars] Failed to update timezone:', tzError);
        }
      }
    } catch (error) {
      console.error('[AlternativeCalendars] Error loading preferences:', error);
      setErrorMessage('Failed to load preferences');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const saveCalendar = async (calendar: CalendarType) => {
    console.log('[AlternativeCalendars] Saving calendar preference:', calendar);
    setSaving(true);
    try {
      // Detect device timezone and save alongside calendar preference
      const deviceTimezone = getLocalTimezone();
      console.log('[AlternativeCalendars] Device timezone detected:', deviceTimezone);
      
      // Save both the calendar preference and the device timezone to the backend
      await authenticatedPut('/api/user-preferences', { 
        alternativeCalendar: calendar,
        timezone: deviceTimezone,
      });
      console.log('[AlternativeCalendars] Calendar preference and timezone saved successfully:', { calendar, timezone: deviceTimezone });
      setSuccessMessage(`Calendar preference saved (Timezone: ${deviceTimezone})`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (error) {
      console.error('[AlternativeCalendars] Error saving preferences:', error);
      setErrorMessage('Failed to save preferences');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const selectCalendar = async (calendar: CalendarType) => {
    setSelectedCalendar(calendar);
    await saveCalendar(calendar);
  };

  const toggleMitzvotGoals = async (enabled: boolean) => {
    console.log('[AlternativeCalendars] Toggling Mitzvot goals:', enabled);
    setMitzvotGoalsEnabled(enabled);
    setSaving(true);
    try {
      await authenticatedPut('/api/user-preferences', { mitzvotGoalsEnabled: enabled });
      console.log('[AlternativeCalendars] Mitzvot goals preference saved');
      setSuccessMessage(enabled ? 'Mitzvot goals activated' : 'Mitzvot goals deactivated');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('[AlternativeCalendars] Error saving Mitzvot preference:', error);
      setErrorMessage('Failed to save preference');
      setTimeout(() => setErrorMessage(''), 3000);
      // Revert on error
      setMitzvotGoalsEnabled(!enabled);
    } finally {
      setSaving(false);
    }
  };

  const handleManageMitzvot = () => {
    console.log('[AlternativeCalendars] Navigating to Mitzvot screen');
    router.push('/mitzvot' as any);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ title: 'Alternative Calendars', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const showMitzvotSection = selectedCalendar === 'hebrew';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Alternative Calendars', headerShown: true }} />

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

        <Text style={styles.description}>
          Choose an alternative calendar to display alongside the standard Gregorian calendar.
          When an alternative calendar is selected, all date fields will show both dates.
        </Text>

        {CALENDAR_OPTIONS.map((option) => {
          const isSelected = selectedCalendar === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.optionCard, isSelected && styles.optionCardSelected]}
              onPress={() => selectCalendar(option.value)}
              disabled={saving}
            >
              <View style={styles.optionHeader}>
                <Text style={styles.optionEmoji}>{option.emoji}</Text>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.optionDescription, isSelected && styles.optionDescriptionSelected]}>
                    {option.description}
                  </Text>
                </View>
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

        {showMitzvotSection && (
          <View style={styles.mitzvotSection}>
            <View style={styles.mitzvotHeader}>
              <View style={styles.mitzvotTitleRow}>
                <IconSymbol
                  ios_icon_name="star.fill"
                  android_material_icon_name="star"
                  size={24}
                  color={colors.accent}
                />
                <Text style={styles.mitzvotTitle}>Mitzvot Goals</Text>
              </View>
              <Switch
                value={mitzvotGoalsEnabled}
                onValueChange={toggleMitzvotGoals}
                disabled={saving}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>
            <Text style={styles.mitzvotDescription}>
              Enable Mitzvot goals to track the 613 commandments from Jewish tradition. You can manage and import Mitzvot from a CSV file.
            </Text>
            {mitzvotGoalsEnabled && (
              <TouchableOpacity
                style={styles.manageMitzvotButton}
                onPress={handleManageMitzvot}
              >
                <IconSymbol
                  ios_icon_name="list.bullet"
                  android_material_icon_name="list"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.manageMitzvotButtonText}>Manage Mitzvot & Import CSV</Text>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        {selectedCalendar !== 'gregorian' && (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Date Preview</Text>
            <Text style={styles.previewSubtitle}>Today's date will appear as:</Text>
            <View style={styles.previewDateContainer}>
              <IconSymbol
                ios_icon_name="calendar"
                android_material_icon_name="calendar-today"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.previewDate}>
                {formatDualDate(today, selectedCalendar)}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <IconSymbol
              ios_icon_name="info.circle.fill"
              android_material_icon_name="info"
              size={20}
              color={colors.accent}
            />
            <Text style={styles.infoTitle}>How it works</Text>
          </View>
          <Text style={styles.infoText}>
            When an alternative calendar is selected:
          </Text>
          <Text style={styles.infoItem}>• All date fields show both Gregorian and alternative dates</Text>
          <Text style={styles.infoItem}>• Goal scheduling and alarms can be set using either calendar</Text>
          <Text style={styles.infoItem}>• The Gregorian calendar remains the primary system calendar</Text>
          <Text style={styles.infoItem}>• All dates are stored as UTC timestamps for accuracy across timezones</Text>
          <View style={styles.timezoneRow}>
            <IconSymbol
              ios_icon_name="clock.fill"
              android_material_icon_name="schedule"
              size={16}
              color={colors.accent}
            />
            <Text style={styles.timezoneText}>Device timezone: {deviceTimezone}</Text>
          </View>
        </View>
      </ScrollView>
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
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
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
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  optionTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  optionLabelSelected: {
    color: colors.primary,
  },
  optionDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  optionDescriptionSelected: {
    color: colors.primary,
    opacity: 0.8,
  },
  mitzvotSection: {
    backgroundColor: `${colors.accent}10`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: `${colors.accent}30`,
  },
  mitzvotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mitzvotTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mitzvotTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  mitzvotDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  manageMitzvotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manageMitzvotButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  previewDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.highlight,
    borderRadius: 8,
    padding: 12,
  },
  previewDate: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
    flexWrap: 'wrap',
  },
  infoCard: {
    backgroundColor: `${colors.accent}15`,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: `${colors.accent}30`,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  infoItem: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 2,
  },
  timezoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: `${colors.accent}20`,
  },
  timezoneText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
});
