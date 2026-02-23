
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { DatePickerModal } from './DatePickerModal';
import { DateTime } from 'luxon';
import { useRouter } from 'expo-router';
import { generateScheduleSummary } from '@/utils/scheduleDescriptions';
import { authenticatedGet } from '@/utils/api';

export type ScheduleType = 'Always Active' | 'Daily' | 'Weekly' | 'Fortnightly' | 'Monthly' | 'Yearly';
export type CalendarType = 'gregorian' | 'hebrew' | 'chinese' | 'islamic';

export interface WeekdayPosition {
  weekday: number; // 0-6 (Sunday-Saturday)
  position: number; // 1-4 for 1st-4th, 5 for last
}

export interface ScheduleConfig {
  scheduleType: ScheduleType;
  
  // Daily
  timesPerDay?: number;
  specificTimes?: Array<{ hour: number; minute: number; label?: string }>;
  
  // Weekly
  weekdays?: number[]; // 0-6 (Sunday-Saturday)
  weekendsOnly?: boolean;
  weekdaysOnly?: boolean;
  
  // Fortnightly - UPDATED: Now uses Week 1 / Week 2 instead of even/odd
  fortnightDays?: number[]; // 0-13
  fortnightWeek?: 'week1' | 'week2'; // Week 1 or Week 2
  
  // Monthly
  monthlyDates?: number[]; // [1, 15, 30]
  monthlyNthDay?: Array<{ day: string; nth: number }>; // "Second Tuesday"
  monthlyWeekdayPositions?: WeekdayPosition[]; // NEW: e.g., [{weekday: 5, position: 1}, {weekday: 0, position: 5}] = 1st Friday and last Sunday
  monthlyRangeStart?: number;
  monthlyRangeEnd?: number;
  monthlyRandomCount?: number;
  monthlyCalendarType?: CalendarType;
  monthlyUseAlternativeCalendar?: boolean; // NEW: Flag to show calendar type selector
  monthlyCalendarEvent?: string; // NEW: Hebrew calendar event
  
  // Yearly
  yearlyMonths?: number[]; // [1, 6, 12]
  yearlyDates?: Array<{ month: number; day: number; endMonth?: number; endDay?: number }>;
  yearlyCalendarType?: CalendarType;
  yearlyUseAlternativeCalendar?: boolean; // NEW: Flag to show calendar type selector
  yearlyCalendarEvent?: string; // NEW: Hebrew calendar event
  
  // Advanced
  calendarType?: CalendarType;
  startDate?: Date;
  endDate?: Date;
  exclusionDates?: Date[];
  
  // Alarms - moved outside
  alarmsEnabled?: boolean;
}

interface OccurrenceWithSource {
  date: string;
  source: {
    section: string;
    details: string;
  };
}

interface BackendScheduleSummary {
  summary: string;
  nextOccurrences: OccurrenceWithSource[];
  calendarType?: string;
}

interface GoalSchedulerProps {
  config: ScheduleConfig;
  onChange: (config: ScheduleConfig) => void;
  alternativeCalendar?: CalendarType;
  goalId?: string; // When editing an existing goal, pass the goal ID to fetch backend summary
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_POSITIONS = ['First', 'Second', 'Third', 'Fourth', 'Last'];

const CALENDAR_TYPES: CalendarType[] = ['gregorian', 'hebrew'];
const CALENDAR_LABELS = {
  gregorian: 'Gregorian',
  hebrew: 'Hebrew',
  chinese: 'Chinese',
  islamic: 'Islamic',
};

const CALENDAR_MAX_DAYS = {
  gregorian: 31,
  hebrew: 30,
  chinese: 30,
  islamic: 30,
};

const GREGORIAN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HEBREW_MONTHS = ['Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul', 'Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar'];
const CHINESE_MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const ISLAMIC_MONTHS = ['Muharram', 'Safar', 'Rabi I', 'Rabi II', 'Jumada I', 'Jumada II', 'Rajab', 'Shaban', 'Ramadan', 'Shawwal', 'Dhul-Qidah', 'Dhul-Hijjah'];

// Hebrew Calendar Events (same as in Alarm section)
const HEBREW_EVENTS = [
  'Rosh Hashanah',
  'Yom Kippur',
  'Sukkot',
  'Shemini Atzeret',
  'Simchat Torah',
  'Chanukah',
  'Tu BiShvat',
  'Purim',
  'Pesach',
  'Lag BaOmer',
  'Shavuot',
  'Tisha BAv',
  'Rosh Chodesh', // NEW: Added Rosh Chodesh
];

export function GoalScheduler({ config, onChange, alternativeCalendar, goalId }: GoalSchedulerProps) {
  const router = useRouter();
  const [showDatePicker, setShowDatePicker] = useState<'end' | 'exclusion' | null>(null);
  const [tempDate, setTempDate] = useState(new Date());
  const [showMonthlyAdvanced, setShowMonthlyAdvanced] = useState(false);
  const [showYearlyAdvanced, setShowYearlyAdvanced] = useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [showCalendarEventPicker, setShowCalendarEventPicker] = useState(false);
  const [calendarEventContext, setCalendarEventContext] = useState<'monthly' | 'yearly'>('monthly');
  const [showWeekdayPositionPicker, setShowWeekdayPositionPicker] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState<OccurrenceWithSource | null>(null);
  
  // State for weekday position picker
  const [selectedWeekday, setSelectedWeekday] = useState<number>(0);
  const [selectedPosition, setSelectedPosition] = useState<number>(1);
  
  // State for yearly date range inputs
  const [yearlyRangeStart, setYearlyRangeStart] = useState('');
  const [yearlyRangeEnd, setYearlyRangeEnd] = useState('');

  // Backend schedule summary state
  const [backendSummary, setBackendSummary] = useState<BackendScheduleSummary | null>(null);
  const [loadingBackendSummary, setLoadingBackendSummary] = useState(false);
  const [backendSummaryError, setBackendSummaryError] = useState<string | null>(null);

  // Generate local schedule summary (used as fallback)
  const localScheduleSummary = generateScheduleSummary(config);

  // Fetch backend schedule summary when goalId is available
  useEffect(() => {
    if (goalId && config.scheduleType !== 'Always Active') {
      fetchBackendScheduleSummary();
    } else {
      setBackendSummary(null);
    }
  }, [goalId, config.scheduleType]);

  const fetchBackendScheduleSummary = async () => {
    if (!goalId) return;
    console.log('[GoalScheduler] Fetching backend schedule summary for goal:', goalId);
    setLoadingBackendSummary(true);
    setBackendSummaryError(null);
    try {
      const result = await authenticatedGet<BackendScheduleSummary>(`/api/goals/${goalId}/schedule-summary`);
      console.log('[GoalScheduler] Backend schedule summary received:', result);
      setBackendSummary(result);
    } catch (error: any) {
      console.error('[GoalScheduler] Error fetching backend schedule summary:', error);
      setBackendSummaryError(error.message || 'Failed to load schedule summary');
      setBackendSummary(null);
    } finally {
      setLoadingBackendSummary(false);
    }
  };

  // Use backend summary if available, otherwise fall back to local
  const scheduleSummary = backendSummary?.summary || localScheduleSummary;

  const updateConfig = (updates: Partial<ScheduleConfig>) => {
    onChange({ ...config, ...updates });
  };

  // Auto-highlight weekdays when weekendsOnly or weekdaysOnly is toggled
  useEffect(() => {
    if (config.scheduleType === 'Weekly') {
      if (config.weekendsOnly) {
        updateConfig({ weekdays: [0, 6], weekdaysOnly: false });
      } else if (config.weekdaysOnly) {
        updateConfig({ weekdays: [1, 2, 3, 4, 5], weekendsOnly: false });
      }
    }
  }, [config.weekendsOnly, config.weekdaysOnly]);

  const handleDatePickerConfirm = (selectedDate: Date) => {
    console.log('User confirmed date selection:', selectedDate);
    if (showDatePicker === 'end') {
      updateConfig({ endDate: selectedDate });
    } else if (showDatePicker === 'exclusion') {
      const current = config.exclusionDates || [];
      updateConfig({ exclusionDates: [...current, selectedDate] });
    }
    setShowDatePicker(null);
  };

  const handleDatePickerCancel = () => {
    console.log('User cancelled date picker');
    setShowDatePicker(null);
  };

  // NEW: Handle alternative calendar toggle with data cleanup
  const handleAlternativeCalendarToggle = (context: 'monthly' | 'yearly', newValue: boolean) => {
    console.log(`[GoalScheduler] Alternative calendar toggle: ${context}, newValue: ${newValue}`);
    
    if (context === 'monthly') {
      if (newValue) {
        // Turning ON alternative calendar - REMOVE Gregorian dates
        console.log('[GoalScheduler] Clearing Gregorian monthly dates');
        updateConfig({
          monthlyUseAlternativeCalendar: true,
          monthlyCalendarType: alternativeCalendar || 'hebrew',
          monthlyDates: undefined, // Clear selected dates
          monthlyWeekdayPositions: undefined, // Clear weekday positions
          monthlyRangeStart: undefined, // Clear range
          monthlyRangeEnd: undefined,
          monthlyRandomCount: undefined, // Clear random count
        });
      } else {
        // Turning OFF alternative calendar - NULLIFY alternative calendar dates
        console.log('[GoalScheduler] Clearing alternative calendar monthly data');
        updateConfig({
          monthlyUseAlternativeCalendar: false,
          monthlyCalendarType: 'gregorian',
          monthlyCalendarEvent: undefined, // Clear calendar event
        });
      }
    } else if (context === 'yearly') {
      if (newValue) {
        // Turning ON alternative calendar - REMOVE Gregorian dates
        console.log('[GoalScheduler] Clearing Gregorian yearly dates');
        updateConfig({
          yearlyUseAlternativeCalendar: true,
          yearlyCalendarType: alternativeCalendar || 'hebrew',
          yearlyMonths: undefined, // Clear selected months
          yearlyDates: undefined, // Clear specific dates
        });
      } else {
        // Turning OFF alternative calendar - NULLIFY alternative calendar dates
        console.log('[GoalScheduler] Clearing alternative calendar yearly data');
        updateConfig({
          yearlyUseAlternativeCalendar: false,
          yearlyCalendarType: 'gregorian',
          yearlyCalendarEvent: undefined, // Clear calendar event
        });
      }
    }
  };

  // NEW: Navigate to the section that generated a specific occurrence
  const handleOccurrencePress = (occurrence: OccurrenceWithSource) => {
    console.log('[GoalScheduler] User tapped occurrence:', occurrence);
    setSelectedOccurrence(occurrence);
    setShowSourceModal(true);
  };

  // NEW: Scroll to and highlight the relevant section
  const navigateToSection = (section: string) => {
    console.log('[GoalScheduler] Navigating to section:', section);
    setShowSourceModal(false);
    
    // Expand the relevant advanced section if needed
    if (section.includes('Date Range') || section.includes('Random')) {
      if (config.scheduleType === 'Monthly') {
        setShowMonthlyAdvanced(true);
      } else if (config.scheduleType === 'Yearly') {
        setShowYearlyAdvanced(true);
      }
    }
    
    // TODO: Could add scroll-to-section logic here if needed
    // For now, just expanding the section is sufficient
  };

  const renderScheduleTypeSelector = () => {
    const scheduleTypes: ScheduleType[] = ['Always Active', 'Daily', 'Weekly', 'Fortnightly', 'Monthly', 'Yearly'];
    
    return (
      <View style={styles.section}>
        <Text style={styles.label}>Schedule Type</Text>
        <View style={styles.typeGrid}>
          {scheduleTypes.map((type) => {
            const isSelected = config.scheduleType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.typeButton, isSelected && styles.typeButtonSelected]}
                onPress={() => updateConfig({ scheduleType: type })}
              >
                <Text style={[styles.typeButtonText, isSelected && styles.typeButtonTextSelected]}>
                  {type}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderScheduleSummary = () => {
    if (config.scheduleType === 'Always Active') {
      return null; // No summary needed for "Always Active"
    }

    return (
      <View style={styles.summaryContainer}>
        <View style={styles.summaryHeader}>
          <IconSymbol
            ios_icon_name="calendar"
            android_material_icon_name="event"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.summaryTitle}>Schedule Summary</Text>
          {goalId && (
            <TouchableOpacity
              onPress={fetchBackendScheduleSummary}
              disabled={loadingBackendSummary}
              style={styles.refreshButton}
            >
              {loadingBackendSummary ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <IconSymbol
                  ios_icon_name="arrow.clockwise"
                  android_material_icon_name="refresh"
                  size={16}
                  color={colors.primary}
                />
              )}
            </TouchableOpacity>
          )}
        </View>
        {loadingBackendSummary ? (
          <View style={styles.summaryLoadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.summaryLoadingText}>Loading schedule summary...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.summaryText}>{scheduleSummary}</Text>
            {backendSummaryError && !backendSummary && (
              <Text style={styles.summaryFallbackNote}>
                (Showing local summary — tap refresh to retry)
              </Text>
            )}
            {backendSummary?.nextOccurrences && backendSummary.nextOccurrences.length > 0 && (
              <View style={styles.nextOccurrencesContainer}>
                <Text style={styles.nextOccurrencesTitle}>Next Occurrences:</Text>
                <Text style={styles.nextOccurrencesHint}>
                  Tap any date to see which schedule section generated it
                </Text>
                {backendSummary.nextOccurrences.map((occurrence, index) => {
                  // CRITICAL FIX: Always extract the date string, never render the object
                  const dateText = occurrence.date;
                  const hasSource = occurrence.source && occurrence.source.section;
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={styles.nextOccurrenceRow}
                      onPress={() => hasSource ? handleOccurrencePress(occurrence) : undefined}
                      disabled={!hasSource}
                    >
                      <IconSymbol
                        ios_icon_name="circle.fill"
                        android_material_icon_name="circle"
                        size={6}
                        color={index === 0 ? colors.primary : colors.textSecondary}
                      />
                      <Text style={[
                        styles.nextOccurrenceText,
                        index === 0 && styles.nextOccurrenceTextFirst,
                        hasSource && styles.nextOccurrenceTextClickable,
                      ]}>
                        {dateText}
                      </Text>
                      {hasSource && (
                        <IconSymbol
                          ios_icon_name="info.circle"
                          android_material_icon_name="info"
                          size={16}
                          color={colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  const renderDailyOptions = () => {
    if (config.scheduleType !== 'Daily') return null;

    return (
      <View style={styles.optionsContainer}>
        <Text style={styles.subLabel}>Times per day (optional)</Text>
        <TextInput
          style={styles.input}
          value={config.timesPerDay?.toString() || ''}
          onChangeText={(text) => updateConfig({ timesPerDay: text ? parseInt(text) : undefined })}
          placeholder="e.g., 3"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
        />
        
        {/* End Date */}
        <Text style={styles.subLabel}>End Date (optional)</Text>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => {
            console.log('User tapped End Date button');
            setTempDate(config.endDate || new Date());
            setShowDatePicker('end');
          }}
        >
          <IconSymbol
            ios_icon_name="calendar"
            android_material_icon_name="calendar-today"
            size={18}
            color={colors.text}
          />
          <Text style={styles.datePickerText}>
            {config.endDate ? DateTime.fromJSDate(config.endDate).toFormat('MMM d, yyyy') : 'No end date'}
          </Text>
        </TouchableOpacity>
        {config.endDate && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => updateConfig({ endDate: undefined })}
          >
            <Text style={styles.clearButtonText}>Clear End Date</Text>
          </TouchableOpacity>
        )}

        {/* Exclusion Dates */}
        <Text style={styles.subLabel}>Exclusion Dates</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            console.log('User tapped Add Exclusion Date button');
            setTempDate(new Date());
            setShowDatePicker('exclusion');
          }}
        >
          <IconSymbol
            ios_icon_name="plus.circle.fill"
            android_material_icon_name="add-circle"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.addButtonText}>Add Exclusion Date</Text>
        </TouchableOpacity>
        {config.exclusionDates && config.exclusionDates.length > 0 && (
          <View style={styles.exclusionsList}>
            {config.exclusionDates.map((date, index) => (
              <View key={index} style={styles.exclusionItem}>
                <Text style={styles.exclusionText}>
                  {DateTime.fromJSDate(date).toFormat('MMM d, yyyy')}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const updated = config.exclusionDates?.filter((_, i) => i !== index);
                    updateConfig({ exclusionDates: updated });
                  }}
                >
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="cancel"
                    size={20}
                    color={colors.error}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderWeeklyOptions = () => {
    if (config.scheduleType !== 'Weekly') return null;

    const toggleWeekday = (day: number) => {
      const current = config.weekdays || [];
      const updated = current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day].sort();
      updateConfig({ weekdays: updated, weekendsOnly: false, weekdaysOnly: false });
    };

    return (
      <View style={styles.optionsContainer}>
        <Text style={styles.subLabel}>Select Days</Text>
        <View style={styles.weekdayGrid}>
          {WEEKDAYS.map((day, index) => {
            const isSelected = config.weekdays?.includes(index) || false;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.weekdayButton, isSelected && styles.weekdayButtonSelected]}
                onPress={() => toggleWeekday(index)}
              >
                <Text style={[styles.weekdayButtonText, isSelected && styles.weekdayButtonTextSelected]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, config.weekendsOnly && styles.toggleButtonActive]}
            onPress={() => updateConfig({ weekendsOnly: !config.weekendsOnly, weekdaysOnly: false })}
          >
            <Text style={[styles.toggleButtonText, config.weekendsOnly && styles.toggleButtonTextActive]}>
              Weekends Only
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, config.weekdaysOnly && styles.toggleButtonActive]}
            onPress={() => updateConfig({ weekdaysOnly: !config.weekdaysOnly, weekendsOnly: false })}
          >
            <Text style={[styles.toggleButtonText, config.weekdaysOnly && styles.toggleButtonTextActive]}>
              Weekdays Only
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* End Date & Exclusions */}
        <Text style={styles.subLabel}>End Date (optional)</Text>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => {
            console.log('User tapped End Date button');
            setTempDate(config.endDate || new Date());
            setShowDatePicker('end');
          }}
        >
          <IconSymbol
            ios_icon_name="calendar"
            android_material_icon_name="calendar-today"
            size={18}
            color={colors.text}
          />
          <Text style={styles.datePickerText}>
            {config.endDate ? DateTime.fromJSDate(config.endDate).toFormat('MMM d, yyyy') : 'No end date'}
          </Text>
        </TouchableOpacity>
        {config.endDate && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => updateConfig({ endDate: undefined })}
          >
            <Text style={styles.clearButtonText}>Clear End Date</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.subLabel}>Exclusion Dates</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            console.log('User tapped Add Exclusion Date button');
            setTempDate(new Date());
            setShowDatePicker('exclusion');
          }}
        >
          <IconSymbol
            ios_icon_name="plus.circle.fill"
            android_material_icon_name="add-circle"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.addButtonText}>Add Exclusion Date</Text>
        </TouchableOpacity>
        {config.exclusionDates && config.exclusionDates.length > 0 && (
          <View style={styles.exclusionsList}>
            {config.exclusionDates.map((date, index) => (
              <View key={index} style={styles.exclusionItem}>
                <Text style={styles.exclusionText}>
                  {DateTime.fromJSDate(date).toFormat('MMM d, yyyy')}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const updated = config.exclusionDates?.filter((_, i) => i !== index);
                    updateConfig({ exclusionDates: updated });
                  }}
                >
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="cancel"
                    size={20}
                    color={colors.error}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderFortnightlyOptions = () => {
    if (config.scheduleType !== 'Fortnightly') return null;

    const toggleFortnightDay = (day: number) => {
      const current = config.fortnightDays || [];
      const updated = current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day].sort();
      updateConfig({ fortnightDays: updated });
    };

    const isWeek1 = config.fortnightWeek === 'week1';
    const isWeek2 = config.fortnightWeek === 'week2';

    return (
      <View style={styles.optionsContainer}>
        <Text style={styles.subLabel}>Select Week Cycle</Text>
        <Text style={styles.helperText}>
          Choose Week 1 (1st week) or Week 2 (2nd week) of the cycle, then select days
        </Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, isWeek1 && styles.toggleButtonActive]}
            onPress={() => updateConfig({ fortnightWeek: isWeek1 ? undefined : 'week1' })}
          >
            <Text style={[styles.toggleButtonText, isWeek1 && styles.toggleButtonTextActive]}>
              Week 1
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, isWeek2 && styles.toggleButtonActive]}
            onPress={() => updateConfig({ fortnightWeek: isWeek2 ? undefined : 'week2' })}
          >
            <Text style={[styles.toggleButtonText, isWeek2 && styles.toggleButtonTextActive]}>
              Week 2
            </Text>
          </TouchableOpacity>
        </View>

        {(isWeek1 || isWeek2) && (
          <>
            <Text style={styles.helperText}>
              {isWeek1 ? 'Select days for Week 1 (1st week of cycle)' : 'Select days for Week 2 (2nd week of cycle)'}
            </Text>
            <View style={styles.weekdayGrid}>
              {WEEKDAYS.map((day, index) => {
                const dayIndex = isWeek2 ? index + 7 : index;
                const isSelected = config.fortnightDays?.includes(dayIndex) || false;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.weekdayButton, isSelected && styles.weekdayButtonSelected]}
                    onPress={() => toggleFortnightDay(dayIndex)}
                  >
                    <Text style={[styles.weekdayButtonText, isSelected && styles.weekdayButtonTextSelected]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
        
        {/* End Date & Exclusions */}
        <Text style={styles.subLabel}>End Date (optional)</Text>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => {
            console.log('User tapped End Date button');
            setTempDate(config.endDate || new Date());
            setShowDatePicker('end');
          }}
        >
          <IconSymbol
            ios_icon_name="calendar"
            android_material_icon_name="calendar-today"
            size={18}
            color={colors.text}
          />
          <Text style={styles.datePickerText}>
            {config.endDate ? DateTime.fromJSDate(config.endDate).toFormat('MMM d, yyyy') : 'No end date'}
          </Text>
        </TouchableOpacity>
        {config.endDate && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => updateConfig({ endDate: undefined })}
          >
            <Text style={styles.clearButtonText}>Clear End Date</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.subLabel}>Exclusion Dates</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            console.log('User tapped Add Exclusion Date button');
            setTempDate(new Date());
            setShowDatePicker('exclusion');
          }}
        >
          <IconSymbol
            ios_icon_name="plus.circle.fill"
            android_material_icon_name="add-circle"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.addButtonText}>Add Exclusion Date</Text>
        </TouchableOpacity>
        {config.exclusionDates && config.exclusionDates.length > 0 && (
          <View style={styles.exclusionsList}>
            {config.exclusionDates.map((date, index) => (
              <View key={index} style={styles.exclusionItem}>
                <Text style={styles.exclusionText}>
                  {DateTime.fromJSDate(date).toFormat('MMM d, yyyy')}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const updated = config.exclusionDates?.filter((_, i) => i !== index);
                    updateConfig({ exclusionDates: updated });
                  }}
                >
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="cancel"
                    size={20}
                    color={colors.error}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderMonthlyOptions = () => {
    if (config.scheduleType !== 'Monthly') return null;

    const useAlternativeCalendar = config.monthlyUseAlternativeCalendar || false;
    const selectedCalendar = useAlternativeCalendar ? (config.monthlyCalendarType || alternativeCalendar || 'gregorian') : 'gregorian';
    const maxDays = CALENDAR_MAX_DAYS[selectedCalendar];
    const hasCalendarEvent = config.monthlyCalendarEvent;

    const toggleDate = (date: number) => {
      const current = config.monthlyDates || [];
      const updated = current.includes(date)
        ? current.filter(d => d !== date)
        : [...current, date].sort((a, b) => a - b);
      updateConfig({ monthlyDates: updated });
    };

    const removeWeekdayPosition = (index: number) => {
      const current = config.monthlyWeekdayPositions || [];
      updateConfig({ monthlyWeekdayPositions: current.filter((_, i) => i !== index) });
    };

    const formatWeekdayPosition = (wp: WeekdayPosition) => {
      const positionText = wp.position === 5 ? 'Last' : WEEK_POSITIONS[wp.position - 1];
      const weekdayText = WEEKDAY_FULL[wp.weekday];
      return `${positionText} ${weekdayText}`;
    };

    return (
      <View style={styles.optionsContainer}>
        {/* Use Alternative Calendar Toggle */}
        {alternativeCalendar && alternativeCalendar !== 'gregorian' && (
          <View style={styles.calendarToggleSection}>
            <View style={styles.calendarToggleRow}>
              <Text style={styles.subLabel}>Use Alternative Calendar</Text>
              <TouchableOpacity
                style={[styles.toggleSwitch, useAlternativeCalendar && styles.toggleSwitchActive]}
                onPress={() => handleAlternativeCalendarToggle('monthly', !useAlternativeCalendar)}
              >
                <View style={[styles.toggleSwitchThumb, useAlternativeCalendar && styles.toggleSwitchThumbActive]} />
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              {useAlternativeCalendar 
                ? 'Using alternative calendar. Gregorian dates have been cleared.' 
                : 'Using Gregorian calendar. Toggle on to use alternative calendar events.'}
            </Text>
          </View>
        )}

        {/* Calendar Event - Only show if Hebrew calendar is selected */}
        {useAlternativeCalendar && selectedCalendar === 'hebrew' && (
          <View style={styles.calendarSection}>
            <Text style={styles.subLabel}>Calendar Event (optional)</Text>
            <TouchableOpacity
              style={styles.calendarButton}
              onPress={() => {
                setCalendarEventContext('monthly');
                setShowCalendarEventPicker(true);
              }}
            >
              <Text style={styles.calendarButtonText}>
                {config.monthlyCalendarEvent || 'Select Event'}
              </Text>
              <IconSymbol
                ios_icon_name="chevron.down"
                android_material_icon_name="arrow-drop-down"
                size={20}
                color={colors.text}
              />
            </TouchableOpacity>
            {config.monthlyCalendarEvent && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => updateConfig({ monthlyCalendarEvent: undefined })}
              >
                <Text style={styles.clearButtonText}>Clear Event</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Selected Dates - HIDDEN if Calendar Event is chosen */}
        {!hasCalendarEvent && (
          <>
            <Text style={styles.subLabel}>Select Dates</Text>
            <Text style={styles.helperText}>
              Choose specific dates of the month (e.g., 3rd, 15th, 28th)
            </Text>
            
            {/* Display all dates 1-30/31 in a grid without scrolling */}
            <View style={styles.dateGridContainer}>
              {Array.from({ length: maxDays }, (_, i) => {
                const date = i + 1;
                const isSelected = config.monthlyDates?.includes(date) || false;
                return (
                  <TouchableOpacity
                    key={date}
                    style={[styles.dateButton, isSelected && styles.dateButtonSelected]}
                    onPress={() => toggleDate(date)}
                  >
                    <Text style={[styles.dateButtonText, isSelected && styles.dateButtonTextSelected]}>
                      {date}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* NEW: Weekday Position Selection */}
            <Text style={styles.subLabel}>Or Select by Week Position</Text>
            <Text style={styles.helperText}>
              Choose specific weekdays by their position in the month (e.g., 1st Friday, 2nd and last Sunday). Tap the delete button next to each item to remove it.
            </Text>
            
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                console.log('User tapped Add Weekday Position button');
                setSelectedWeekday(0);
                setSelectedPosition(1);
                setShowWeekdayPositionPicker(true);
              }}
            >
              <IconSymbol
                ios_icon_name="plus.circle.fill"
                android_material_icon_name="add-circle"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.addButtonText}>Add Weekday Position</Text>
            </TouchableOpacity>

            {config.monthlyWeekdayPositions && config.monthlyWeekdayPositions.length > 0 && (
              <View style={styles.weekdayPositionsList}>
                {config.monthlyWeekdayPositions.map((wp, index) => (
                  <View key={index} style={styles.weekdayPositionItem}>
                    <Text style={styles.weekdayPositionText}>
                      {formatWeekdayPosition(wp)}
                    </Text>
                    <TouchableOpacity onPress={() => removeWeekdayPosition(index)}>
                      <IconSymbol
                        ios_icon_name="xmark.circle.fill"
                        android_material_icon_name="cancel"
                        size={20}
                        color={colors.error}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        
        {/* More Options - Renamed to "Select a date range or # of days per month" */}
        <TouchableOpacity
          style={styles.advancedOptionButton}
          onPress={() => setShowMonthlyAdvanced(!showMonthlyAdvanced)}
        >
          <IconSymbol
            ios_icon_name="slider.horizontal.3"
            android_material_icon_name="tune"
            size={16}
            color={colors.primary}
          />
          <Text style={styles.advancedOptionText}>Select a date range or # of days per month</Text>
        </TouchableOpacity>
        
        {showMonthlyAdvanced && (
          <View style={styles.advancedSection}>
            <Text style={styles.subLabel}>Date Range</Text>
            <Text style={styles.helperText}>
              e.g., from 3rd to 6th of each month
            </Text>
            <View style={styles.rangeRow}>
              <TextInput
                style={[styles.input, styles.rangeInput]}
                value={config.monthlyRangeStart?.toString() || ''}
                onChangeText={(text) => updateConfig({ monthlyRangeStart: text ? parseInt(text) : undefined })}
                placeholder="Start"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />
              <Text style={styles.rangeText}>to</Text>
              <TextInput
                style={[styles.input, styles.rangeInput]}
                value={config.monthlyRangeEnd?.toString() || ''}
                onChangeText={(text) => updateConfig({ monthlyRangeEnd: text ? parseInt(text) : undefined })}
                placeholder="End"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />
            </View>
            
            <Text style={styles.subLabel}>Random Selection</Text>
            <Text style={styles.helperText}>
              e.g., 3 random days per month
            </Text>
            <TextInput
              style={styles.input}
              value={config.monthlyRandomCount?.toString() || ''}
              onChangeText={(text) => updateConfig({ monthlyRandomCount: text ? parseInt(text) : undefined })}
              placeholder="Number of random days"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
            />
          </View>
        )}
        
        {/* End Date & Exclusions */}
        <Text style={styles.subLabel}>End Date (optional)</Text>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => {
            console.log('User tapped End Date button');
            setTempDate(config.endDate || new Date());
            setShowDatePicker('end');
          }}
        >
          <IconSymbol
            ios_icon_name="calendar"
            android_material_icon_name="calendar-today"
            size={18}
            color={colors.text}
          />
          <Text style={styles.datePickerText}>
            {config.endDate ? DateTime.fromJSDate(config.endDate).toFormat('MMM d, yyyy') : 'No end date'}
          </Text>
        </TouchableOpacity>
        {config.endDate && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => updateConfig({ endDate: undefined })}
          >
            <Text style={styles.clearButtonText}>Clear End Date</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.subLabel}>Exclusion Dates</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            console.log('User tapped Add Exclusion Date button');
            setTempDate(new Date());
            setShowDatePicker('exclusion');
          }}
        >
          <IconSymbol
            ios_icon_name="plus.circle.fill"
            android_material_icon_name="add-circle"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.addButtonText}>Add Exclusion Date</Text>
        </TouchableOpacity>
        {config.exclusionDates && config.exclusionDates.length > 0 && (
          <View style={styles.exclusionsList}>
            {config.exclusionDates.map((date, index) => (
              <View key={index} style={styles.exclusionItem}>
                <Text style={styles.exclusionText}>
                  {DateTime.fromJSDate(date).toFormat('MMM d, yyyy')}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const updated = config.exclusionDates?.filter((_, i) => i !== index);
                    updateConfig({ exclusionDates: updated });
                  }}
                >
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="cancel"
                    size={20}
                    color={colors.error}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderYearlyOptions = () => {
    if (config.scheduleType !== 'Yearly') return null;

    const useAlternativeCalendar = config.yearlyUseAlternativeCalendar || false;
    const selectedCalendar = useAlternativeCalendar ? (config.yearlyCalendarType || alternativeCalendar || 'gregorian') : 'gregorian';
    const monthNames = selectedCalendar === 'gregorian' ? GREGORIAN_MONTHS :
                       selectedCalendar === 'hebrew' ? HEBREW_MONTHS :
                       selectedCalendar === 'chinese' ? CHINESE_MONTHS :
                       ISLAMIC_MONTHS;

    const toggleMonth = (month: number) => {
      const current = config.yearlyMonths || [];
      const updated = current.includes(month)
        ? current.filter(m => m !== month)
        : [...current, month].sort((a, b) => a - b);
      updateConfig({ yearlyMonths: updated });
    };

    const addYearlyDate = () => {
      const current = config.yearlyDates || [];
      updateConfig({ yearlyDates: [...current, { month: 1, day: 1 }] });
    };

    const removeYearlyDate = (index: number) => {
      const current = config.yearlyDates || [];
      updateConfig({ yearlyDates: current.filter((_, i) => i !== index) });
    };

    const updateYearlyDate = (index: number, updates: Partial<{ month: number; day: number; endMonth?: number; endDay?: number }>) => {
      const current = config.yearlyDates || [];
      const updated = [...current];
      updated[index] = { ...updated[index], ...updates };
      updateConfig({ yearlyDates: updated });
    };

    const hasCalendarEvent = useAlternativeCalendar && selectedCalendar === 'hebrew' && config.yearlyCalendarEvent;

    return (
      <View style={styles.optionsContainer}>
        {/* Use Alternative Calendar Toggle */}
        {alternativeCalendar && alternativeCalendar !== 'gregorian' && (
          <View style={styles.calendarToggleSection}>
            <View style={styles.calendarToggleRow}>
              <Text style={styles.subLabel}>Use Alternative Calendar</Text>
              <TouchableOpacity
                style={[styles.toggleSwitch, useAlternativeCalendar && styles.toggleSwitchActive]}
                onPress={() => handleAlternativeCalendarToggle('yearly', !useAlternativeCalendar)}
              >
                <View style={[styles.toggleSwitchThumb, useAlternativeCalendar && styles.toggleSwitchThumbActive]} />
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              {useAlternativeCalendar 
                ? 'Using alternative calendar. Gregorian dates have been cleared.' 
                : 'Using Gregorian calendar. Toggle on to use alternative calendar events.'}
            </Text>
          </View>
        )}

        {/* Calendar Event - Only show if Hebrew calendar is selected */}
        {useAlternativeCalendar && selectedCalendar === 'hebrew' && (
          <View style={styles.calendarSection}>
            <Text style={styles.subLabel}>Calendar Event (optional)</Text>
            <TouchableOpacity
              style={styles.calendarButton}
              onPress={() => {
                setCalendarEventContext('yearly');
                setShowCalendarEventPicker(true);
              }}
            >
              <Text style={styles.calendarButtonText}>
                {config.yearlyCalendarEvent || 'Select Event'}
              </Text>
              <IconSymbol
                ios_icon_name="chevron.down"
                android_material_icon_name="arrow-drop-down"
                size={20}
                color={colors.text}
              />
            </TouchableOpacity>
            {config.yearlyCalendarEvent && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => updateConfig({ yearlyCalendarEvent: undefined })}
              >
                <Text style={styles.clearButtonText}>Clear Event</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Selected Months - HIDDEN if Calendar Event is chosen */}
        {!hasCalendarEvent && (
          <>
            <Text style={styles.subLabel}>Select Months</Text>
            <View style={styles.monthGrid}>
              {monthNames.map((month, index) => {
                const monthNum = index + 1;
                const isSelected = config.yearlyMonths?.includes(monthNum) || false;
                return (
                  <TouchableOpacity
                    key={monthNum}
                    style={[styles.monthButton, isSelected && styles.monthButtonSelected]}
                    onPress={() => toggleMonth(monthNum)}
                  >
                    <Text style={[styles.monthButtonText, isSelected && styles.monthButtonTextSelected]}>
                      {month}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <TouchableOpacity
          style={styles.advancedOptionButton}
          onPress={() => setShowYearlyAdvanced(!showYearlyAdvanced)}
        >
          <IconSymbol
            ios_icon_name="slider.horizontal.3"
            android_material_icon_name="tune"
            size={16}
            color={colors.primary}
          />
          <Text style={styles.advancedOptionText}>Specific Dates & Ranges</Text>
        </TouchableOpacity>

        {showYearlyAdvanced && (
          <View style={styles.advancedSection}>
            <Text style={styles.subLabel}>Specific Dates or Date Ranges</Text>
            <Text style={styles.helperText}>
              Add specific dates (e.g., Feb 1st) or date ranges (e.g., Jan 31 - Feb 2)
            </Text>

            {config.yearlyDates && config.yearlyDates.length > 0 && (
              <View style={styles.yearlyDatesList}>
                {config.yearlyDates.map((dateRange, index) => {
                  const startMonthName = monthNames[dateRange.month - 1] || dateRange.month;
                  const endMonthName = dateRange.endMonth ? (monthNames[dateRange.endMonth - 1] || dateRange.endMonth) : '';
                  const displayText = dateRange.endMonth && dateRange.endDay
                    ? `${startMonthName} ${dateRange.day} - ${endMonthName} ${dateRange.endDay}`
                    : `${startMonthName} ${dateRange.day}`;
                  
                  return (
                    <View key={index} style={styles.yearlyDateItem}>
                      <Text style={styles.yearlyDateText}>{displayText}</Text>
                      <TouchableOpacity onPress={() => removeYearlyDate(index)}>
                        <IconSymbol
                          ios_icon_name="xmark.circle.fill"
                          android_material_icon_name="cancel"
                          size={20}
                          color={colors.error}
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
            
            {/* Add Date or Range Input */}
            <View style={styles.dateRangeInputSection}>
              <Text style={styles.subLabel}>Add Date or Range</Text>
              <Text style={styles.helperText}>
                Enter start date (e.g., 1st) and optionally end date (e.g., 4th) for a range
              </Text>
              <View style={styles.dateRangeInputRow}>
                <TextInput
                  style={styles.dateRangeInput}
                  value={yearlyRangeStart}
                  onChangeText={setYearlyRangeStart}
                  placeholder="1st"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
                <Text style={styles.rangeText}>-</Text>
                <TextInput
                  style={styles.dateRangeInput}
                  value={yearlyRangeEnd}
                  onChangeText={setYearlyRangeEnd}
                  placeholder="4th (optional)"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
              <TouchableOpacity 
                style={styles.addButton} 
                onPress={() => {
                  const startDay = parseInt(yearlyRangeStart);
                  const endDay = yearlyRangeEnd ? parseInt(yearlyRangeEnd) : undefined;
                  
                  if (startDay && !isNaN(startDay)) {
                    const current = config.yearlyDates || [];
                    const newDate = endDay && !isNaN(endDay)
                      ? { month: 1, day: startDay, endMonth: 1, endDay }
                      : { month: 1, day: startDay };
                    updateConfig({ yearlyDates: [...current, newDate] });
                    setYearlyRangeStart('');
                    setYearlyRangeEnd('');
                  }
                }}
              >
                <IconSymbol
                  ios_icon_name="plus.circle.fill"
                  android_material_icon_name="add-circle"
                  size={18}
                  color={colors.primary}
                />
                <Text style={styles.addButtonText}>Add Date or Range</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {/* End Date & Exclusions */}
        <Text style={styles.subLabel}>End Date (optional)</Text>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => {
            console.log('User tapped End Date button');
            setTempDate(config.endDate || new Date());
            setShowDatePicker('end');
          }}
        >
          <IconSymbol
            ios_icon_name="calendar"
            android_material_icon_name="calendar-today"
            size={18}
            color={colors.text}
          />
          <Text style={styles.datePickerText}>
            {config.endDate ? DateTime.fromJSDate(config.endDate).toFormat('MMM d, yyyy') : 'No end date'}
          </Text>
        </TouchableOpacity>
        {config.endDate && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => updateConfig({ endDate: undefined })}
          >
            <Text style={styles.clearButtonText}>Clear End Date</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.subLabel}>Exclusion Dates</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            console.log('User tapped Add Exclusion Date button');
            setTempDate(new Date());
            setShowDatePicker('exclusion');
          }}
        >
          <IconSymbol
            ios_icon_name="plus.circle.fill"
            android_material_icon_name="add-circle"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.addButtonText}>Add Exclusion Date</Text>
        </TouchableOpacity>
        {config.exclusionDates && config.exclusionDates.length > 0 && (
          <View style={styles.exclusionsList}>
            {config.exclusionDates.map((date, index) => (
              <View key={index} style={styles.exclusionItem}>
                <Text style={styles.exclusionText}>
                  {DateTime.fromJSDate(date).toFormat('MMM d, yyyy')}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const updated = config.exclusionDates?.filter((_, i) => i !== index);
                    updateConfig({ exclusionDates: updated });
                  }}
                >
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="cancel"
                    size={20}
                    color={colors.error}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderWeekdayPositionPicker = () => {
    return (
      <Modal
        visible={showWeekdayPositionPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWeekdayPositionPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Weekday Position</Text>
              <TouchableOpacity onPress={() => setShowWeekdayPositionPicker(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              <View style={styles.pickerSection}>
                <Text style={styles.pickerLabel}>Select Position</Text>
                <View style={styles.positionGrid}>
                  {WEEK_POSITIONS.map((position, index) => {
                    const positionValue = index + 1;
                    const isSelected = selectedPosition === positionValue;
                    return (
                      <TouchableOpacity
                        key={positionValue}
                        style={[styles.positionButton, isSelected && styles.positionButtonSelected]}
                        onPress={() => setSelectedPosition(positionValue)}
                      >
                        <Text style={[styles.positionButtonText, isSelected && styles.positionButtonTextSelected]}>
                          {position}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.pickerSection}>
                <Text style={styles.pickerLabel}>Select Weekday</Text>
                <View style={styles.weekdayPickerGrid}>
                  {WEEKDAY_FULL.map((day, index) => {
                    const isSelected = selectedWeekday === index;
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.weekdayPickerButton, isSelected && styles.weekdayPickerButtonSelected]}
                        onPress={() => setSelectedWeekday(index)}
                      >
                        <Text style={[styles.weekdayPickerButtonText, isSelected && styles.weekdayPickerButtonTextSelected]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => {
                  console.log('User confirmed weekday position:', { weekday: selectedWeekday, position: selectedPosition });
                  const current = config.monthlyWeekdayPositions || [];
                  const newPosition: WeekdayPosition = {
                    weekday: selectedWeekday,
                    position: selectedPosition,
                  };
                  updateConfig({ monthlyWeekdayPositions: [...current, newPosition] });
                  setShowWeekdayPositionPicker(false);
                }}
              >
                <Text style={styles.confirmButtonText}>Add</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // NEW: Source Modal
  const renderSourceModal = () => {
    if (!selectedOccurrence) return null;

    return (
      <Modal
        visible={showSourceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSourceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sourceModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Source</Text>
              <TouchableOpacity onPress={() => setShowSourceModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            
            <View style={styles.sourceModalContent}>
              <View style={styles.sourceInfoRow}>
                <IconSymbol
                  ios_icon_name="calendar"
                  android_material_icon_name="event"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.sourceInfoLabel}>Date:</Text>
              </View>
              <Text style={styles.sourceInfoValue}>{selectedOccurrence.date}</Text>
              
              <View style={styles.sourceInfoRow}>
                <IconSymbol
                  ios_icon_name="list.bullet"
                  android_material_icon_name="list"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.sourceInfoLabel}>Generated by:</Text>
              </View>
              <Text style={styles.sourceInfoValue}>{selectedOccurrence.source.section}</Text>
              
              <View style={styles.sourceInfoRow}>
                <IconSymbol
                  ios_icon_name="info.circle"
                  android_material_icon_name="info"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.sourceInfoLabel}>Details:</Text>
              </View>
              <Text style={styles.sourceInfoValue}>{selectedOccurrence.source.details}</Text>
              
              <TouchableOpacity
                style={styles.navigateButton}
                onPress={() => navigateToSection(selectedOccurrence.source.section)}
              >
                <IconSymbol
                  ios_icon_name="arrow.right.circle.fill"
                  android_material_icon_name="arrow-circle-right"
                  size={20}
                  color="#fff"
                />
                <Text style={styles.navigateButtonText}>Go to this section</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {renderScheduleTypeSelector()}
      {renderScheduleSummary()}
      {renderDailyOptions()}
      {renderWeeklyOptions()}
      {renderFortnightlyOptions()}
      {renderMonthlyOptions()}
      {renderYearlyOptions()}

      {/* Date Picker Modal - Using DatePickerModal component */}
      {showDatePicker && (
        <DatePickerModal
          visible={true}
          value={tempDate}
          mode="date"
          onConfirm={handleDatePickerConfirm}
          onCancel={handleDatePickerCancel}
        />
      )}

      {/* Calendar Event Picker Modal */}
      <Modal
        visible={showCalendarEventPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendarEventPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Calendar Event</Text>
              <TouchableOpacity onPress={() => setShowCalendarEventPicker(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {HEBREW_EVENTS.map((event) => {
                const isSelected = calendarEventContext === 'monthly'
                  ? config.monthlyCalendarEvent === event
                  : config.yearlyCalendarEvent === event;
                return (
                  <TouchableOpacity
                    key={event}
                    style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                    onPress={() => {
                      if (calendarEventContext === 'monthly') {
                        updateConfig({ monthlyCalendarEvent: event });
                      } else {
                        updateConfig({ yearlyCalendarEvent: event });
                      }
                      setShowCalendarEventPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                      {event}
                    </Text>
                    {isSelected && (
                      <IconSymbol
                        ios_icon_name="checkmark"
                        android_material_icon_name="check"
                        size={20}
                        color={colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Weekday Position Picker Modal */}
      {renderWeekdayPositionPicker()}

      {/* Source Modal */}
      {renderSourceModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  section: {
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  subLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  summaryContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    borderLeftWidth: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  refreshButton: {
    padding: 4,
  },
  summaryLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  summaryLoadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 24,
  },
  summaryFallbackNote: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  nextOccurrencesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  nextOccurrencesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  nextOccurrencesHint: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  nextOccurrenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  nextOccurrenceText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  nextOccurrenceTextFirst: {
    color: colors.primary,
    fontWeight: '600',
  },
  nextOccurrenceTextClickable: {
    textDecorationLine: 'underline',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  typeButtonTextSelected: {
    color: '#fff',
  },
  optionsContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calendarToggleSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  calendarToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: colors.primary,
  },
  toggleSwitchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
  },
  toggleSwitchThumbActive: {
    alignSelf: 'flex-end',
  },
  calendarSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  calendarButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calendarButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  weekdayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekdayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekdayButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weekdayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  weekdayButtonTextSelected: {
    color: '#fff',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  dateGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  dateButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  dateButtonTextSelected: {
    color: '#fff',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  monthButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  monthButtonTextSelected: {
    color: '#fff',
  },
  advancedOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginTop: 16,
  },
  advancedOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  advancedSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  yearlyDatesList: {
    gap: 8,
    marginBottom: 12,
  },
  yearlyDateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  yearlyDateText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  dateRangeInputSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dateRangeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  dateRangeInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rangeInput: {
    flex: 1,
  },
  rangeText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  smallInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    width: 60,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  datePickerText: {
    fontSize: 15,
    color: colors.text,
  },
  clearButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.background,
  },
  clearButtonText: {
    fontSize: 13,
    color: colors.error,
    fontWeight: '600',
  },
  exclusionsList: {
    gap: 8,
    marginTop: 8,
  },
  exclusionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exclusionText: {
    fontSize: 14,
    color: colors.text,
  },
  weekdayPositionsList: {
    gap: 8,
    marginTop: 8,
  },
  weekdayPositionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekdayPositionText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
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
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  modalScroll: {
    padding: 20,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemSelected: {
    backgroundColor: colors.card,
  },
  pickerItemText: {
    fontSize: 16,
    color: colors.text,
  },
  pickerItemTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  pickerSection: {
    marginBottom: 24,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  positionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  positionButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  positionButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  positionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  positionButtonTextSelected: {
    color: '#fff',
  },
  weekdayPickerGrid: {
    gap: 8,
  },
  weekdayPickerButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekdayPickerButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weekdayPickerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  weekdayPickerButtonTextSelected: {
    color: '#fff',
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  sourceModal: {
    backgroundColor: colors.background,
    borderRadius: 20,
    margin: 20,
    maxHeight: '60%',
  },
  sourceModalContent: {
    padding: 20,
  },
  sourceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  sourceInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sourceInfoValue: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    marginBottom: 8,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  navigateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
