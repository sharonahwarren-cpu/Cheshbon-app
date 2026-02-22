
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import {
  calendarDateToUTC,
  utcToCalendarDate,
  formatDateInCalendar,
  nowUTC,
  getLocalTimezone,
  debugDateConversion,
  isValidCalendarDate,
  getDaysInMonth,
  isDSTInEffect,
  getTimezoneOffset,
  CalendarType,
} from '@/utils/dateUtils';

/**
 * DATE DEBUG SCREEN
 * 
 * Test and verify date conversions across calendars and timezones
 * Use this to ensure accuracy of date handling
 */

export default function DateDebugScreen() {
  const [calendarType, setCalendarType] = useState<CalendarType>('Gregorian');
  const [year, setYear] = useState('2025');
  const [month, setMonth] = useState('2');
  const [day, setDay] = useState('22');
  const [hour, setHour] = useState('0');
  const [minute, setMinute] = useState('0');
  const [utcTimestamp, setUtcTimestamp] = useState<number | null>(null);
  const [conversionResult, setConversionResult] = useState<string>('');
  const [useCustomTimezone, setUseCustomTimezone] = useState(false);
  const [customTimezone, setCustomTimezone] = useState('Australia/Melbourne');

  const localTimezone = getLocalTimezone();

  const handleConvertToUTC = () => {
    try {
      console.log('[DateDebug] Converting to UTC...');
      
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      const d = parseInt(day, 10);
      const h = parseInt(hour, 10);
      const min = parseInt(minute, 10);

      // Validate input
      if (isNaN(y) || isNaN(m) || isNaN(d) || isNaN(h) || isNaN(min)) {
        setConversionResult('❌ Invalid input: Please enter valid numbers');
        return;
      }

      // Check if date is valid in the calendar
      if (!isValidCalendarDate(y, m, d, calendarType)) {
        setConversionResult(`❌ Invalid date in ${calendarType} calendar`);
        return;
      }

      const tz = useCustomTimezone ? customTimezone : undefined;
      const utcMillis = calendarDateToUTC(y, m, d, h, min, calendarType, tz);
      
      setUtcTimestamp(utcMillis);
      
      // Debug the conversion
      debugDateConversion(utcMillis, calendarType, 'Input -> UTC Conversion');
      
      const result = `✅ Converted to UTC:\n\n` +
        `UTC Timestamp: ${utcMillis}\n` +
        `ISO 8601: ${new Date(utcMillis).toISOString()}\n` +
        `Timezone: ${tz || localTimezone}\n` +
        `DST Active: ${isDSTInEffect(utcMillis, tz)}\n` +
        `Offset: ${getTimezoneOffset(utcMillis, tz)} minutes`;
      
      setConversionResult(result);
    } catch (error) {
      console.error('[DateDebug] Conversion error:', error);
      setConversionResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleConvertFromUTC = () => {
    if (!utcTimestamp) {
      setConversionResult('❌ No UTC timestamp available. Convert to UTC first.');
      return;
    }

    try {
      console.log('[DateDebug] Converting from UTC...');
      
      const tz = useCustomTimezone ? customTimezone : undefined;
      const calendarDate = utcToCalendarDate(utcTimestamp, calendarType, tz);
      const formatted = formatDateInCalendar(utcTimestamp, calendarType, 'long', tz);
      
      // Debug the conversion
      debugDateConversion(utcTimestamp, calendarType, 'UTC -> Calendar Conversion');
      
      const result = `✅ Converted from UTC:\n\n` +
        `${calendarType} Date:\n` +
        `Year: ${calendarDate.year}\n` +
        `Month: ${calendarDate.month}\n` +
        `Day: ${calendarDate.day}\n` +
        `Hour: ${calendarDate.hour}\n` +
        `Minute: ${calendarDate.minute}\n` +
        `Weekday: ${calendarDate.weekday}\n\n` +
        `Formatted: ${formatted}\n` +
        `Timezone: ${tz || localTimezone}`;
      
      setConversionResult(result);
    } catch (error) {
      console.error('[DateDebug] Conversion error:', error);
      setConversionResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleTestNow = () => {
    const now = nowUTC();
    setUtcTimestamp(now);
    
    const tz = useCustomTimezone ? customTimezone : undefined;
    const calendarDate = utcToCalendarDate(now, calendarType, tz);
    
    setYear(calendarDate.year.toString());
    setMonth(calendarDate.month.toString());
    setDay(calendarDate.day.toString());
    setHour(calendarDate.hour.toString());
    setMinute(calendarDate.minute.toString());
    
    debugDateConversion(now, calendarType, 'Current Time Test');
    
    const result = `✅ Current Time:\n\n` +
      `UTC Timestamp: ${now}\n` +
      `${calendarType}: ${formatDateInCalendar(now, calendarType, 'long', tz)}\n` +
      `Timezone: ${tz || localTimezone}\n` +
      `DST Active: ${isDSTInEffect(now, tz)}`;
    
    setConversionResult(result);
  };

  const handleTestEdgeCase = () => {
    // Test midnight AEDT (Australian Eastern Daylight Time)
    const y = 2025;
    const m = 2;
    const d = 22;
    const h = 0;
    const min = 0;
    
    const utcMillis = calendarDateToUTC(y, m, d, h, min, 'Gregorian', 'Australia/Melbourne');
    setUtcTimestamp(utcMillis);
    
    debugDateConversion(utcMillis, 'Gregorian', 'Midnight AEDT Test');
    
    const result = `✅ Edge Case Test (Midnight AEDT):\n\n` +
      `Input: Feb 22, 2025 00:00 Melbourne\n` +
      `UTC Timestamp: ${utcMillis}\n` +
      `UTC ISO: ${new Date(utcMillis).toISOString()}\n` +
      `Expected: Feb 21, 2025 13:00 UTC\n` +
      `DST Active: ${isDSTInEffect(utcMillis, 'Australia/Melbourne')}\n` +
      `Offset: ${getTimezoneOffset(utcMillis, 'Australia/Melbourne')} minutes`;
    
    setConversionResult(result);
  };

  const calendarTypes: CalendarType[] = ['Gregorian', 'Hebrew', 'Chinese', 'Islamic'];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Date Debug & Test',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Timezone Info</Text>
          <Text style={styles.infoText}>Device Timezone: {localTimezone}</Text>
          
          <View style={styles.row}>
            <Text style={styles.label}>Use Custom Timezone:</Text>
            <Switch
              value={useCustomTimezone}
              onValueChange={setUseCustomTimezone}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
          
          {useCustomTimezone && (
            <TextInput
              style={styles.input}
              value={customTimezone}
              onChangeText={setCustomTimezone}
              placeholder="e.g., Australia/Sydney"
              placeholderTextColor={colors.textSecondary}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 Calendar Type</Text>
          <View style={styles.buttonRow}>
            {calendarTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.calendarButton,
                  calendarType === type && styles.calendarButtonActive,
                ]}
                onPress={() => setCalendarType(type)}
              >
                <Text
                  style={[
                    styles.calendarButtonText,
                    calendarType === type && styles.calendarButtonTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔢 Input Date/Time</Text>
          
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Year</Text>
              <TextInput
                style={styles.input}
                value={year}
                onChangeText={setYear}
                keyboardType="numeric"
                placeholder="2025"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Month</Text>
              <TextInput
                style={styles.input}
                value={month}
                onChangeText={setMonth}
                keyboardType="numeric"
                placeholder="1-12"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Day</Text>
              <TextInput
                style={styles.input}
                value={day}
                onChangeText={setDay}
                keyboardType="numeric"
                placeholder="1-31"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>
          
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Hour</Text>
              <TextInput
                style={styles.input}
                value={hour}
                onChangeText={setHour}
                keyboardType="numeric"
                placeholder="0-23"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Minute</Text>
              <TextInput
                style={styles.input}
                value={minute}
                onChangeText={setMinute}
                keyboardType="numeric"
                placeholder="0-59"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔄 Actions</Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleConvertToUTC}>
            <Text style={styles.actionButtonText}>Convert to UTC</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleConvertFromUTC}>
            <Text style={styles.actionButtonText}>Convert from UTC</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleTestNow}>
            <Text style={styles.actionButtonText}>Test Current Time</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleTestEdgeCase}>
            <Text style={styles.actionButtonText}>Test Edge Case (Midnight AEDT)</Text>
          </TouchableOpacity>
        </View>

        {conversionResult ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Result</Text>
            <View style={styles.resultBox}>
              <Text style={styles.resultText}>{conversionResult}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ Instructions</Text>
          <Text style={styles.infoText}>
            1. Select a calendar type{'\n'}
            2. Enter a date/time in that calendar{'\n'}
            3. Click "Convert to UTC" to store as timestamp{'\n'}
            4. Click "Convert from UTC" to display in calendar{'\n'}
            5. Check console logs for detailed debug info{'\n\n'}
            Use "Test Current Time" to verify current date/time{'\n'}
            Use "Test Edge Case" to verify DST handling
          </Text>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  label: {
    fontSize: 14,
    color: colors.text,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  calendarButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  calendarButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  calendarButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  calendarButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
  },
  actionButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultBox: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
  },
  resultText: {
    fontSize: 14,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 20,
  },
});
