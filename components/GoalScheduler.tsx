
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DateTime } from 'luxon';

export type ScheduleType = 'Always Active' | 'Daily' | 'Weekly' | 'Fortnightly' | 'Monthly' | 'Yearly';
export type CalendarType = 'Gregorian' | 'Hebrew' | 'Chinese' | 'Islamic';

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
  
  // Yearly
  yearlyMonths?: number[]; // [1, 6, 12]
  yearlyDates?: Array<{ month: number; day: number }>;
  
  // Advanced
  calendarType?: CalendarType;
  startDate?: Date;
  endDate?: Date;
  exclusionDates?: Date[];
  
  // Alarms
  alarms?: Array<{
    id: string;
    time: string;
    offsetDays: number;
    condition?: string;
  }>;
}

interface GoalSchedulerProps {
  config: ScheduleConfig;
  onChange: (config: ScheduleConfig) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_POSITIONS = ['First', 'Second', 'Third', 'Fourth', 'Last'];

export function GoalScheduler({ config, onChange }: GoalSchedulerProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAlarms, setShowAlarms] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | 'exclusion' | null>(null);
  const [tempDate, setTempDate] = useState(new Date());

  const updateConfig = (updates: Partial<ScheduleConfig>) => {
    onChange({ ...config, ...updates });
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
      updateConfig({ weekdays: updated });
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

    const toggleDate = (date: number) => {
      const current = config.monthlyDates || [];
      const updated = current.includes(date)
        ? current.filter(d => d !== date)
        : [...current, date].sort((a, b) => a - b);
      updateConfig({ monthlyDates: updated });
    };

    return (
      <View style={styles.optionsContainer}>
        <Text style={styles.subLabel}>Select Dates</Text>
        <View style={styles.dateGrid}>
          {Array.from({ length: 31 }, (_, i) => {
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
        
        <View style={styles.advancedOptionsRow}>
          <TouchableOpacity
            style={styles.advancedOptionButton}
            onPress={() => setShowAdvanced(!showAdvanced)}
          >
            <IconSymbol
              ios_icon_name="slider.horizontal.3"
              android_material_icon_name="tune"
              size={16}
              color={colors.primary}
            />
            <Text style={styles.advancedOptionText}>Advanced Options</Text>
          </TouchableOpacity>
        </View>
        
        {showAdvanced && (
          <View style={styles.advancedSection}>
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

    const toggleMonth = (month: number) => {
      const current = config.yearlyMonths || [];
      const updated = current.includes(month)
        ? current.filter(m => m !== month)
        : [...current, month].sort((a, b) => a - b);
      updateConfig({ yearlyMonths: updated });
    };

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return (
      <View style={styles.optionsContainer}>
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
            <Text style={styles.advancedToggleText}>Advanced Options</Text>
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
              Alarms will be managed in a separate screen with advanced options like astronomical triggers and conditions.
            </Text>
            <TouchableOpacity style={styles.manageAlarmsButton}>
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

      {showDatePicker && (
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
