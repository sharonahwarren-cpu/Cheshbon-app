
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateTime } from 'luxon';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '@/utils/api';
import { ConfirmModal } from '@/components/ConfirmModal';
import { colors } from '@/styles/commonStyles';
import { LoadingButton } from '@/components/LoadingButton';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { GoalScheduler, type ScheduleConfig } from '@/components/GoalScheduler';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import { getLocalTimezone } from '@/utils/dateUtils';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

interface Goal {
  id: string;
  title: string;
}

interface LifeArea {
  id: string;
  name: string;
  parentId?: string | null;
  icon?: string;
  color?: string;
  displayOrder?: number;
  showProgress?: boolean;
  children?: LifeArea[];
}

interface Strategy {
  id: string;
  name: string;
  description?: string;
}

interface Currency {
  id: string;
  name: string;
  symbol?: string;
  onSuccess?: 'ADD' | 'SUBTRACT' | 'NONE';
  onFailure?: 'ADD' | 'SUBTRACT' | 'NONE';
}

interface UserPreferences {
  reflectionCategoriesEnabled?: boolean;
  reflectionCategories?: string[];
  alternativeCalendar?: 'gregorian' | 'hebrew' | 'chinese' | 'islamic';
}

interface Alarm {
  id: string;
  title: string;
  goalId?: string;
  enabled: boolean;
}

type BehaviorCategory = 'Action' | 'Speech' | 'Thought' | 'Feeling';
type GoalType = 'Restraining' | 'Proactive';

export default function CreateGoalScreen() {
  const router = useRouter();
  const { 
    id: editingGoalId, 
    fromReflection, 
    lifeAreaId: preselectedLifeAreaId, 
    returnToSettings, 
    returnToLifeAreaWizard,
    wizardLifeAreaId,
    returnToAddReflection,
    reflectionCategory,
    reflectionType,
    reflectionDescription,
    reflectionDate
  } = useLocalSearchParams<{ 
    id?: string; 
    fromReflection?: string;
    lifeAreaId?: string;
    returnToSettings?: string;
    returnToLifeAreaWizard?: string;
    wizardLifeAreaId?: string;
    returnToAddReflection?: string;
    reflectionCategory?: string;
    reflectionType?: string;
    reflectionDescription?: string;
    reflectionDate?: string;
  }>();
  
  const [showCreateAnotherPrompt, setShowCreateAnotherPrompt] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [parentGoalId, setParentGoalId] = useState<string | undefined>();
  const [lifeAreaId, setLifeAreaId] = useState<string | undefined>();
  const [behaviorCategories, setBehaviorCategories] = useState<BehaviorCategory[]>([]);
  const [type, setType] = useState<GoalType>('Proactive');
  const [strategyIds, setStrategyIds] = useState<string[]>([]);
  
  // New Goal Scheduler state - DEFAULT TO "Always Active"
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    scheduleType: 'Always Active',
  });
  
  // Alarms state - FIXED: Use Date object and react-native-modal-datetime-picker for cross-platform consistency
  const [alarmsEnabled, setAlarmsEnabled] = useState(false);
  const [quickAlarmTime, setQuickAlarmTime] = useState<Date | undefined>(undefined);
  const [showQuickTimePicker, setShowQuickTimePicker] = useState(false);
  const [goalAlarms, setGoalAlarms] = useState<Alarm[]>([]);
  
  // Confirm modal state
  const [showDeleteAlarmConfirm, setShowDeleteAlarmConfirm] = useState(false);
  const [alarmToDelete, setAlarmToDelete] = useState<{ id: string; title: string } | null>(null);
  
  // Reward state
  const [rewardCurrencyId, setRewardCurrencyId] = useState<string | undefined>();
  const [rewardSuccesses, setRewardSuccesses] = useState<string>('');
  const [rewardAmount, setRewardAmount] = useState<string>('');
  
  // Consequence state
  const [consequenceCurrencyId, setConsequenceCurrencyId] = useState<string | undefined>();
  const [consequenceFailures, setConsequenceFailures] = useState<string>('');
  const [consequenceAmount, setConsequenceAmount] = useState<string>('');

  // Data from backend
  const [goals, setGoals] = useState<Goal[]>([]);
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    reflectionCategoriesEnabled: true,
    reflectionCategories: ['Action', 'Speech', 'Thought'],
    alternativeCalendar: 'gregorian',
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showParentGoalPicker, setShowParentGoalPicker] = useState(false);
  const [showLifeAreaPicker, setShowLifeAreaPicker] = useState(false);
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);
  const [showRewardCurrencyPicker, setShowRewardCurrencyPicker] = useState(false);
  const [showConsequenceCurrencyPicker, setShowConsequenceCurrencyPicker] = useState(false);
  const [showScheduleWizard, setShowScheduleWizard] = useState(false);
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    loadData();
  }, []);

  // Reload alarms when returning from create alarm screen
  const reloadGoalAlarms = React.useCallback(async () => {
    if (!editingGoalId) return;
    
    try {
      console.log('[CreateGoal] Reloading alarms on focus for goal:', editingGoalId);
      const [goalData, allAlarmsData] = await Promise.all([
        authenticatedGet<any>(`/api/goals/${editingGoalId}`),
        authenticatedGet<any>('/api/alarms'),
      ]);
      
      const goal = (goalData as any)?.data || goalData;
      const allAlarms = Array.isArray(allAlarmsData) ? allAlarmsData : (allAlarmsData?.data || []);
      
      // Get alarm IDs from goal's alarms field
      let goalAlarmIds: string[] = [];
      if (goal?.alarms) {
        const parsedAlarms = typeof goal.alarms === 'string' 
          ? JSON.parse(goal.alarms) 
          : goal.alarms;
        if (Array.isArray(parsedAlarms)) {
          goalAlarmIds = parsedAlarms.map((a: any) => 
            typeof a === 'string' ? a : a.id
          ).filter(Boolean);
        }
      }
      
      const filteredAlarms = goalAlarmIds.length > 0
        ? allAlarms.filter((alarm: any) => goalAlarmIds.includes(alarm.id))
        : [];
      
      console.log('[CreateGoal] Reloaded alarms:', filteredAlarms.length);
      setGoalAlarms(filteredAlarms);
      if (filteredAlarms.length > 0) {
        setAlarmsEnabled(true);
      }
    } catch (error: any) {
      console.error('[CreateGoal] Error reloading alarms:', error);
    }
  }, [editingGoalId]);

  useFocusEffect(
    React.useCallback(() => {
      // Only reload alarms on focus (not the full data load)
      // This handles the case when user returns from create alarm screen
      if (editingGoalId && !loading) {
        reloadGoalAlarms();
      }
    }, [editingGoalId, loading, reloadGoalAlarms])
  );

  const loadData = async () => {
    console.log('Loading form data for goal creation/editing');
    setLoading(true);
    try {
      const promises = [
        authenticatedGet<any>('/api/goals'),
        authenticatedGet<any>('/api/life-areas'),
        authenticatedGet<any>('/api/strategies'),
        authenticatedGet<any>('/api/currencies'),
        authenticatedGet<any>('/api/user-preferences'),
      ];

      if (editingGoalId) {
        promises.push(authenticatedGet<any>(`/api/goals/${editingGoalId}`));
        promises.push(authenticatedGet<any>(`/api/alarms`));
      }

      const results = await Promise.all(promises);
      const [goalsData, lifeAreasData, strategiesData, currenciesData, preferencesData, goalDetailsData, allAlarmsData] = results;
      
      const goals = Array.isArray(goalsData) ? goalsData : (goalsData?.data || []);
      const lifeAreas = Array.isArray(lifeAreasData) ? lifeAreasData : (lifeAreasData?.data || []);
      const strategies = Array.isArray(strategiesData) ? strategiesData : (strategiesData?.data || []);
      const currencies = Array.isArray(currenciesData) ? currenciesData : (currenciesData?.data || []);
      const preferences = preferencesData?.data || preferencesData || {
        reflectionCategoriesEnabled: true,
        reflectionCategories: ['Action', 'Speech', 'Thought'],
        alternativeCalendar: 'gregorian',
      };
      
      if (preferences.reflectionCategories && typeof preferences.reflectionCategories === 'string') {
        try {
          preferences.reflectionCategories = JSON.parse(preferences.reflectionCategories);
        } catch (e) {
          console.error('[API] Failed to parse reflectionCategories:', e);
          preferences.reflectionCategories = ['Action', 'Speech', 'Thought'];
        }
      }
      
      setGoals(goals);
      setLifeAreas(lifeAreas);
      setStrategies(strategies);
      setCurrencies(currencies);
      setUserPreferences(preferences);

      if (preselectedLifeAreaId && !editingGoalId) {
        console.log('[CreateGoal] Pre-selecting life area:', preselectedLifeAreaId);
        setLifeAreaId(preselectedLifeAreaId);
      }

      if (editingGoalId && goalDetailsData) {
        const goalDetails = goalDetailsData?.data || goalDetailsData;
        console.log('[API] Goal details loaded for editing:', JSON.stringify(goalDetails, null, 2));
        
        setTitle(goalDetails.title || '');
        setDescription(goalDetails.description || '');
        setParentGoalId(goalDetails.parentGoalId || goalDetails.parent_goal_id);
        setLifeAreaId(goalDetails.lifeAreaId || goalDetails.life_area_id);
        setBehaviorCategories(goalDetails.behaviorCategories || goalDetails.behavior_categories || []);
        setType(goalDetails.type || 'Proactive');
        setStrategyIds(goalDetails.strategyIds || goalDetails.strategy_ids || []);
        
        // Load schedule config from goal details
        const rawScheduleType = goalDetails.scheduleType || goalDetails.schedule_type || 'Always Active';
        setScheduleConfig({
          scheduleType: rawScheduleType,
          timesPerDay: goalDetails.scheduleTimesPerDay || goalDetails.schedule_times_per_day,
          weekdays: goalDetails.scheduleDaysOfWeek || goalDetails.schedule_days_of_week,
        });
        
        if (goalDetails.rewardCurrencyId || goalDetails.reward_currency_id) {
          setRewardCurrencyId(goalDetails.rewardCurrencyId || goalDetails.reward_currency_id);
          setRewardSuccesses((goalDetails.rewardSuccesses || goalDetails.reward_successes)?.toString() || '');
          setRewardAmount((goalDetails.rewardAmount || goalDetails.reward_amount)?.toString() || '');
        }
        
        if (goalDetails.consequenceCurrencyId || goalDetails.consequence_currency_id) {
          setConsequenceCurrencyId(goalDetails.consequenceCurrencyId || goalDetails.consequence_currency_id);
          setConsequenceFailures((goalDetails.consequenceFailures || goalDetails.consequence_failures)?.toString() || '');
          setConsequenceAmount((goalDetails.consequenceAmount || goalDetails.consequence_amount)?.toString() || '');
        }

        // Load alarms for this goal using the goal's alarms jsonb field to filter
        if (allAlarmsData) {
          const allAlarms = Array.isArray(allAlarmsData) ? allAlarmsData : (allAlarmsData?.data || []);
          
          // Get the alarm IDs stored in the goal's alarms field
          const goalAlarmsField = goalDetails.alarms;
          let goalAlarmIds: string[] = [];
          
          if (goalAlarmsField) {
            const parsedAlarms = typeof goalAlarmsField === 'string' 
              ? JSON.parse(goalAlarmsField) 
              : goalAlarmsField;
            
            if (Array.isArray(parsedAlarms)) {
              // Support both array of IDs and array of objects with id field
              goalAlarmIds = parsedAlarms.map((a: any) => 
                typeof a === 'string' ? a : a.id
              ).filter(Boolean);
            }
          }
          
          console.log('[CreateGoal] Goal alarm IDs from goal record:', goalAlarmIds);
          
          // Filter all alarms to only those belonging to this goal
          const filteredAlarms = goalAlarmIds.length > 0
            ? allAlarms.filter((alarm: any) => goalAlarmIds.includes(alarm.id))
            : [];
          
          console.log('[CreateGoal] Filtered alarms for goal:', filteredAlarms.length);
          setGoalAlarms(filteredAlarms);
          if (filteredAlarms.length > 0) {
            setAlarmsEnabled(true);
          }
        }
      }
    } catch (error: any) {
      console.error('[API] Error loading form data:', error);
      showError(error.message || 'Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  const showError = (message: string) => {
    setModalTitle('Error');
    setModalMessage(message);
    setModalType('error');
    setModalVisible(true);
  };

  const showSuccess = (message: string) => {
    setModalTitle('Success');
    setModalMessage(message);
    setModalType('success');
    setModalVisible(true);
  };

  const toggleBehaviorCategory = (category: BehaviorCategory) => {
    const newCategories = behaviorCategories.includes(category)
      ? behaviorCategories.filter(c => c !== category)
      : [...behaviorCategories, category];
    setBehaviorCategories(newCategories);
  };

  const toggleStrategy = (strategyId: string) => {
    const newStrategies = strategyIds.includes(strategyId)
      ? strategyIds.filter(id => id !== strategyId)
      : [...strategyIds, strategyId];
    setStrategyIds(newStrategies);
  };

  const handleSubmit = async () => {
    console.log(editingGoalId ? 'Submitting goal update form' : 'Submitting goal creation form');
    
    if (!title.trim()) {
      showError('Goal title is required');
      return;
    }

    const categoriesEnabled = userPreferences.reflectionCategoriesEnabled !== false;
    if (categoriesEnabled && behaviorCategories.length === 0) {
      showError('Please select at least one behaviour category');
      return;
    }

    setSubmitting(true);
    try {
      const goalData: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        parentGoalId,
        lifeAreaId,
        behaviorCategories: behaviorCategories.length > 0 ? behaviorCategories : undefined,
        type,
        strategyIds: strategyIds.length > 0 ? strategyIds : undefined,
        scheduleType: scheduleConfig.scheduleType,
        scheduleTimesPerDay: scheduleConfig.timesPerDay,
        scheduleDaysOfWeek: scheduleConfig.weekdays,
      };
      
      console.log('[API] Submitting goal data:', JSON.stringify(goalData, null, 2));

      if (rewardCurrencyId && rewardSuccesses && rewardAmount) {
        goalData.reward = {
          currencyId: rewardCurrencyId,
          successes: parseInt(rewardSuccesses),
          amount: parseInt(rewardAmount),
        };
      } else {
        goalData.reward = null;
      }

      if (consequenceCurrencyId && consequenceFailures && consequenceAmount) {
        goalData.consequence = {
          currencyId: consequenceCurrencyId,
          failures: parseInt(consequenceFailures),
          amount: parseInt(consequenceAmount),
        };
      } else {
        goalData.consequence = null;
      }

      let createdOrUpdatedGoal: any;
      
      if (editingGoalId) {
        createdOrUpdatedGoal = await authenticatedPut(`/api/goals/${editingGoalId}`, goalData);
        showSuccess('Goal updated successfully!');
      } else {
        createdOrUpdatedGoal = await authenticatedPost('/api/goals', goalData);
        
        if (preselectedLifeAreaId && createdOrUpdatedGoal) {
          const goalId = createdOrUpdatedGoal.id || createdOrUpdatedGoal.data?.id;
          if (goalId) {
            try {
              await authenticatedPost(`/api/life-areas/${preselectedLifeAreaId}/goals`, { goalId });
            } catch (linkError) {
              console.error('[API] Error linking goal to life area:', linkError);
            }
          }
        }
        
        showSuccess('Goal created successfully!');
      }
      
      setTimeout(() => {
        if (returnToLifeAreaWizard === 'true' && wizardLifeAreaId) {
          setModalVisible(false);
          setShowCreateAnotherPrompt(true);
        } else if (returnToAddReflection === 'true') {
          const params = new URLSearchParams({
            openModal: 'true',
            reflectionCategory: reflectionCategory || '',
            reflectionType: reflectionType || 'Proactive',
            reflectionDescription: reflectionDescription || '',
            reflectionDate: reflectionDate || new Date().toISOString(),
          });
          router.push(`/(tabs)/reflect?${params.toString()}`);
        } else if (fromReflection === 'true') {
          router.push('/(tabs)/reflect');
        } else if (returnToSettings === 'true') {
          router.back();
        } else {
          router.back();
        }
      }, 1500);
    } catch (error: any) {
      console.error('[API] Error saving goal:', error);
      showError(error.message || 'Failed to save goal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvancedAlarms = () => {
    console.log('User tapped Advanced Alarms button');
    const alarmTitle = title.trim() ? `${title.trim()} Alarm` : 'Goal Alarm';
    const params = new URLSearchParams({
      goalId: editingGoalId || '',
      goalTitle: alarmTitle,
      scheduleType: scheduleConfig.scheduleType,
    });
    if (scheduleConfig.weekdays && scheduleConfig.weekdays.length > 0) {
      params.set('scheduleDays', scheduleConfig.weekdays.join(','));
    }
    // Pass quick alarm time if set
    if (quickAlarmTime) {
      const hours = quickAlarmTime.getHours().toString().padStart(2, '0');
      const minutes = quickAlarmTime.getMinutes().toString().padStart(2, '0');
      params.set('quickAlarmTime', `${hours}:${minutes}`);
    }
    router.push(`/alarms/create?${params.toString()}`);
  };

  const handleEditAlarm = (alarmId: string) => {
    console.log('User tapped Edit Alarm:', alarmId);
    router.push(`/alarms/create?id=${alarmId}`);
  };

  const handleToggleAlarm = async (alarmId: string, currentEnabled: boolean) => {
    console.log('User tapped Toggle Alarm:', alarmId, 'Current state:', currentEnabled);
    try {
      await authenticatedPut(`/api/alarms/${alarmId}`, { enabled: !currentEnabled });
      
      // Update local state
      setGoalAlarms(goalAlarms.map(alarm => 
        alarm.id === alarmId ? { ...alarm, enabled: !currentEnabled } : alarm
      ));
      
      const newState = !currentEnabled ? 'activated' : 'deactivated';
      showSuccess(`Alarm ${newState} successfully!`);
    } catch (error: any) {
      console.error('[API] Error toggling alarm:', error);
      showError(error.message || 'Failed to toggle alarm');
    }
  };

  const handleDeleteAlarm = (alarmId: string, alarmTitle: string) => {
    console.log('User tapped Delete Alarm:', alarmId);
    setAlarmToDelete({ id: alarmId, title: alarmTitle });
    setShowDeleteAlarmConfirm(true);
  };

  const confirmDeleteAlarm = async () => {
    if (!alarmToDelete) return;
    
    console.log('User confirmed Delete Alarm:', alarmToDelete.id);
    try {
      await authenticatedDelete(`/api/alarms/${alarmToDelete.id}`);
      
      // Update local state
      const updatedAlarms = goalAlarms.filter(alarm => alarm.id !== alarmToDelete.id);
      setGoalAlarms(updatedAlarms);
      
      // Update the goal's alarms field to remove this alarm ID
      if (editingGoalId) {
        const remainingAlarmIds = updatedAlarms.map(a => a.id);
        console.log('[API] Updating goal alarms field after deletion:', remainingAlarmIds);
        try {
          await authenticatedPut(`/api/goals/${editingGoalId}`, {
            alarms: remainingAlarmIds.length > 0 ? remainingAlarmIds.map(id => ({ id })) : null,
          });
          console.log('[API] Goal alarms field updated successfully');
        } catch (updateError: any) {
          console.error('[API] Error updating goal alarms field:', updateError);
          // Non-critical error - alarm was deleted, just the goal reference wasn't updated
        }
      }
      
      showSuccess('Alarm deleted successfully!');
    } catch (error: any) {
      console.error('[API] Error deleting alarm:', error);
      showError(error.message || 'Failed to delete alarm');
    } finally {
      setShowDeleteAlarmConfirm(false);
      setAlarmToDelete(null);
    }
  };

  const getSelectedParentGoalName = () => {
    const goal = goals.find(g => g.id === parentGoalId);
    return goal ? goal.title : 'Select Parent Goal';
  };

  const getSelectedLifeAreaName = () => {
    const findArea = (areas: LifeArea[]): LifeArea | undefined => {
      for (const area of areas) {
        if (area.id === lifeAreaId) return area;
        if (area.children) {
          const found = findArea(area.children);
          if (found) return found;
        }
      }
      return undefined;
    };
    const area = findArea(lifeAreas);
    return area ? area.name : 'Select Life Area';
  };

  const getSelectedCurrencyName = (currencyId?: string) => {
    const currency = currencies.find(c => c.id === currencyId);
    return currency ? currency.name : 'Select Currency';
  };

  const getRewardActionText = () => {
    if (!rewardCurrencyId) return 'earn';
    const currency = currencies.find(c => c.id === rewardCurrencyId);
    if (!currency || !currency.onSuccess) return 'earn';
    
    if (currency.onSuccess === 'ADD') return 'earn';
    if (currency.onSuccess === 'SUBTRACT') return 'lose';
    return 'earn';
  };

  const getConsequenceActionText = () => {
    if (!consequenceCurrencyId) return 'lose';
    const currency = currencies.find(c => c.id === consequenceCurrencyId);
    if (!currency || !currency.onFailure) return 'lose';
    
    if (currency.onFailure === 'ADD') return 'gain';
    if (currency.onFailure === 'SUBTRACT') return 'lose';
    return 'lose';
  };

  const renderLifeAreaHierarchy = (areas: LifeArea[], depth: number = 0) => {
    return areas.map((area) => {
      const paddingLeft = 20 + depth * 20;
      const isSelected = area.id === lifeAreaId;
      
      return (
        <React.Fragment key={area.id}>
          <TouchableOpacity
            style={[
              styles.pickerItem,
              { paddingLeft },
              isSelected && styles.pickerItemSelected,
            ]}
            onPress={() => {
              setLifeAreaId(area.id);
              setShowLifeAreaPicker(false);
            }}
          >
            <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
              {area.name}
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
          {area.children && area.children.length > 0 && renderLifeAreaHierarchy(area.children, depth + 1)}
        </React.Fragment>
      );
    });
  };

  const formatTime12Hour = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const getScheduleDescription = () => {
    const scheduleType = scheduleConfig.scheduleType;
    if (scheduleType === 'Always Active') {
      return 'every day';
    } else if (scheduleType === 'Daily') {
      return 'daily';
    } else if (scheduleType === 'Weekly') {
      const dayCount = scheduleConfig.weekdays?.length || 0;
      return dayCount > 0 ? `${dayCount} days per week` : 'weekly';
    } else if (scheduleType === 'Fortnightly') {
      return 'fortnightly';
    } else if (scheduleType === 'Monthly') {
      return 'monthly';
    } else if (scheduleType === 'Yearly') {
      return 'yearly';
    }
    return scheduleType.toLowerCase();
  };

  // FIXED: Handler for react-native-modal-datetime-picker
  const handleQuickTimePickerConfirm = (date: Date) => {
    console.log('User selected quick alarm time:', date);
    setQuickAlarmTime(date);
    setShowQuickTimePicker(false);
  };

  const handleQuickTimePickerCancel = () => {
    console.log('User cancelled quick alarm time picker');
    setShowQuickTimePicker(false);
  };

  const screenTitle = editingGoalId ? 'Edit Goal' : 'Create Goal';
  const submitButtonTitle = editingGoalId ? 'Update Goal' : 'Create Goal';
  const rewardActionText = getRewardActionText();
  const consequenceActionText = getConsequenceActionText();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: screenTitle,
            headerShown: true,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: screenTitle,
          headerShown: true,
        }}
      />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Goal Title */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Goal Title
            <Text style={styles.required}> *</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter goal title"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter goal description"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Parent Goal */}
        <View style={styles.section}>
          <Text style={styles.label}>Parent Goal</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowParentGoalPicker(true)}
          >
            <Text style={styles.pickerText}>{getSelectedParentGoalName()}</Text>
            <IconSymbol
              ios_icon_name="chevron.down"
              android_material_icon_name="arrow-drop-down"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>

        {/* Life Area */}
        <View style={styles.section}>
          <Text style={styles.label}>Life Area</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowLifeAreaPicker(true)}
          >
            <Text style={styles.pickerText}>{getSelectedLifeAreaName()}</Text>
            <IconSymbol
              ios_icon_name="chevron.down"
              android_material_icon_name="arrow-drop-down"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>

        {/* Behaviour Categories */}
        {userPreferences.reflectionCategoriesEnabled !== false && (
          <View style={styles.section}>
            <Text style={styles.label}>
              Behaviour Categories
              <Text style={styles.required}> *</Text>
            </Text>
            <Text style={styles.helperText}>
              Select which behaviour categories apply to this goal
            </Text>
            <View style={styles.checkboxGroup}>
              {(userPreferences.reflectionCategories || ['Action', 'Speech', 'Thought']).map((category) => {
                const isSelected = behaviorCategories.includes(category as BehaviorCategory);
                const getCategoryIcon = (cat: string) => {
                  const categoryLower = cat.toLowerCase();
                  if (categoryLower === 'action') return { ios: 'figure.walk', android: 'directions-run' };
                  if (categoryLower === 'speech') return { ios: 'bubble.left.fill', android: 'chat-bubble' };
                  if (categoryLower === 'thought') return { ios: 'brain.head.profile', android: 'psychology' };
                  if (categoryLower === 'feeling') return { ios: 'heart.fill', android: 'favorite' };
                  return { ios: 'sparkles', android: 'auto-awesome' };
                };
                const categoryIcon = getCategoryIcon(category);
                
                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.checkbox, isSelected && styles.checkboxSelected]}
                    onPress={() => toggleBehaviorCategory(category as BehaviorCategory)}
                  >
                    <IconSymbol
                      ios_icon_name={categoryIcon.ios}
                      android_material_icon_name={categoryIcon.android}
                      size={16}
                      color={isSelected ? '#fff' : colors.primary}
                    />
                    <Text style={[styles.checkboxText, isSelected && styles.checkboxTextSelected]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.radioGroup}>
            {(['Proactive', 'Restraining'] as GoalType[]).map((goalType) => {
              const isSelected = type === goalType;
              const label = goalType === 'Proactive' ? 'Proactive (do)' : 'Restraining (avoid)';
              return (
                <TouchableOpacity
                  key={goalType}
                  style={[styles.radio, isSelected && styles.radioSelected]}
                  onPress={() => setType(goalType)}
                >
                  <View style={styles.radioCircle}>
                    {isSelected && <View style={styles.radioCircleInner} />}
                  </View>
                  <Text style={styles.radioText}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Strategies */}
        <View style={styles.section}>
          <Text style={styles.label}>Strategies</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowStrategyPicker(true)}
          >
            <Text style={styles.pickerText}>
              {strategyIds.length > 0 ? `${strategyIds.length} selected` : 'Select Strategies'}
            </Text>
            <IconSymbol
              ios_icon_name="chevron.down"
              android_material_icon_name="arrow-drop-down"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>

        {/* Goal Schedule - NEW WIZARD */}
        <View style={styles.section}>
          <Text style={styles.label}>Goal Schedule</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowScheduleWizard(true)}
          >
            <View style={styles.schedulePickerContent}>
              <View>
                <Text style={styles.pickerText}>{scheduleConfig.scheduleType}</Text>
                {scheduleConfig.scheduleType !== 'Always Active' && (
                  <Text style={styles.scheduleSubtext}>
                    {scheduleConfig.timesPerDay ? `${scheduleConfig.timesPerDay}x per day` : ''}
                    {scheduleConfig.weekdays && scheduleConfig.weekdays.length > 0 ? ` ${scheduleConfig.weekdays.length} days selected` : ''}
                  </Text>
                )}
              </View>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={24}
                color={colors.text}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Alarms & Reminders - FIXED: Now uses react-native-modal-datetime-picker for cross-platform consistency */}
        <View style={styles.section}>
          <View style={styles.alarmHeader}>
            <View style={styles.alarmTitleRow}>
              <IconSymbol
                ios_icon_name="bell.fill"
                android_material_icon_name="notifications"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.label}>Alarms</Text>
            </View>
            <Switch
              value={alarmsEnabled}
              onValueChange={setAlarmsEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
          
          {alarmsEnabled && (
            <View style={styles.alarmContent}>
              <Text style={styles.helperText}>
                Quick alarm: Set a simple alarm time based on your goal schedule ({getScheduleDescription()})
              </Text>
              
              {/* Quick Time Input - FIXED: Now uses react-native-modal-datetime-picker */}
              <View style={styles.quickTimeSection}>
                <Text style={styles.quickTimeLabel}>Alarm Time:</Text>
                <TouchableOpacity
                  style={styles.quickTimeButton}
                  onPress={() => {
                    console.log('User tapped Set time button - showing time picker modal');
                    setShowQuickTimePicker(true);
                  }}
                  activeOpacity={0.7}
                >
                  <IconSymbol
                    ios_icon_name="clock"
                    android_material_icon_name="schedule"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.quickTimeText}>
                    {quickAlarmTime ? formatTime12Hour(quickAlarmTime) : 'Set time'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Advanced Button */}
              <TouchableOpacity
                style={styles.advancedAlarmsButton}
                onPress={handleAdvancedAlarms}
              >
                <IconSymbol
                  ios_icon_name="slider.horizontal.3"
                  android_material_icon_name="tune"
                  size={18}
                  color={colors.primary}
                />
                <Text style={styles.advancedAlarmsButtonText}>Advanced Alarms</Text>
              </TouchableOpacity>

              {/* List of Alarms for this Goal */}
              {goalAlarms.length > 0 && (
                <View style={styles.alarmsList}>
                  <Text style={styles.alarmsListTitle}>Alarms for this Goal:</Text>
                  {goalAlarms.map((alarm) => {
                    const alarmEnabled = alarm.enabled;
                    return (
                      <View key={alarm.id} style={styles.alarmItem}>
                        <View style={styles.alarmItemLeft}>
                          <IconSymbol
                            ios_icon_name={alarmEnabled ? 'bell.fill' : 'bell.slash'}
                            android_material_icon_name={alarmEnabled ? 'notifications' : 'notifications-off'}
                            size={20}
                            color={alarmEnabled ? '#4CAF50' : colors.textSecondary}
                          />
                          <View style={styles.alarmItemInfo}>
                            <Text style={styles.alarmItemTitle}>{alarm.title}</Text>
                            <Text style={[styles.alarmItemStatus, alarmEnabled && styles.alarmItemStatusActive]}>
                              {alarmEnabled ? 'Active' : 'Inactive'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.alarmItemActions}>
                          <TouchableOpacity onPress={() => handleToggleAlarm(alarm.id, alarmEnabled)}>
                            <IconSymbol
                              ios_icon_name={alarmEnabled ? 'pause.circle' : 'play.circle'}
                              android_material_icon_name={alarmEnabled ? 'pause-circle' : 'play-circle'}
                              size={20}
                              color={colors.primary}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleEditAlarm(alarm.id)}>
                            <IconSymbol
                              ios_icon_name="pencil"
                              android_material_icon_name="edit"
                              size={20}
                              color={colors.primary}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteAlarm(alarm.id, alarm.title)}>
                            <IconSymbol
                              ios_icon_name="trash"
                              android_material_icon_name="delete"
                              size={20}
                              color={colors.error}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Rewards */}
        <View style={styles.section}>
          <Text style={styles.label}>Rewards</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowRewardCurrencyPicker(true)}
          >
            <Text style={styles.pickerText}>{getSelectedCurrencyName(rewardCurrencyId)}</Text>
            <IconSymbol
              ios_icon_name="chevron.down"
              android_material_icon_name="arrow-drop-down"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          
          {rewardCurrencyId && (
            <View style={styles.rewardInputs}>
              <View style={styles.rewardInputGroup}>
                <Text style={styles.subLabel}>After</Text>
                <TextInput
                  style={styles.smallInput}
                  value={rewardSuccesses}
                  onChangeText={setRewardSuccesses}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
                <Text style={styles.subLabel}>successes, {rewardActionText}</Text>
                <TextInput
                  style={styles.smallInput}
                  value={rewardAmount}
                  onChangeText={setRewardAmount}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
                <Text style={styles.subLabel}>
                  {currencies.find(c => c.id === rewardCurrencyId)?.symbol || ''}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Consequences */}
        <View style={styles.section}>
          <Text style={styles.label}>Consequences</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowConsequenceCurrencyPicker(true)}
          >
            <Text style={styles.pickerText}>{getSelectedCurrencyName(consequenceCurrencyId)}</Text>
            <IconSymbol
              ios_icon_name="chevron.down"
              android_material_icon_name="arrow-drop-down"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          
          {consequenceCurrencyId && (
            <View style={styles.rewardInputs}>
              <View style={styles.rewardInputGroup}>
                <Text style={styles.subLabel}>After</Text>
                <TextInput
                  style={styles.smallInput}
                  value={consequenceFailures}
                  onChangeText={setConsequenceFailures}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
                <Text style={styles.subLabel}>failures, {consequenceActionText}</Text>
                <TextInput
                  style={styles.smallInput}
                  value={consequenceAmount}
                  onChangeText={setConsequenceAmount}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
                <Text style={styles.subLabel}>
                  {currencies.find(c => c.id === consequenceCurrencyId)?.symbol || ''}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Submit Button */}
        <View style={styles.buttonContainer}>
          <LoadingButton
            title={submitButtonTitle}
            onPress={handleSubmit}
            loading={submitting}
            style={styles.submitButton}
          />
        </View>
      </ScrollView>

      {/* Quick Time Picker - FIXED: Uses react-native-modal-datetime-picker for cross-platform consistency */}
      <DateTimePickerModal
        isVisible={showQuickTimePicker}
        mode="time"
        onConfirm={handleQuickTimePickerConfirm}
        onCancel={handleQuickTimePickerCancel}
        date={quickAlarmTime || (() => {
          const now = new Date();
          now.setHours(9, 0, 0, 0);
          return now;
        })()}
        display={Platform.OS === 'android' ? 'default' : 'spinner'}
      />

      {/* Goal Schedule Wizard Modal */}
      <Modal
        visible={showScheduleWizard}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScheduleWizard(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.wizardModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Goal Schedule</Text>
              <TouchableOpacity onPress={() => setShowScheduleWizard(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.wizardScroll} contentContainerStyle={styles.wizardContent}>
              <GoalScheduler
                config={scheduleConfig}
                onChange={setScheduleConfig}
                alternativeCalendar={userPreferences.alternativeCalendar}
              />
            </ScrollView>
            <View style={styles.wizardFooter}>
              <TouchableOpacity
                style={styles.wizardDoneButton}
                onPress={() => setShowScheduleWizard(false)}
              >
                <Text style={styles.wizardDoneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Parent Goal Picker Modal */}
      <Modal
        visible={showParentGoalPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowParentGoalPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Parent Goal</Text>
              <TouchableOpacity onPress={() => setShowParentGoalPicker(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <TouchableOpacity
                style={[styles.pickerItem, !parentGoalId && styles.pickerItemSelected]}
                onPress={() => {
                  setParentGoalId(undefined);
                  setShowParentGoalPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, !parentGoalId && styles.pickerItemTextSelected]}>
                  None
                </Text>
              </TouchableOpacity>
              {goals.map((goal) => {
                const isSelected = goal.id === parentGoalId;
                return (
                  <TouchableOpacity
                    key={goal.id}
                    style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                    onPress={() => {
                      setParentGoalId(goal.id);
                      setShowParentGoalPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                      {goal.title}
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

      {/* Life Area Picker Modal */}
      <Modal
        visible={showLifeAreaPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLifeAreaPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Life Area</Text>
              <TouchableOpacity onPress={() => setShowLifeAreaPicker(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <TouchableOpacity
                style={[styles.pickerItem, !lifeAreaId && styles.pickerItemSelected]}
                onPress={() => {
                  setLifeAreaId(undefined);
                  setShowLifeAreaPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, !lifeAreaId && styles.pickerItemTextSelected]}>
                  None
                </Text>
              </TouchableOpacity>
              {renderLifeAreaHierarchy(lifeAreas)}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Strategy Picker Modal */}
      <Modal
        visible={showStrategyPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStrategyPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Strategies</Text>
              <TouchableOpacity onPress={() => setShowStrategyPicker(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {strategies.map((strategy) => {
                const isSelected = strategyIds.includes(strategy.id);
                return (
                  <TouchableOpacity
                    key={strategy.id}
                    style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                    onPress={() => toggleStrategy(strategy.id)}
                  >
                    <View style={styles.strategyItem}>
                      <View>
                        <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                          {strategy.name}
                        </Text>
                        {strategy.description && (
                          <Text style={styles.strategyDescription}>{strategy.description}</Text>
                        )}
                      </View>
                      {isSelected && (
                        <IconSymbol
                          ios_icon_name="checkmark"
                          android_material_icon_name="check"
                          size={20}
                          color={colors.primary}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reward Currency Picker Modal */}
      <Modal
        visible={showRewardCurrencyPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRewardCurrencyPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Reward Currency</Text>
              <TouchableOpacity onPress={() => setShowRewardCurrencyPicker(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <TouchableOpacity
                style={[styles.pickerItem, !rewardCurrencyId && styles.pickerItemSelected]}
                onPress={() => {
                  setRewardCurrencyId(undefined);
                  setRewardSuccesses('');
                  setRewardAmount('');
                  setShowRewardCurrencyPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, !rewardCurrencyId && styles.pickerItemTextSelected]}>
                  None
                </Text>
              </TouchableOpacity>
              {currencies.map((currency) => {
                const isSelected = currency.id === rewardCurrencyId;
                const displayText = currency.symbol ? `${currency.name} (${currency.symbol})` : currency.name;
                return (
                  <TouchableOpacity
                    key={currency.id}
                    style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                    onPress={() => {
                      setRewardCurrencyId(currency.id);
                      setShowRewardCurrencyPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                      {displayText}
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

      {/* Consequence Currency Picker Modal */}
      <Modal
        visible={showConsequenceCurrencyPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConsequenceCurrencyPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Consequence Currency</Text>
              <TouchableOpacity onPress={() => setShowConsequenceCurrencyPicker(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <TouchableOpacity
                style={[styles.pickerItem, !consequenceCurrencyId && styles.pickerItemSelected]}
                onPress={() => {
                  setConsequenceCurrencyId(undefined);
                  setConsequenceFailures('');
                  setConsequenceAmount('');
                  setShowConsequenceCurrencyPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, !consequenceCurrencyId && styles.pickerItemTextSelected]}>
                  None
                </Text>
              </TouchableOpacity>
              {currencies.map((currency) => {
                const isSelected = currency.id === consequenceCurrencyId;
                const displayText = currency.symbol ? `${currency.name} (${currency.symbol})` : currency.name;
                return (
                  <TouchableOpacity
                    key={currency.id}
                    style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                    onPress={() => {
                      setConsequenceCurrencyId(currency.id);
                      setShowConsequenceCurrencyPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                      {displayText}
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

      {/* Success/Error Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModal}>
            <Text style={styles.alertTitle}>{modalTitle}</Text>
            <Text style={styles.alertMessage}>{modalMessage}</Text>
            <TouchableOpacity
              style={[styles.alertButton, modalType === 'error' && styles.alertButtonError]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Another Goal Prompt */}
      <Modal
        visible={showCreateAnotherPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateAnotherPrompt(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModal}>
            <Text style={styles.alertTitle}>Create Another Goal?</Text>
            <Text style={styles.alertMessage}>
              Would you like to create another goal for this Life Area?
            </Text>
            <View style={styles.promptButtons}>
              <TouchableOpacity
                style={[styles.alertButton, styles.alertButtonSecondary]}
                onPress={() => {
                  setShowCreateAnotherPrompt(false);
                  router.push(`/life-area-wizard?id=${wizardLifeAreaId}&step=2&newGoalCreated=true`);
                }}
              >
                <Text style={styles.alertButtonSecondaryText}>No, Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={() => {
                  setShowCreateAnotherPrompt(false);
                  setTitle('');
                  setDescription('');
                  setParentGoalId(undefined);
                  setBehaviorCategories([]);
                  setType('Proactive');
                  setStrategyIds([]);
                  setScheduleConfig({ scheduleType: 'Always Active' });
                  setRewardCurrencyId(undefined);
                  setRewardSuccesses('');
                  setRewardAmount('');
                  setConsequenceCurrencyId(undefined);
                  setConsequenceFailures('');
                  setConsequenceAmount('');
                  setAlarmsEnabled(false);
                }}
              >
                <Text style={styles.alertButtonText}>Yes, Create Another</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Alarm Confirmation Modal */}
      <ConfirmModal
        visible={showDeleteAlarmConfirm}
        title="Delete Alarm?"
        message={`Are you sure you want to delete "${alarmToDelete?.title}"? This action cannot be undone.`}
        onConfirm={confirmDeleteAlarm}
        onCancel={() => {
          setShowDeleteAlarmConfirm(false);
          setAlarmToDelete(null);
        }}
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
      />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  required: {
    color: '#ff4444',
  },
  helperText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  picker: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  schedulePickerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  scheduleSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  checkboxGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxText: {
    fontSize: 14,
    color: colors.text,
  },
  checkboxTextSelected: {
    color: '#fff',
  },
  radioGroup: {
    gap: 12,
  },
  radio: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  radioSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  radioText: {
    fontSize: 16,
    color: colors.text,
  },
  subLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  rewardInputs: {
    marginTop: 12,
  },
  rewardInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallInput: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    width: 80,
    textAlign: 'center',
  },
  alarmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alarmTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alarmContent: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  quickTimeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  quickTimeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  quickTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 130,
  },
  quickTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  quickTimeInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    minWidth: 100,
  },
  advancedAlarmsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  advancedAlarmsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  alarmsList: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  alarmsListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  alarmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alarmItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  alarmItemInfo: {
    flex: 1,
  },
  alarmItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  alarmItemStatus: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  alarmItemStatusActive: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  alarmItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  buttonContainer: {
    marginTop: 20,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
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
    maxHeight: '80%',
  },
  wizardModal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    height: '90%',
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
    maxHeight: 400,
  },
  wizardScroll: {
    flex: 1,
  },
  wizardContent: {
    padding: 20,
  },
  wizardFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  wizardDoneButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  wizardDoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
  strategyItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strategyDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  alertModal: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 24,
    margin: 20,
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  alertMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  alertButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  alertButtonError: {
    backgroundColor: '#ff4444',
  },
  alertButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  promptButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  alertButtonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alertButtonSecondaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  strategyItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strategyDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
