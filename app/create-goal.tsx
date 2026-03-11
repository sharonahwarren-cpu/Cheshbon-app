
import { ConfirmModal } from '@/components/ConfirmModal';
import { LoadingButton } from '@/components/LoadingButton';
import { getLocalTimezone } from '@/utils/dateUtils';
import { colors } from '@/styles/commonStyles';
import React, { useState, useEffect } from 'react';
import { IconSymbol } from '@/components/IconSymbol';
import { DateTime } from 'luxon';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { GoalScheduler, type ScheduleConfig } from '@/components/GoalScheduler';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { DatePickerModal } from '@/components/DatePickerModal';
import * as supabaseApi from '@/utils/supabaseApi';

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
type TrackingType = 'once_per_day' | 'tally';

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
  
  // NEW: Tracking type state
  const [trackingType, setTrackingType] = useState<TrackingType>('once_per_day');
  
  // NEW: Goal Scheduler state - DEFAULT TO "Always Active"
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    scheduleType: 'Always Active',
  });
  
  // Alarms state - FIXED: Use Date object and DatePickerModal for cross-platform consistency
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

  // Schedule summary from backend
  const [scheduleSummaryText, setScheduleSummaryText] = useState<string>('');
  const [loadingScheduleSummary, setLoadingScheduleSummary] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showParentGoalPicker, setShowParentGoalPicker] = useState(false);
  const [showLifeAreaPicker, setShowLifeAreaPicker] = useState(false);
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);
  const [showRewardCurrencyPicker, setShowRewardCurrencyPicker] = useState(false);
  const [showConsequenceCurrencyPicker, setShowConsequenceCurrencyPicker] = useState(false);
  const [showScheduleWizard, setShowScheduleWizard] = useState(false);
  
  // NEW: Create item modals
  const [showCreateLifeAreaModal, setShowCreateLifeAreaModal] = useState(false);
  const [showCreateStrategyModal, setShowCreateStrategyModal] = useState(false);
  const [showCreateCurrencyModal, setShowCreateCurrencyModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newCurrencySymbol, setNewCurrencySymbol] = useState('');
  const [newCurrencyType, setNewCurrencyType] = useState<'reward' | 'consequence'>('consequence');
  const [newCurrencyOnSuccess, setNewCurrencyOnSuccess] = useState<'ADD' | 'SUBTRACT' | 'NONE'>('NONE');
  const [newCurrencyOnFailure, setNewCurrencyOnFailure] = useState<'ADD' | 'SUBTRACT' | 'NONE'>('NONE');
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    console.log('[CreateGoal] Component mounted, loading data...');
    loadData();
  }, []);

  // Fetch backend schedule summary when editing a goal and schedule type changes.
  useEffect(() => {
    if (editingGoalId && scheduleConfig.scheduleType !== 'Always Active') {
      fetchScheduleSummary();
    } else {
      setScheduleSummaryText('');
    }
  }, [editingGoalId, scheduleConfig.scheduleType]);

  const fetchScheduleSummary = async () => {
    if (!editingGoalId) return;
    console.log('[CreateGoal] Fetching fresh schedule summary for goal:', editingGoalId);
    setLoadingScheduleSummary(true);
    try {
      // Note: Schedule summary generation is not yet implemented in Supabase
      // This would need to be added as an Edge Function or RPC call
      console.log('[CreateGoal] Schedule summary not yet implemented with Supabase');
      setScheduleSummaryText('');
    } catch (error: any) {
      console.error('[CreateGoal] Error fetching schedule summary:', error);
      setScheduleSummaryText('');
    } finally {
      setLoadingScheduleSummary(false);
    }
  };

  // Reload alarms when returning from create alarm screen
  const reloadGoalAlarms = React.useCallback(async () => {
    if (!editingGoalId) return;
    
    try {
      console.log('[CreateGoal] Reloading alarms on focus for goal:', editingGoalId);
      const [goal, allAlarms] = await Promise.all([
        supabaseApi.getGoalById(editingGoalId),
        supabaseApi.getAlarms(),
      ]);
      
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
      
      // CRITICAL: Reload data when returning from Settings screen after creating Life Area/Strategy/Currency
      if (!editingGoalId && !loading) {
        console.log('[CreateGoal] Reloading data on focus (user may have created items in Settings)');
        loadData();
      }
    }, [editingGoalId, loading, reloadGoalAlarms])
  );

  const loadData = async () => {
    console.log('[CreateGoal] Loading form data for goal creation/editing');
    setLoading(true);
    try {
      const promises = [
        supabaseApi.getGoals().catch(err => {
          console.error('[CreateGoal] Error loading goals:', err);
          return [];
        }),
        supabaseApi.getLifeAreas().catch(err => {
          console.error('[CreateGoal] Error loading life areas:', err);
          return [];
        }),
        supabaseApi.getStrategies().catch(err => {
          console.error('[CreateGoal] Error loading strategies:', err);
          return [];
        }),
        supabaseApi.getCurrencies().catch(err => {
          console.error('[CreateGoal] Error loading currencies:', err);
          return [];
        }),
        supabaseApi.getUserPreferences().catch(err => {
          console.error('[CreateGoal] Error loading preferences:', err);
          return {
            reflectionCategoriesEnabled: true,
            reflectionCategories: ['Action', 'Speech', 'Thought'],
            alternativeCalendar: 'gregorian',
          };
        }),
      ];

      if (editingGoalId) {
        promises.push(
          supabaseApi.getGoalById(editingGoalId).catch(err => {
            console.error('[CreateGoal] Error loading goal details:', err);
            return null;
          })
        );
        promises.push(
          supabaseApi.getAlarms().catch(err => {
            console.error('[CreateGoal] Error loading alarms:', err);
            return [];
          })
        );
      }

      const results = await Promise.all(promises);
      const [goalsData, lifeAreasData, strategiesData, currenciesData, preferencesData, goalDetailsData, allAlarmsData] = results;
      
      console.log('[CreateGoal] Data loaded successfully');
      console.log('[CreateGoal] Goals:', goalsData.length);
      console.log('[CreateGoal] Life Areas:', lifeAreasData.length);
      console.log('[CreateGoal] Strategies:', strategiesData.length);
      console.log('[CreateGoal] Currencies:', currenciesData.length);
      
      const preferences = preferencesData || {
        reflectionCategoriesEnabled: true,
        reflectionCategories: ['Action', 'Speech', 'Thought'],
        alternativeCalendar: 'gregorian',
      };
      
      if (preferences.reflectionCategories && typeof preferences.reflectionCategories === 'string') {
        try {
          preferences.reflectionCategories = JSON.parse(preferences.reflectionCategories);
        } catch (e) {
          console.error('[CreateGoal] Failed to parse reflectionCategories:', e);
          preferences.reflectionCategories = ['Action', 'Speech', 'Thought'];
        }
      }
      
      console.log('[CreateGoal] User preferences loaded:', preferences);
      console.log('[CreateGoal] Reflection categories enabled:', preferences.reflectionCategoriesEnabled);
      console.log('[CreateGoal] Available categories:', preferences.reflectionCategories);
      
      setGoals(goalsData);
      setLifeAreas(lifeAreasData);
      setStrategies(strategiesData);
      setCurrencies(currenciesData);
      setUserPreferences(preferences);

      if (preselectedLifeAreaId && !editingGoalId) {
        console.log('[CreateGoal] Pre-selecting life area:', preselectedLifeAreaId);
        setLifeAreaId(preselectedLifeAreaId);
      }

      if (editingGoalId && goalDetailsData) {
        const goalDetails = goalDetailsData;
        console.log('[CreateGoal] Goal details loaded for editing:', JSON.stringify(goalDetails, null, 2));
        
        setTitle(goalDetails.title || '');
        setDescription(goalDetails.description || '');
        setParentGoalId(goalDetails.parent_goal_id);
        setLifeAreaId(goalDetails.life_area_id);
        setBehaviorCategories(goalDetails.behavior_categories || []);
        setType(goalDetails.type || 'Proactive');
        setStrategyIds(goalDetails.strategy_ids || []);
        
        // Load tracking type
        setTrackingType(goalDetails.tracking_type || 'once_per_day');
        
        // Load schedule config - Supabase stores it as a JSONB field
        const scheduleConfigFromDb = goalDetails.schedule_config;
        if (scheduleConfigFromDb) {
          setScheduleConfig(scheduleConfigFromDb);
        }
        
        // Load reward/consequence data
        if (goalDetails.reward_currency_id) {
          setRewardCurrencyId(goalDetails.reward_currency_id);
          setRewardSuccesses(goalDetails.reward_successes?.toString() || '');
          setRewardAmount(goalDetails.reward_amount?.toString() || '');
        }
        
        if (goalDetails.consequence_currency_id) {
          setConsequenceCurrencyId(goalDetails.consequence_currency_id);
          setConsequenceFailures(goalDetails.consequence_failures?.toString() || '');
          setConsequenceAmount(goalDetails.consequence_amount?.toString() || '');
        }

        // Load alarms for this goal
        if (allAlarmsData) {
          const goalAlarmsField = goalDetails.alarms;
          let goalAlarmIds: string[] = [];
          
          if (goalAlarmsField) {
            const parsedAlarms = typeof goalAlarmsField === 'string' 
              ? JSON.parse(goalAlarmsField) 
              : goalAlarmsField;
            
            if (Array.isArray(parsedAlarms)) {
              goalAlarmIds = parsedAlarms.map((a: any) => 
                typeof a === 'string' ? a : a.id
              ).filter(Boolean);
            }
          }
          
          console.log('[CreateGoal] Goal alarm IDs from goal record:', goalAlarmIds);
          
          const filteredAlarms = goalAlarmIds.length > 0
            ? allAlarmsData.filter((alarm: any) => goalAlarmIds.includes(alarm.id))
            : [];
          
          console.log('[CreateGoal] Filtered alarms for goal:', filteredAlarms.length);
          setGoalAlarms(filteredAlarms);
          if (filteredAlarms.length > 0) {
            setAlarmsEnabled(true);
          }
        }
      }
    } catch (error: any) {
      console.error('[CreateGoal] Error loading form data:', error);
      showError(error.message || 'Failed to load form data');
    } finally {
      console.log('[CreateGoal] Loading complete');
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
    console.log('[CreateGoal]', editingGoalId ? 'Submitting goal update form' : 'Submitting goal creation form');
    
    if (!title.trim()) {
      showError('Goal title is required');
      return;
    }

    // CRITICAL FIX: Validate that Type is selected
    if (!type) {
      showError('Please select a goal type (Proactive or Restraining)');
      return;
    }

    const categoriesEnabled = userPreferences.reflectionCategoriesEnabled !== false;
    if (categoriesEnabled && behaviorCategories.length === 0) {
      showError('Please select at least one behaviour category');
      return;
    }

    setSubmitting(true);
    try {
      // CRITICAL FIX: Build the goal data object with ONLY snake_case fields
      // Supabase expects snake_case column names
      const goalData: any = {
        title: title.trim(),
        description: description.trim() || null,
        parent_goal_id: parentGoalId || null,
        life_area_id: lifeAreaId || null,
        behavior_categories: behaviorCategories.length > 0 ? behaviorCategories : null,
        type: type.toUpperCase(), // Ensure uppercase for database enum
        strategy_ids: strategyIds.length > 0 ? strategyIds : null,
        schedule_config: scheduleConfig, // Store entire schedule config as JSONB
        tracking_type: trackingType, // NEW: Store tracking type
      };
      
      console.log('[CreateGoal] Submitting goal data:', JSON.stringify(goalData, null, 2));

      // CRITICAL FIX: Handle reward/consequence data with proper snake_case field names
      if (rewardCurrencyId && rewardSuccesses && rewardAmount) {
        goalData.reward_currency_id = rewardCurrencyId;
        goalData.reward_successes = parseInt(rewardSuccesses, 10);
        goalData.reward_amount = parseInt(rewardAmount, 10);
        console.log('[CreateGoal] Setting reward data:', { 
          reward_currency_id: rewardCurrencyId, 
          reward_successes: parseInt(rewardSuccesses, 10), 
          reward_amount: parseInt(rewardAmount, 10) 
        });
      } else {
        goalData.reward_currency_id = null;
        goalData.reward_successes = null;
        goalData.reward_amount = null;
        console.log('[CreateGoal] Clearing reward data');
      }

      if (consequenceCurrencyId && consequenceFailures && consequenceAmount) {
        goalData.consequence_currency_id = consequenceCurrencyId;
        goalData.consequence_failures = parseInt(consequenceFailures, 10);
        goalData.consequence_amount = parseInt(consequenceAmount, 10);
        console.log('[CreateGoal] Setting consequence data:', { 
          consequence_currency_id: consequenceCurrencyId, 
          consequence_failures: parseInt(consequenceFailures, 10), 
          consequence_amount: parseInt(consequenceAmount, 10) 
        });
      } else {
        goalData.consequence_currency_id = null;
        goalData.consequence_failures = null;
        goalData.consequence_amount = null;
        console.log('[CreateGoal] Clearing consequence data');
      }

      let createdOrUpdatedGoal: any;
      
      if (editingGoalId) {
        console.log('[CreateGoal] Updating goal:', editingGoalId);
        
        // Include alarms field when editing a goal
        if (goalAlarms.length > 0) {
          goalData.alarms = goalAlarms.map(alarm => ({ id: alarm.id }));
          console.log('[API] Including alarms in goal update:', goalData.alarms);
        }
        
        createdOrUpdatedGoal = await supabaseApi.updateGoal(editingGoalId, goalData);
        console.log('[CreateGoal] Goal updated successfully:', createdOrUpdatedGoal?.id);
        showSuccess('Goal updated successfully!');
      } else {
        console.log('[CreateGoal] Creating goal with Supabase');
        createdOrUpdatedGoal = await supabaseApi.createGoal(goalData);
        console.log('[CreateGoal] Goal created successfully:', createdOrUpdatedGoal?.id);
        
        if (preselectedLifeAreaId && createdOrUpdatedGoal) {
          const goalId = createdOrUpdatedGoal.id;
          if (goalId) {
            try {
              // Link goal to life area by updating the goal's life_area_id
              await supabaseApi.updateGoal(goalId, { life_area_id: preselectedLifeAreaId });
            } catch (linkError) {
              console.error('[API] Error linking goal to life area:', linkError);
            }
          }
        }
        
        showSuccess('Goal created successfully!');
      }
      
      console.log('[CreateGoal] Goal submission completed successfully');
      
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
          // CRITICAL: Navigate to settings with refresh parameter to ensure goals list updates
          router.push('/(tabs)/settings?section=goals&refresh=true');
        } else {
          router.back();
        }
      }, 1500);
    } catch (error: any) {
      console.error('[CreateGoal] Error saving goal:', error.message);
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
      await supabaseApi.updateAlarm(alarmId, { enabled: !currentEnabled });
      
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
      await supabaseApi.deleteAlarm(alarmToDelete.id);
      
      // Update local state
      const updatedAlarms = goalAlarms.filter(alarm => alarm.id !== alarmToDelete.id);
      setGoalAlarms(updatedAlarms);
      
      // Update the goal's alarms field to remove this alarm ID
      if (editingGoalId) {
        const remainingAlarmIds = updatedAlarms.map(a => a.id);
        console.log('[API] Updating goal alarms field after deletion:', remainingAlarmIds);
        try {
          await supabaseApi.updateGoal(editingGoalId, {
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

  // NEW: Handle creating Life Area - Navigate to Life Area Wizard
  const handleCreateLifeArea = () => {
    console.log('[CreateGoal] Navigating to Life Area Wizard');
    setShowCreateLifeAreaModal(false);
    setNewItemName('');
    // Navigate to Life Area Wizard which has all the proper fields (icon, color, etc.)
    router.push('/life-area-wizard');
  };

  // NEW: Handle creating Strategy from modal
  const handleCreateStrategy = async () => {
    if (!newItemName.trim()) {
      showError('Please enter a name for the strategy');
      return;
    }

    try {
      setLoading(true);
      console.log('[CreateGoal] Creating strategy:', newItemName);
      const newStrategy = await supabaseApi.createStrategy({
        name: newItemName.trim(),
        description: newItemDescription.trim() || undefined,
      });
      
      console.log('[CreateGoal] Strategy created:', newStrategy);
      
      // Add to local state
      setStrategies([...strategies, newStrategy]);
      
      // Select the newly created strategy
      setStrategyIds([...strategyIds, newStrategy.id]);
      
      // Close modal and reset
      setShowCreateStrategyModal(false);
      setNewItemName('');
      setNewItemDescription('');
      
      showSuccess('Strategy created successfully!');
    } catch (error: any) {
      console.error('[CreateGoal] Error creating strategy:', error);
      showError(error.message || 'Failed to create strategy');
    } finally {
      setLoading(false);
    }
  };

  // NEW: Handle creating Currency from modal
  const handleCreateCurrency = async () => {
    if (!newItemName.trim()) {
      showError('Please enter a name for the currency');
      return;
    }

    try {
      setLoading(true);
      console.log('[CreateGoal] Creating currency:', newItemName);
      const newCurrency = await supabaseApi.createCurrency({
        name: newItemName.trim(),
        symbol: newCurrencySymbol.trim() || undefined,
        type: newCurrencyType,
        onSuccess: newCurrencyOnSuccess,
        onFailure: newCurrencyOnFailure,
      });
      
      console.log('[CreateGoal] Currency created:', newCurrency);
      
      // Add to local state
      setCurrencies([...currencies, newCurrency]);
      
      // Select the newly created currency based on context
      if (showRewardCurrencyPicker) {
        setRewardCurrencyId(newCurrency.id);
      } else if (showConsequenceCurrencyPicker) {
        setConsequenceCurrencyId(newCurrency.id);
      }
      
      // Close modal and reset
      setShowCreateCurrencyModal(false);
      setNewItemName('');
      setNewCurrencySymbol('');
      setNewCurrencyType('consequence');
      setNewCurrencyOnSuccess('NONE');
      setNewCurrencyOnFailure('NONE');
      
      showSuccess('Currency created successfully!');
    } catch (error: any) {
      console.error('[CreateGoal] Error creating currency:', error);
      showError(error.message || 'Failed to create currency');
    } finally {
      setLoading(false);
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
    } else if (scheduleType === 'Weekly') {
      const weekdays = scheduleConfig.weekdays || [];
      if (weekdays.length === 0) return 'weekly';
      if (weekdays.length === 7) return 'every day';
      
      const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayNames = weekdays.map(day => WEEKDAY_NAMES[day]).filter(name => name !== undefined);
      
      if (dayNames.length === 1) {
        return `every ${dayNames[0]}`;
      } else if (dayNames.length === 2) {
        return `every ${dayNames[0]} and ${dayNames[1]}`;
      } else {
        const lastDay = dayNames.pop();
        return `every ${dayNames.join(', ')}, and ${lastDay}`;
      }
    } else if (scheduleType === 'Fortnightly') {
      return 'fortnightly';
    } else if (scheduleType === 'Monthly') {
      return 'monthly';
    } else if (scheduleType === 'Yearly') {
      return 'yearly';
    }
    return scheduleType.toLowerCase();
  };

  // FIXED: Handler for DatePickerModal
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
  
  // CRITICAL: Filter behavior categories based on user preferences
  const categoriesEnabled = userPreferences.reflectionCategoriesEnabled !== false;
  const availableCategories = categoriesEnabled 
    ? (userPreferences.reflectionCategories || ['Action', 'Speech', 'Thought'])
    : [];

  if (loading && !editingGoalId) {
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
          <Text style={styles.loadingText}>Loading...</Text>
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
        
        {/* NEW: Tracking Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Tracking Type</Text>
          <Text style={styles.helperText}>
            Choose how you want to track this goal each day
          </Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={[styles.radio, trackingType === 'once_per_day' && styles.radioSelected]}
              onPress={() => setTrackingType('once_per_day')}
            >
              <View style={styles.radioCircle}>
                {trackingType === 'once_per_day' && <View style={styles.radioCircleInner} />}
              </View>
              <View style={styles.radioTextContainer}>
                <Text style={styles.radioText}>Once per day</Text>
                <Text style={styles.radioSubtext}>Mark as success or struggle once</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.radio, trackingType === 'tally' && styles.radioSelected]}
              onPress={() => setTrackingType('tally')}
            >
              <View style={styles.radioCircle}>
                {trackingType === 'tally' && <View style={styles.radioCircleInner} />}
              </View>
              <View style={styles.radioTextContainer}>
                <Text style={styles.radioText}>Tally</Text>
                <Text style={styles.radioSubtext}>Keep count of successes and struggles</Text>
              </View>
            </TouchableOpacity>
          </View>
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

        {/* Behaviour Categories - CRITICAL: Only show enabled categories */}
        {categoriesEnabled && availableCategories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>
              Behaviour Categories
              <Text style={styles.required}> *</Text>
            </Text>
            <Text style={styles.helperText}>
              Select which behaviour categories apply to this goal
            </Text>
            <View style={styles.checkboxGroup}>
              {availableCategories.map((category) => {
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

        {/* Type - CRITICAL FIX: Made required */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Type
            <Text style={styles.required}> *</Text>
          </Text>
          <Text style={styles.helperText}>
            Choose whether this is a goal to do something (Proactive) or avoid something (Restraining)
          </Text>
          <View style={styles.radioGroup}>
            {(['Proactive', 'Restraining'] as GoalType[]).map((goalType) => {
              const isSelected = type === goalType;
              const label = goalType === 'Proactive' ? 'Proactive (do)' : 'Restraining (avoid)';
              return (
                <TouchableOpacity
                  key={goalType}
                  style={[styles.radio, isSelected && styles.radioSelected]}
                  onPress={() => {
                    console.log('[CreateGoal] User selected goal type:', goalType);
                    setType(goalType);
                  }}
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
            onPress={() => {
              setShowScheduleWizard(true);
            }}
          >
            <View style={styles.schedulePickerContent}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerText}>{scheduleConfig.scheduleType}</Text>
                {scheduleConfig.scheduleType !== 'Always Active' && scheduleSummaryText ? (
                  <Text style={styles.scheduleSubtext} numberOfLines={2}>
                    {scheduleSummaryText}
                  </Text>
                ) : scheduleConfig.scheduleType !== 'Always Active' && (
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

        {/* Alarms & Reminders - FIXED: Now uses DatePickerModal for cross-platform consistency */}
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
              
              {/* Quick Time Input - FIXED: Now uses DatePickerModal */}
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

      {/* Quick Time Picker - FIXED: Uses DatePickerModal for cross-platform consistency */}
      <DatePickerModal
        visible={showQuickTimePicker}
        value={quickAlarmTime || (() => {
          const now = new Date();
          now.setHours(9, 0, 0, 0);
          return now;
        })()}
        mode="time"
        onConfirm={handleQuickTimePickerConfirm}
        onCancel={handleQuickTimePickerCancel}
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
                goalId={editingGoalId}
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

      {/* Life Area Picker Modal - NEW: With Create button */}
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
              <TouchableOpacity
                style={styles.createNewButton}
                onPress={() => {
                  setShowLifeAreaPicker(false);
                  setShowCreateLifeAreaModal(true);
                }}
              >
                <IconSymbol
                  ios_icon_name="plus.circle.fill"
                  android_material_icon_name="add-circle"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.createNewText}>Create New Life Area</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Strategy Picker Modal - NEW: With Create button */}
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
              <TouchableOpacity
                style={styles.createNewButton}
                onPress={() => {
                  setShowStrategyPicker(false);
                  setShowCreateStrategyModal(true);
                }}
              >
                <IconSymbol
                  ios_icon_name="plus.circle.fill"
                  android_material_icon_name="add-circle"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.createNewText}>Create New Strategy</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reward Currency Picker Modal - NEW: With Create button */}
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
              <TouchableOpacity
                style={styles.createNewButton}
                onPress={() => {
                  setShowRewardCurrencyPicker(false);
                  setShowCreateCurrencyModal(true);
                }}
              >
                <IconSymbol
                  ios_icon_name="plus.circle.fill"
                  android_material_icon_name="add-circle"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.createNewText}>Create New Currency</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Consequence Currency Picker Modal - NEW: With Create button */}
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
              <TouchableOpacity
                style={styles.createNewButton}
                onPress={() => {
                  setShowConsequenceCurrencyPicker(false);
                  setShowCreateCurrencyModal(true);
                }}
              >
                <IconSymbol
                  ios_icon_name="plus.circle.fill"
                  android_material_icon_name="add-circle"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.createNewText}>Create New Currency</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* NEW: Create Life Area Modal */}
      <Modal
        visible={showCreateLifeAreaModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateLifeAreaModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.createItemModal}>
            <Text style={styles.alertTitle}>Create Life Area</Text>
            <Text style={styles.alertMessage}>
              You'll be taken to the Life Area Wizard where you can set the name, icon, color, and other properties.
            </Text>
            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={[styles.alertButton, styles.alertButtonSecondary]}
                onPress={() => {
                  setNewItemName('');
                  setShowCreateLifeAreaModal(false);
                }}
              >
                <Text style={styles.alertButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={handleCreateLifeArea}
              >
                <Text style={styles.alertButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* NEW: Create Strategy Modal */}
      <Modal
        visible={showCreateStrategyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateStrategyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.createItemModal}>
            <Text style={styles.alertTitle}>Create Strategy</Text>
            <TextInput
              style={styles.input}
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder="Strategy name..."
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <TextInput
              style={[styles.input, styles.textArea, { marginTop: 12 }]}
              value={newItemDescription}
              onChangeText={setNewItemDescription}
              placeholder="Description (optional)..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />
            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={[styles.alertButton, styles.alertButtonSecondary]}
                onPress={() => {
                  setNewItemName('');
                  setNewItemDescription('');
                  setShowCreateStrategyModal(false);
                }}
              >
                <Text style={styles.alertButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={handleCreateStrategy}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.alertButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* NEW: Create Currency Modal */}
      <Modal
        visible={showCreateCurrencyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateCurrencyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.createItemModal}>
            <Text style={styles.alertTitle}>Create Currency</Text>
            <TextInput
              style={styles.input}
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder="Currency name..."
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              value={newCurrencySymbol}
              onChangeText={setNewCurrencySymbol}
              placeholder="Symbol (e.g. $, ★, 🏆)..."
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={[styles.alertButton, styles.alertButtonSecondary]}
                onPress={() => {
                  setNewItemName('');
                  setNewCurrencySymbol('');
                  setNewCurrencyType('consequence');
                  setNewCurrencyOnSuccess('NONE');
                  setNewCurrencyOnFailure('NONE');
                  setShowCreateCurrencyModal(false);
                }}
              >
                <Text style={styles.alertButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={handleCreateCurrency}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.alertButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
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
                  setTrackingType('once_per_day');
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
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
  radioTextContainer: {
    flex: 1,
  },
  radioSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
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
  createNewButton: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  createNewText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  createItemModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    margin: 20,
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
  alertButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  alertButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
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
});
