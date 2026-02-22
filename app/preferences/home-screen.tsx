
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedGet, authenticatedPut } from '@/utils/api';

export type CalendarType = 'gregorian' | 'hebrew' | 'chinese';

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

  return gregorian;
}

export default function AlternativeCalendarsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCalendar, setSelectedCalendar] = useState<CalendarType>('gregorian');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const today = new Date();

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
      await authenticatedPut('/api/user-preferences', { alternativeCalendar: calendar });
      console.log('[AlternativeCalendars] Calendar preference saved successfully');
      setSuccessMessage('Calendar preference saved');
      setTimeout(() => setSuccessMessage(''), 3000);
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
});
