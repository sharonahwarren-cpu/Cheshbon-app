
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DateTime } from 'luxon';
import { useRouter } from 'expo-router';

export type ScheduleType = 'Always Active' | 'Daily' | 'Weekly' | 'Fortnightly' | 'Monthly' | 'Yearly';
export type CalendarType = 'gregorian' | 'hebrew' | 'chinese' | 'islamic';

export interface ScheduleConfig {
  scheduleType: ScheduleType;
  
  // Daily
  timesPerDay?: number;
  specificTimes?: Array<{ hour: number; minute: number; label?: string }>;
  
  // Weekly
  weekdays?: number[]; // 0-6 (Sunday-Saturday)
  weekendsOnly?: boolean;
  weekdaysOnly?: boolean;
  
  // Fortnightly
  fortnightDays?: number[]; // 0-13
  fortnightEvenOdd?: 'even' | 'odd';
  
  // Monthly
  monthlyDates?: number[]; // [1, 15, 30]
  monthlyNthDay?: Array<{ day: string; nth: number }>; // "Second Tuesday"
  monthlyRangeStart?: number;
  monthlyRangeEnd?: number;
  monthlyRandomCount?: number;
  monthlyCalendarType?: CalendarType;
  
  // Yearly
  yearlyMonths?: number[]; // [1, 6, 12]
  yearlyDates?: Array<{ month: number; day: number; endMonth?: number; endDay?: number }>;
  yearlyCalendarType?: CalendarType;
  
  // Advanced
  calendarType?: CalendarType;
  startDate?: Date;
  endDate?: Date;
  exclusionDates?: Date[];
  
  // Alarms
  alarmIds?: string[];
}

interface GoalSchedulerProps {
  config: ScheduleConfig;
  onChange: (config: ScheduleConfig) => void;
  alternativeCalendar?: CalendarType;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_POSITIONS = ['First', 'Second', 'Third', 'Fourth', 'Last'];

const CALENDAR_TYPES: CalendarType[] = ['gregorian', 'hebrew', 'chinese', 'islamic'];
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

export function GoalScheduler({ config, onChange, alternativeCalendar }: GoalSchedulerProps) {
  const router = useRouter();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAlarms, setShowAlarms] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | 'exclusion' | null>(null);
  const [tempDate, setTempDate] = useState(new Date());
  const [showMonthlyAdvanced, setShowMonthlyAdvanced] = useState(false);
  const [showYearlyAdvanced, setShowYearlyAdvanced] = useState(false);

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

    return (
      <View style={styles.optionsContainer}>
        <Text style={styles.subLabel}>Select Days (2-week cycle)</Text>
        <Text style={styles.helperText}>
          Even Weeks/Odd Weeks: Select which weeks of the month this goal is active
        </Text>
        <View style={styles.fortnightGrid}>
          {Array.from({ length: 14 }, (_, i) => {
            const isSelected = config.fortnightDays?.includes(i) || false;
            const weekLabel = i < 7 ? 'Week 1' : 'Week 2';
            const dayLabel = WEEKDAYS[i % 7];
            return (
              <TouchableOpacity
                key={i}
                style={[styles.fortnightButton, isSelected && styles.fortnightButtonSelected]}
                onPress={() => toggleFortnightDay(i)}
              >
                <Text style={[styles.fortnightButtonText, isSelected && styles.fortnightButtonTextSelected]}>
                  {dayLabel}
                </Text>
                <Text style={[styles.fortnightButtonSubtext, isSelected && styles.fortnightButtonTextSelected]}>
                  {weekLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, config.fortnightEvenOdd === 'even' && styles.toggleButtonActive]}
            onPress={() => updateConfig({ fortnightEvenOdd: config.fortnightEvenOdd === 'even' ? undefined : 'even' })}
          >
            <Text style={[styles.toggleButtonText, config.fortnightEvenOdd === 'even' && styles.toggleButtonTextActive]}>
              Even Weeks
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, config.fortnightEvenOdd === 'odd' && styles.toggleButtonActive]}
            onPress={() => updateConfig({ fortnightEvenOdd: config.fortnightEvenOdd === 'odd' ? undefined : 'odd' })}
          >
            <Text style={[styles.toggleButtonText, config.fortnightEvenOdd === 'odd' && styles.toggleButtonTextActive]}>
              Odd Weeks
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderMonthlyOptions = () => {
    if (config.scheduleType !== 'Monthly') return null;

    const selectedCalendar = config.monthlyCalendarType || alternativeCalendar || 'gregorian';
    const maxDays = CALENDAR_MAX_DAYS[selectedCalendar];

    const toggleDate = (date: number) => {
      const current = config.monthlyDates || [];
      const updated = current.includes(date)
        ? current.filter(d => d !== date)
        : [...current, date].sort((a, b) => a - b);
      updateConfig({ monthlyDates: updated });
    };

    const addNthDayRule = () => {
      const current = config.monthlyNthDay || [];
      updateConfig({ monthlyNthDay: [...current, { day: 'Monday', nth: 1 }] });
    };

    const removeNthDayRule = (index: number) => {
      const current = config.monthlyNthDay || [];
      updateConfig({ monthlyNthDay: current.filter((_, i) => i !== index) });
    };

    const updateNthDayRule = (index: number, updates: Partial<{ day: string; nth: number }>) => {
      const current = config.monthlyNthDay || [];
      const updated = [...current];
      updated[index] = { ...updated[index], ...updates };
      updateConfig({ monthlyNthDay: updated });
    };

    return (
      <View style={styles.optionsContainer}>
        {/* Calendar Type Selector */}
        {alternativeCalendar && alternativeCalendar !== 'gregorian' && (
          <View style={styles.calendarSection}>
            <Text style={styles.subLabel}>Calendar Type</Text>
            <View style={styles.calendarGrid}>
              {CALENDAR_TYPES.map((cal) => {
                const isSelected = selectedCalendar === cal;
                return (
                  <TouchableOpacity
                    key={cal}
                    style={[styles.calendarButton, isSelected && styles.calendarButtonSelected]}
                    onPress={() => updateConfig({ monthlyCalendarType: cal })}
                  >
                    <Text style={[styles.calendarButtonText, isSelected && styles.calendarButtonTextSelected]}>
                      {CALENDAR_LABELS[cal]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.helperText}>
              {CALENDAR_LABELS[selectedCalendar]} calendar: Max {maxDays} days
            </Text>
          </View>
        )}

        <Text style={styles.subLabel}>Select Dates</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.dateGrid}>
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
        </ScrollView>
        
        <View style={styles.advancedOptionsRow}>
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
            <Text style={styles.advancedOptionText}>More Options</Text>
          </TouchableOpacity>
        </View>
        
        {showMonthlyAdvanced && (
          <View style={styles.advancedSection}>
            <Text style={styles.subLabel}>Nth Day of Month (e.g., 1st Tuesday)</Text>
            {config.monthlyNthDay && config.monthlyNthDay.length > 0 && (
              <View style={styles.nthDayList}>
                {config.monthlyNthDay.map((rule, index) => (
                  <View key={index} style={styles.nthDayItem}>
                    <View style={styles.nthDaySelectors}>
                      <TouchableOpacity
                        style={styles.nthDaySelector}
                        onPress={() => {
                          // Cycle through positions
                          const positions = [1, 2, 3, 4, -1]; // -1 = Last
                          const currentIndex = positions.indexOf(rule.nth);
                          const nextIndex = (currentIndex + 1) % positions.length;
                          updateNthDayRule(index, { nth: positions[nextIndex] });
                        }}
                      >
                        <Text style={styles.nthDaySelectorText}>
                          {rule.nth === -1 ? 'Last' : WEEK_POSITIONS[rule.nth - 1]}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.nthDaySelector}
                        onPress={() => {
                          // Cycle through days
                          const days = WEEKDAY_FULL;
                          const currentIndex = days.indexOf(rule.day);
                          const nextIndex = (currentIndex + 1) % days.length;
                          updateNthDayRule(index, { day: days[nextIndex] });
                        }}
                      >
                        <Text style={styles.nthDaySelectorText}>{rule.day}</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => removeNthDayRule(index)}>
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
            <TouchableOpacity style={styles.addButton} onPress={addNthDayRule}>
              <IconSymbol
                ios_icon_name="plus.circle.fill"
                android_material_icon_name="add-circle"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.addButtonText}>Add Nth Day Rule</Text>
            </TouchableOpacity>
            
            <Text style={styles.subLabel}>Date Range</Text>
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
            <TextInput
              style={styles.input}
              value={config.monthlyRandomCount?.toString() || ''}
              onChangeText={(text) => updateConfig({ monthlyRandomCount: text ? parseInt(text) : undefined })}
              placeholder="Number of random days per month"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
            />
          </View>
        )}
      </View>
    );
  };

  const renderYearlyOptions = () => {
    if (config.scheduleType !== 'Yearly') return null;

    const selectedCalendar = config.yearlyCalendarType || alternativeCalendar || 'gregorian';
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

    return (
      <View style={styles.optionsContainer}>
        {/* Calendar Type Selector */}
        {alternativeCalendar && alternativeCalendar !== 'gregorian' && (
          <View style={styles.calendarSection}>
            <Text style={styles.subLabel}>Calendar Type</Text>
            <View style={styles.calendarGrid}>
              {CALENDAR_TYPES.map((cal) => {
                const isSelected = selectedCalendar === cal;
                return (
                  <TouchableOpacity
                    key={cal}
                    style={[styles.calendarButton, isSelected && styles.calendarButtonSelected]}
                    onPress={() => updateConfig({ yearlyCalendarType: cal })}
                  >
                    <Text style={[styles.calendarButtonText, isSelected && styles.calendarButtonTextSelected]}>
                      {CALENDAR_LABELS[cal]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

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

        <View style={styles.advancedOptionsRow}>
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
        </View>

        {showYearlyAdvanced && (
          <View style={styles.advancedSection}>
            <Text style={styles.subLabel}>Specific Dates or Date Ranges</Text>
            {config.yearlyDates && config.yearlyDates.length > 0 && (
              <View style={styles.yearlyDatesList}>
                {config.yearlyDates.map((dateRange, index) => (
                  <View key={index} style={styles.yearlyDateItem}>
                    <View style={styles.yearlyDateInputs}>
                      <TextInput
                        style={styles.smallInput}
                        value={dateRange.month.toString()}
                        onChangeText={(text) => updateYearlyDate(index, { month: parseInt(text) || 1 })}
                        placeholder="Month"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="number-pad"
                      />
                      <Text style={styles.rangeText}>/</Text>
                      <TextInput
                        style={styles.smallInput}
                        value={dateRange.day.toString()}
                        onChangeText={(text) => updateYearlyDate(index, { day: parseInt(text) || 1 })}
                        placeholder="Day"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="number-pad"
                      />
                      {dateRange.endMonth && dateRange.endDay && (
                        <>
                          <Text style={styles.rangeText}>to</Text>
                          <TextInput
                            style={styles.smallInput}
                            value={dateRange.endMonth.toString()}
                            onChangeText={(text) => updateYearlyDate(index, { endMonth: parseInt(text) || undefined })}
                            placeholder="Month"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="number-pad"
                          />
                          <Text style={styles.rangeText}>/</Text>
                          <TextInput
                            style={styles.smallInput}
                            value={dateRange.endDay.toString()}
                            onChangeText={(text) => updateYearlyDate(index, { endDay: parseInt(text) || undefined })}
                            placeholder="Day"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="number-pad"
                          />
                        </>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => removeYearlyDate(index)}>
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
            <TouchableOpacity style={styles.addButton} onPress={addYearlyDate}>
              <IconSymbol
                ios_icon_name="plus.circle.fill"
                android_material_icon_name="add-circle"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.addButtonText}>Add Date or Range</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderAdvancedOptions = () => {
    if (config.scheduleType === 'Always Active') return null;

    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={() => setShowAdvanced(!showAdvanced)}
        >
          <View style={styles.advancedToggleLeft}>
            <IconSymbol
              ios_icon_name="calendar.badge.exclamationmark"
              android_material_icon_name="event-busy"
              size={18}
              color={colors.primary}
            />
            <Text style={styles.advancedToggleText}>End Date & Exclusions</Text>
          </View>
          <IconSymbol
            ios_icon_name={showAdvanced ? 'chevron.up' : 'chevron.down'}
            android_material_icon_name={showAdvanced ? 'expand-less' : 'expand-more'}
            size={20}
            color={colors.text}
          />
        </TouchableOpacity>

        {showAdvanced && (
          <View style={styles.advancedContent}>
            <Text style={styles.subLabel}>End Date (optional)</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => {
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
        )}
      </View>
    );
  };

  const renderAlarms = () => {
    if (config.scheduleType === 'Always Active') return null;

    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={() => setShowAlarms(!showAlarms)}
        >
          <View style={styles.advancedToggleLeft}>
            <IconSymbol
              ios_icon_name="bell.fill"
              android_material_icon_name="notifications"
              size={18}
              color={colors.primary}
            />
            <Text style={styles.advancedToggleText}>Alarms & Reminders</Text>
          </View>
          <IconSymbol
            ios_icon_name={showAlarms ? 'chevron.up' : 'chevron.down'}
            android_material_icon_name={showAlarms ? 'expand-less' : 'expand-more'}
            size={20}
            color={colors.text}
          />
        </TouchableOpacity>

        {showAlarms && (
          <View style={styles.advancedContent}>
            <Text style={styles.helperText}>
              Set up powerful alarms with astronomical triggers (sunrise, sunset), location-based triggers, and custom conditions.
            </Text>
            <TouchableOpacity
              style={styles.manageAlarmsButton}
              onPress={() => router.push('/alarms/create')}
            >
              <IconSymbol
                ios_icon_name="bell.badge.fill"
                android_material_icon_name="notifications-active"
                size={18}
                color="#fff"
              />
              <Text style={styles.manageAlarmsButtonText}>Manage Alarms</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderScheduleTypeSelector()}
      {renderDailyOptions()}
      {renderWeeklyOptions()}
      {renderFortnightlyOptions()}
      {renderMonthlyOptions()}
      {renderYearlyOptions()}
      {renderAdvancedOptions()}
      {renderAlarms()}

      {showDatePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            if (event.type === 'set' && selectedDate) {
              if (showDatePicker === 'end') {
                updateConfig({ endDate: selectedDate });
              } else if (showDatePicker === 'exclusion') {
                const current = config.exclusionDates || [];
                updateConfig({ exclusionDates: [...current, selectedDate] });
              }
            }
            setShowDatePicker(null);
          }}
        />
      )}
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
  calendarSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  calendarButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calendarButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  calendarButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  calendarButtonTextSelected: {
    color: '#fff',
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
  fortnightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fortnightButton: {
    width: 70,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  fortnightButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  fortnightButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  fortnightButtonSubtext: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  fortnightButtonTextSelected: {
    color: '#fff',
  },
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  advancedOptionsRow: {
    marginTop: 16,
  },
  advancedOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
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
  nthDayList: {
    gap: 8,
    marginBottom: 12,
  },
  nthDayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nthDaySelectors: {
    flexDirection: 'row',
    gap: 8,
  },
  nthDaySelector: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  nthDaySelectorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
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
  yearlyDateInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
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
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  advancedToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  advancedToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  advancedContent: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
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
  manageAlarmsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
  },
  manageAlarmsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
