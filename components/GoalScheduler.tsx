
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
  
  // Fortnightly - UPDATED: Now uses Week 1 / Week 2 instead of even/odd
  fortnightDays?: number[]; // 0-13
  fortnightWeek?: 'week1' | 'week2'; // Week 1 or Week 2
  
  // Monthly
  monthlyDates?: number[]; // [1, 15, 30]
  monthlyNthDay?: Array<{ day: string; nth: number }>; // "Second Tuesday"
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

interface GoalSchedulerProps {
  config: ScheduleConfig;
  onChange: (config: ScheduleConfig) => void;
  alternativeCalendar?: CalendarType;
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
];

export function GoalScheduler({ config, onChange, alternativeCalendar }: GoalSchedulerProps) {
  const router = useRouter();
  const [showDatePicker, setShowDatePicker] = useState<'end' | 'exclusion' | 'monthlyDate' | 'yearlyDate' | null>(null);
  const [tempDate, setTempDate] = useState(new Date());
  const [showMonthlyAdvanced, setShowMonthlyAdvanced] = useState(false);
  const [showYearlyAdvanced, setShowYearlyAdvanced] = useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [showCalendarEventPicker, setShowCalendarEventPicker] = useState(false);
  const [calendarEventContext, setCalendarEventContext] = useState<'monthly' | 'yearly'>('monthly');

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
        
        {/* End Date */}
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

        {/* Exclusion Dates */}
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
    );
  };

  const renderMonthlyOptions = () => {
    if (config.scheduleType !== 'Monthly') return null;

    const useAlternativeCalendar = config.monthlyUseAlternativeCalendar || false;
    const selectedCalendar = useAlternativeCalendar ? (config.monthlyCalendarType || alternativeCalendar || 'gregorian') : 'gregorian';
    const maxDays = CALENDAR_MAX_DAYS[selectedCalendar];

    const toggleDate = (date: number) => {
      const current = config.monthlyDates || [];
      const updated = current.includes(date)
        ? current.filter(d => d !== date)
        : [...current, date].sort((a, b) => a - b);
      updateConfig({ monthlyDates: updated });
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
                onPress={() => {
                  const newValue = !useAlternativeCalendar;
                  updateConfig({ 
                    monthlyUseAlternativeCalendar: newValue,
                    monthlyCalendarType: newValue ? alternativeCalendar : 'gregorian',
                  });
                }}
              >
                <View style={[styles.toggleSwitchThumb, useAlternativeCalendar && styles.toggleSwitchThumbActive]} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Calendar Type - Only show if alternative calendar is enabled */}
        {useAlternativeCalendar && (
          <View style={styles.calendarSection}>
            <Text style={styles.subLabel}>Calendar Type</Text>
            <TouchableOpacity
              style={styles.calendarButton}
              onPress={() => {
                setCalendarEventContext('monthly');
                setShowCalendarPicker(true);
              }}
            >
              <Text style={styles.calendarButtonText}>
                {CALENDAR_LABELS[selectedCalendar]}
              </Text>
              <IconSymbol
                ios_icon_name="chevron.down"
                android_material_icon_name="arrow-drop-down"
                size={20}
                color={colors.text}
              />
            </TouchableOpacity>
            <Text style={styles.helperText}>
              {CALENDAR_LABELS[selectedCalendar]} calendar: Max {maxDays} days
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

        <Text style={styles.subLabel}>Select Dates</Text>
        <Text style={styles.helperText}>
          Choose specific dates of the month (e.g., 3rd, 15th, 28th) or use calendar popup
        </Text>
        
        {/* Calendar Popup Button */}
        <TouchableOpacity
          style={styles.calendarPopupButton}
          onPress={() => {
            setTempDate(new Date());
            setShowDatePicker('monthlyDate');
          }}
        >
          <IconSymbol
            ios_icon_name="calendar"
            android_material_icon_name="calendar-today"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.calendarPopupButtonText}>Select Date from Calendar</Text>
        </TouchableOpacity>

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
        
        {/* More Options */}
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

    return (
      <View style={styles.optionsContainer}>
        {/* Use Alternative Calendar Toggle */}
        {alternativeCalendar && alternativeCalendar !== 'gregorian' && (
          <View style={styles.calendarToggleSection}>
            <View style={styles.calendarToggleRow}>
              <Text style={styles.subLabel}>Use Alternative Calendar</Text>
              <TouchableOpacity
                style={[styles.toggleSwitch, useAlternativeCalendar && styles.toggleSwitchActive]}
                onPress={() => {
                  const newValue = !useAlternativeCalendar;
                  updateConfig({ 
                    yearlyUseAlternativeCalendar: newValue,
                    yearlyCalendarType: newValue ? alternativeCalendar : 'gregorian',
                  });
                }}
              >
                <View style={[styles.toggleSwitchThumb, useAlternativeCalendar && styles.toggleSwitchThumbActive]} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Calendar Type - Only show if alternative calendar is enabled */}
        {useAlternativeCalendar && (
          <View style={styles.calendarSection}>
            <Text style={styles.subLabel}>Calendar Type</Text>
            <TouchableOpacity
              style={styles.calendarButton}
              onPress={() => {
                setCalendarEventContext('yearly');
                setShowCalendarPicker(true);
              }}
            >
              <Text style={styles.calendarButtonText}>
                {CALENDAR_LABELS[selectedCalendar]}
              </Text>
              <IconSymbol
                ios_icon_name="chevron.down"
                android_material_icon_name="arrow-drop-down"
                size={20}
                color={colors.text}
              />
            </TouchableOpacity>
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
              e.g., 1st of Feb or Jan 31 - Feb 2. Use calendar popup to select dates.
            </Text>
            
            {/* Calendar Popup Button */}
            <TouchableOpacity
              style={styles.calendarPopupButton}
              onPress={() => {
                setTempDate(new Date());
                setShowDatePicker('yearlyDate');
              }}
            >
              <IconSymbol
                ios_icon_name="calendar"
                android_material_icon_name="calendar-today"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.calendarPopupButtonText}>Select Date from Calendar</Text>
            </TouchableOpacity>

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
        
        {/* End Date & Exclusions */}
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
              } else if (showDatePicker === 'monthlyDate') {
                const dayOfMonth = selectedDate.getDate();
                const current = config.monthlyDates || [];
                if (!current.includes(dayOfMonth)) {
                  updateConfig({ monthlyDates: [...current, dayOfMonth].sort((a, b) => a - b) });
                }
              } else if (showDatePicker === 'yearlyDate') {
                const month = selectedDate.getMonth() + 1;
                const day = selectedDate.getDate();
                const current = config.yearlyDates || [];
                updateConfig({ yearlyDates: [...current, { month, day }] });
              }
            }
            setShowDatePicker(null);
          }}
        />
      )}

      {/* Calendar Type Picker Modal */}
      <Modal
        visible={showCalendarPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendarPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Calendar Type</Text>
              <TouchableOpacity onPress={() => setShowCalendarPicker(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.modalScroll}>
              {CALENDAR_TYPES.map((cal) => {
                const isSelected = calendarEventContext === 'monthly' 
                  ? config.monthlyCalendarType === cal 
                  : config.yearlyCalendarType === cal;
                return (
                  <TouchableOpacity
                    key={cal}
                    style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                    onPress={() => {
                      if (calendarEventContext === 'monthly') {
                        updateConfig({ monthlyCalendarType: cal });
                      } else {
                        updateConfig({ yearlyCalendarType: cal });
                      }
                      setShowCalendarPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                      {CALENDAR_LABELS[cal]}
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
            </View>
          </View>
        </View>
      </Modal>

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
  calendarPopupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  calendarPopupButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
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
});
