
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { getNextActivations, type GoalSchedule, type ActivationPreview } from '@/utils/scheduleCalculations';

interface GoalSchedulePreviewProps {
  schedule: GoalSchedule;
  alarms?: {
    id: string;
    triggers: {
      type: 'time' | 'astronomical' | 'location';
      value?: string;
      offsetMinutes?: number;
    }[];
  }[];
  location?: { latitude: number; longitude: number };
  count?: number;
}

/**
 * GoalSchedulePreview Component
 * 
 * Displays upcoming activation dates for a goal based on its schedule.
 * Shows next 5-10 activations with local time, calendar date, and alarm times.
 */
export function GoalSchedulePreview({
  schedule,
  alarms,
  location,
  count = 5,
}: GoalSchedulePreviewProps) {
  const [activations, setActivations] = useState<ActivationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const loadActivations = async () => {
    console.log('[GoalSchedulePreview] Loading activations');
    setLoading(true);
    try {
      const previews = await getNextActivations(schedule, alarms, count, location);
      setActivations(previews);
      console.log('[GoalSchedulePreview] Loaded activations:', previews.length);
    } catch (error) {
      console.error('[GoalSchedulePreview] Error loading activations:', error);
      setActivations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, alarms, location, count]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <IconSymbol
            ios_icon_name="calendar"
            android_material_icon_name="calendar-today"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.headerText}>Upcoming Activations</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Calculating schedule...</Text>
        </View>
      </View>
    );
  }

  if (activations.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <IconSymbol
            ios_icon_name="calendar"
            android_material_icon_name="calendar-today"
            size={18}
            color={colors.textSecondary}
          />
          <Text style={styles.headerText}>Upcoming Activations</Text>
        </View>
        <Text style={styles.emptyText}>No upcoming activations found</Text>
      </View>
    );
  }

  const displayCount = expanded ? activations.length : Math.min(3, activations.length);
  const displayActivations = activations.slice(0, displayCount);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconSymbol
          ios_icon_name="calendar"
          android_material_icon_name="calendar-today"
          size={18}
          color={colors.primary}
        />
        <Text style={styles.headerText}>Upcoming Activations</Text>
        <Text style={styles.countBadge}>{activations.length}</Text>
      </View>

      <View style={styles.activationsList}>
        {displayActivations.map((activation, index) => (
          <View key={index} style={styles.activationItem}>
            <View style={styles.activationIcon}>
              <IconSymbol
                ios_icon_name="circle.fill"
                android_material_icon_name="circle"
                size={8}
                color={index === 0 ? colors.primary : colors.textSecondary}
              />
            </View>
            <View style={styles.activationContent}>
              <Text style={[styles.activationDescription, index === 0 && styles.nextActivation]}>
                {activation.description}
              </Text>
              {activation.calendarDate !== activation.localTime && (
                <Text style={styles.activationCalendar}>{activation.calendarDate}</Text>
              )}
              {activation.alarmTime && (
                <View style={styles.alarmBadge}>
                  <IconSymbol
                    ios_icon_name="bell.fill"
                    android_material_icon_name="notifications"
                    size={12}
                    color={colors.primary}
                  />
                  <Text style={styles.alarmText}>{activation.alarmTime}</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>

      {activations.length > 3 && (
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={styles.expandButtonText}>
            {expanded ? 'Show Less' : `Show ${activations.length - 3} More`}
          </Text>
          <IconSymbol
            ios_icon_name={expanded ? 'chevron.up' : 'chevron.down'}
            android_material_icon_name={expanded ? 'expand-less' : 'expand-more'}
            size={16}
            color={colors.primary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  countBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  activationsList: {
    gap: 12,
  },
  activationItem: {
    flexDirection: 'row',
    gap: 12,
  },
  activationIcon: {
    paddingTop: 6,
  },
  activationContent: {
    flex: 1,
    gap: 4,
  },
  activationDescription: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  nextActivation: {
    fontWeight: '600',
    color: colors.primary,
  },
  activationCalendar: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  alarmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  alarmText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
  },
  expandButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
