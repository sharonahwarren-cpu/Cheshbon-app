
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { authenticatedGet, authenticatedPut, authenticatedDelete } from '@/utils/api';
import type { Alarm } from '@/types/alarm';
import { formatNextTriggerTime } from '@/utils/alarmCalculations';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function AlarmsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean; alarm: Alarm | null }>({
    visible: false,
    alarm: null,
  });

  useEffect(() => {
    loadAlarms();
  }, []);

  const loadAlarms = async () => {
    console.log('Loading alarms');
    setLoading(true);
    setError('');

    try {
      console.log('[API] Requesting /api/alarms...');
      const data = await authenticatedGet<Alarm[]>('/api/alarms');
      const alarmList = Array.isArray(data) ? data : ((data as any)?.data || []);
      setAlarms(alarmList);
      console.log('Alarms loaded:', alarmList.length);
    } catch (err: any) {
      console.error('Error loading alarms:', err);
      setError(err.message || 'Failed to load alarms');
    } finally {
      setLoading(false);
    }
  };

  const toggleAlarmEnabled = async (alarm: Alarm) => {
    console.log('Toggling alarm enabled:', alarm.title, !alarm.enabled);

    try {
      console.log(`[API] Requesting PUT /api/alarms/${alarm.id}...`);
      const updated = await authenticatedPut<Alarm>(`/api/alarms/${alarm.id}`, {
        enabled: !alarm.enabled,
      });
      const updatedAlarm = (updated as any)?.data || updated;
      setAlarms(prev => prev.map(a => (a.id === alarm.id ? updatedAlarm : a)));
      console.log('Alarm enabled status updated');
    } catch (err: any) {
      console.error('Error toggling alarm:', err);
      setError(err.message || 'Failed to update alarm');
    }
  };

  const confirmDeleteAlarm = (alarm: Alarm) => {
    setDeleteConfirm({ visible: true, alarm });
  };

  const deleteAlarm = async () => {
    const alarm = deleteConfirm.alarm;
    if (!alarm) return;

    console.log('Deleting alarm:', alarm.title);

    try {
      console.log(`[API] Requesting DELETE /api/alarms/${alarm.id}...`);
      await authenticatedDelete(`/api/alarms/${alarm.id}`);

      setAlarms(prev => prev.filter(a => a.id !== alarm.id));
      setDeleteConfirm({ visible: false, alarm: null });
      console.log('Alarm deleted successfully');
    } catch (err: any) {
      console.error('Error deleting alarm:', err);
      setError(err.message || 'Failed to delete alarm');
      setDeleteConfirm({ visible: false, alarm: null });
    }
  };

  const renderAlarmCard = (alarm: Alarm) => {
    const nextTriggerText = formatNextTriggerTime(alarm);
    const triggerTypeText = alarm.triggers.map(t => t.type).join(', ');

    return (
      <View key={alarm.id} style={styles.alarmCard}>
        <View style={styles.alarmHeader}>
          <View style={styles.alarmTitleRow}>
            <Text style={styles.alarmTitle}>{alarm.title}</Text>
            <Switch
              value={alarm.enabled}
              onValueChange={() => toggleAlarmEnabled(alarm)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={alarm.enabled ? colors.background : colors.textSecondary}
            />
          </View>
          {alarm.calendarType && (
            <Text style={styles.alarmCalendar}>
              {alarm.calendarType} - {alarm.eventType}
            </Text>
          )}
        </View>

        <View style={styles.alarmDetails}>
          <View style={styles.alarmDetailRow}>
            <IconSymbol
              ios_icon_name="clock"
              android_material_icon_name="schedule"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.alarmDetailText}>{nextTriggerText}</Text>
          </View>

          <View style={styles.alarmDetailRow}>
            <IconSymbol
              ios_icon_name="bell"
              android_material_icon_name="notifications"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.alarmDetailText}>
              {alarm.recurring ? 'Recurring' : 'One-time'} • {triggerTypeText}
            </Text>
          </View>

          {alarm.location && (
            <View style={styles.alarmDetailRow}>
              <IconSymbol
                ios_icon_name="location"
                android_material_icon_name="location-on"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.alarmDetailText}>
                Location-based ({alarm.location.radius || 100}m radius)
              </Text>
            </View>
          )}
        </View>

        <View style={styles.alarmActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/alarms/create?id=${alarm.id}`)}
          >
            <IconSymbol
              ios_icon_name="pencil"
              android_material_icon_name="edit"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => confirmDeleteAlarm(alarm)}
          >
            <IconSymbol
              ios_icon_name="trash"
              android_material_icon_name="delete"
              size={20}
              color={colors.error}
            />
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Alarms', headerShown: true }} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Alarms',
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/alarms/create')}>
              <IconSymbol
                ios_icon_name="plus"
                android_material_icon_name="add"
                size={24}
                color={colors.primary}
              />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollView}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadAlarms}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : alarms.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol
              ios_icon_name="bell.slash"
              android_material_icon_name="notifications-off"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyText}>No alarms yet</Text>
            <Text style={styles.emptySubtext}>
              Create your first alarm to get started
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/alarms/create')}
            >
              <Text style={styles.createButtonText}>Create Alarm</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.alarmsContainer}>
            {alarms.map(alarm => renderAlarmCard(alarm))}
          </View>
        )}
      </ScrollView>

      <ConfirmModal
        visible={deleteConfirm.visible}
        title="Delete Alarm"
        message={`Are you sure you want to delete "${deleteConfirm.alarm?.title}"?`}
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
        onConfirm={deleteAlarm}
        onCancel={() => setDeleteConfirm({ visible: false, alarm: null })}
        confirmButtonColor={colors.error}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  alarmsContainer: {
    padding: 16,
  },
  alarmCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alarmHeader: {
    marginBottom: 12,
  },
  alarmTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  alarmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  alarmCalendar: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  alarmDetails: {
    marginBottom: 12,
  },
  alarmDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  alarmDetailText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
  alarmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  deleteButton: {
    backgroundColor: colors.background,
  },
  deleteButtonText: {
    color: colors.error,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  createButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  createButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
});
