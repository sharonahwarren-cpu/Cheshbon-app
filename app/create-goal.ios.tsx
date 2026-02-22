
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
  Switch,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { LoadingButton } from '@/components/LoadingButton';
import { authenticatedGet, authenticatedPost, authenticatedPut } from '@/utils/api';
import DateTimePicker from '@react-native-community/datetimepicker';

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
}

type BehaviorCategory = 'Action' | 'Speech' | 'Thought' | 'Feeling';
type GoalType = 'Restraining' | 'Proactive';
type ScheduleType = 'Always Active' | 'Daily' | 'Weekly' | 'Fortnightly' | 'Monthly' | 'Yearly';
type CalendarType = 'Gregorian' | 'Hebrew' | 'Chinese' | 'Islamic' | 'Persian';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEK_POSITIONS = ['First', 'Second', 'Third', 'Fourth', 'Last'];

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
  const [scheduleType, setScheduleType] = useState<ScheduleType>('Always Active');
  const [scheduleTimesPerDay, setScheduleTimesPerDay] = useState<string>('');
  
  // Advanced schedule state
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [monthlyType, setMonthlyType] = useState<'date' | 'weekday'>('date');
  const [monthlyDates, setMonthlyDates] = useState<number[]>([]);
  const [monthlyWeekdayRules, setMonthlyWeekdayRules] = useState<Array<{position: string; weekday: string}>>([]);
  const [yearlyDates, setYearlyDates] = useState<Array<{month: number; day: number}>>([]);
  const [calendarType, setCalendarType] = useState<CalendarType>('Gregorian');
  
  // Reward state
  const [rewardCurrencyId, setRewardCurrencyId] = useState<string | undefined>();
  const [rewardSuccesses, setRewardSuccesses] = useState<string>('');
  const [rewardAmount, setRewardAmount] = useState<string>('');
  
  // Consequence state
  const [consequenceCurrencyId, setConsequenceCurrencyId] = useState<string | undefined>();
  const [consequenceFailures, setConsequenceFailures] = useState<string>('');
  const [consequenceAmount, setConsequenceAmount] = useState<string>('');

  // Alarm state
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [alarmTime, setAlarmTime] = useState('09:00');
  const [alarmOffsetType, setAlarmOffsetType] = useState<'at' | 'before' | 'after'>('at');
  const [alarmOffsetMinutes, setAlarmOffsetMinutes] = useState<string>('');
  const [showAlarmTimePicker, setShowAlarmTimePicker] = useState(false);
  const [alarmTimeDate, setAlarmTimeDate] = useState(new Date());

  // Data from backend
  const [goals, setGoals] = useState<Goal[]>([]);
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    reflectionCategoriesEnabled: true,
    reflectionCategories: ['Action', 'Speech', 'Thought'],
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showParentGoalPicker, setShowParentGoalPicker] = useState(false);
  const [showLifeAreaPicker, setShowLifeAreaPicker] = useState(false);
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showRewardCurrencyPicker, setShowRewardCurrencyPicker] = useState(false);
  const [showConsequenceCurrencyPicker, setShowConsequenceCurrencyPicker] = useState(false);
  const [showWeekdayPicker, setShowWeekdayPicker] = useState(false);
  const [showMonthlyDatePicker, setShowMonthlyDatePicker] = useState(false);
  const [showMonthlyWeekdayPicker, setShowMonthlyWeekdayPicker] = useState(false);
  const [showYearlyDatePicker, setShowYearlyDatePicker] = useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    console.log('Loading form data for goal creation/editing');
    setLoading(true);
    try {
      // Load all data in parallel for better performance
      const promises = [
        authenticatedGet<any>('/api/goals'),
        authenticatedGet<any>('/api/life-areas'),
        authenticatedGet<any>('/api/strategies'),
        authenticatedGet<any>('/api/currencies'),
        authenticatedGet<any>('/api/user-preferences'),
      ];

      // If editing, also load the goal details
      if (editingGoalId) {
        promises.push(authenticatedGet<any>(`/api/goals/${editingGoalId}`));
      }

      const results = await Promise.all(promises);
      const [goalsData, lifeAreasData, strategiesData, currenciesData, preferencesData, goalDetailsData] = results;
      
      console.log('[API] Goals loaded:', goalsData);
      console.log('[API] Life areas loaded:', lifeAreasData);
      console.log('[API] Strategies loaded:', strategiesData);
      console.log('[API] Currencies loaded:', currenciesData);
      console.log('[API] User preferences loaded:', preferencesData);
      
      // Handle both direct array and { data: array } response formats
      const goals = Array.isArray(goalsData) ? goalsData : (goalsData?.data || []);
      const lifeAreas = Array.isArray(lifeAreasData) ? lifeAreasData : (lifeAreasData?.data || []);
      const strategies = Array.isArray(strategiesData) ? strategiesData : (strategiesData?.data || []);
      const currencies = Array.isArray(currenciesData) ? currenciesData : (currenciesData?.data || []);
      const preferences = preferencesData?.data || preferencesData || {
        reflectionCategoriesEnabled: true,
        reflectionCategories: ['Action', 'Speech', 'Thought'],
      };
      
      // Parse reflectionCategories if it's a JSON string
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

      // If a life area was pre-selected (from Edit Life Area), set it
      if (preselectedLifeAreaId && !editingGoalId) {
        console.log('[CreateGoal iOS] Pre-selecting life area:', preselectedLifeAreaId);
        setLifeAreaId(preselectedLifeAreaId);
      }

      // If editing, populate the form with existing goal data
      if (editingGoalId && goalDetailsData) {
        const goalDetails = goalDetailsData?.data || goalDetailsData;
        console.log('[API] Goal details loaded for editing:', goalDetails);
        
        setTitle(goalDetails.title || '');
        setDescription(goalDetails.description || '');
        setParentGoalId(goalDetails.parentGoalId);
        setLifeAreaId(goalDetails.lifeAreaId);
        setBehaviorCategories(goalDetails.behaviorCategories || []);
        setType(goalDetails.type || 'Proactive');
        setStrategyIds(goalDetails.strategyIds || []);
        setScheduleType(goalDetails.scheduleType || 'Always Active');
        setScheduleTimesPerDay(goalDetails.scheduleTimesPerDay?.toString() || '');
        
        // Load advanced schedule data
        if (goalDetails.selectedWeekdays) {
          setSelectedWeekdays(goalDetails.selectedWeekdays);
        }
        if (goalDetails.monthlyType) {
          setMonthlyType(goalDetails.monthlyType);
        }
        if (goalDetails.monthlyDates || goalDetails.scheduleDatesOfMonth || goalDetails.schedule_dates_of_month) {
          setMonthlyDates(goalDetails.monthlyDates || goalDetails.scheduleDatesOfMonth || goalDetails.schedule_dates_of_month || []);
        }
        if (goalDetails.monthlyWeekdayRules || goalDetails.scheduleNthDayOfMonth || goalDetails.schedule_nth_day_of_month) {
          const rules = goalDetails.monthlyWeekdayRules || goalDetails.scheduleNthDayOfMonth || goalDetails.schedule_nth_day_of_month;
          if (rules) {
            const parsedRules = Array.isArray(rules) ? rules : (typeof rules === 'string' ? JSON.parse(rules) : [rules]);
            setMonthlyWeekdayRules(parsedRules);
          }
        }
        if (goalDetails.yearlyDates || goalDetails.scheduleDatesOfYear || goalDetails.schedule_dates_of_year) {
          setYearlyDates(goalDetails.yearlyDates || goalDetails.scheduleDatesOfYear || goalDetails.schedule_dates_of_year || []);
        }
        const calendarTypeData = goalDetails.calendarType || goalDetails.calendar_type;
        if (calendarTypeData) {
          const calendarMap: Record<string, CalendarType> = {
            'gregorian': 'Gregorian', 'hebrew': 'Hebrew', 'chinese': 'Chinese',
            'islamic': 'Islamic', 'persian': 'Persian',
            'Gregorian': 'Gregorian', 'Hebrew': 'Hebrew', 'Chinese': 'Chinese',
            'Islamic': 'Islamic', 'Persian': 'Persian',
          };
          setCalendarType(calendarMap[calendarTypeData] || 'Gregorian');
        }
        
        // Load reward data
        if (goalDetails.rewardCurrencyId) {
          setRewardCurrencyId(goalDetails.rewardCurrencyId);
          setRewardSuccesses(goalDetails.rewardSuccesses?.toString() || '');
          setRewardAmount(goalDetails.rewardAmount?.toString() || '');
        }
        
        // Load consequence data
        if (goalDetails.consequenceCurrencyId) {
          setConsequenceCurrencyId(goalDetails.consequenceCurrencyId);
          setConsequenceFailures(goalDetails.consequenceFailures?.toString() || '');
          setConsequenceAmount(goalDetails.consequenceAmount?.toString() || '');
        }
        
        // Load alarm data
        if (goalDetails.alarmEnabled !== undefined) {
          setAlarmEnabled(goalDetails.alarmEnabled || false);
        }
        if (goalDetails.alarmTime) {
          setAlarmTime(goalDetails.alarmTime);
          const [hours, minutes] = goalDetails.alarmTime.split(':');
          const timeDate = new Date();
          timeDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          setAlarmTimeDate(timeDate);
        }
        if (goalDetails.alarmOffsetType) {
          setAlarmOffsetType(goalDetails.alarmOffsetType as 'at' | 'before' | 'after');
        }
        if (goalDetails.alarmOffsetMinutes !== null && goalDetails.alarmOffsetMinutes !== undefined) {
          setAlarmOffsetMinutes(Math.abs(goalDetails.alarmOffsetMinutes).toString());
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
    console.log('Toggling behavior category:', category);
    const newCategories = behaviorCategories.includes(category)
      ? behaviorCategories.filter(c => c !== category)
      : [...behaviorCategories, category];
    setBehaviorCategories(newCategories);
  };

  const toggleStrategy = (strategyId: string) => {
    console.log('Toggling strategy:', strategyId);
    const newStrategies = strategyIds.includes(strategyId)
      ? strategyIds.filter(id => id !== strategyId)
      : [...strategyIds, strategyId];
    setStrategyIds(newStrategies);
  };

  const toggleWeekday = (weekday: string) => {
    const newWeekdays = selectedWeekdays.includes(weekday)
      ? selectedWeekdays.filter(d => d !== weekday)
      : [...selectedWeekdays, weekday];
    setSelectedWeekdays(newWeekdays);
  };

  const toggleMonthlyDate = (date: number) => {
    const newDates = monthlyDates.includes(date)
      ? monthlyDates.filter(d => d !== date)
      : [...monthlyDates, date].sort((a, b) => a - b);
    setMonthlyDates(newDates);
  };

  const addMonthlyWeekdayRule = (position: string, weekday: string) => {
    const newRules = [...monthlyWeekdayRules, { position, weekday }];
    setMonthlyWeekdayRules(newRules);
  };

  const removeMonthlyWeekdayRule = (index: number) => {
    const newRules = monthlyWeekdayRules.filter((_, i) => i !== index);
    setMonthlyWeekdayRules(newRules);
  };

  const addYearlyDate = (month: number, day: number) => {
    const newDates = [...yearlyDates, { month, day }];
    setYearlyDates(newDates);
  };

  const removeYearlyDate = (index: number) => {
    const newDates = yearlyDates.filter((_, i) => i !== index);
    setYearlyDates(newDates);
  };

  const getScheduleSummary = () => {
    if (scheduleType === 'Weekly' || scheduleType === 'Fortnightly') {
      if (selectedWeekdays.length === 0) return 'No days selected';
      return selectedWeekdays.join(', ');
    }
    if (scheduleType === 'Monthly') {
      if (monthlyType === 'date') {
        if (monthlyDates.length === 0) return 'No dates selected';
        const dateText = monthlyDates.map(d => `${d}${d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}`).join(', ');
        return dateText;
      } else {
        if (monthlyWeekdayRules.length === 0) return 'No rules selected';
        const ruleText = monthlyWeekdayRules.map(r => `${r.position} ${r.weekday}`).join(', ');
        return ruleText;
      }
    }
    if (scheduleType === 'Yearly') {
      if (yearlyDates.length === 0) return 'No dates selected';
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateText = yearlyDates.map(d => `${monthNames[d.month - 1]} ${d.day}`).join(', ');
      return `${dateText} (${calendarType})`;
    }
    return '';
  };

  const handleSubmit = async () => {
    console.log(editingGoalId ? 'Submitting goal update form' : 'Submitting goal creation form');
    
    if (!title.trim()) {
      showError('Goal title is required');
      return;
    }

    // CRITICAL: When behaviors are enabled, at least one category is MANDATORY
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
        scheduleType,
        scheduleTimesPerDay: scheduleType === 'Daily' && scheduleTimesPerDay ? parseInt(scheduleTimesPerDay) : undefined,
        // New: scheduleRecurrenceType maps to the lowercase schedule type
        scheduleRecurrenceType: scheduleType !== 'Always Active' ? scheduleType.toLowerCase() : undefined,
        selectedWeekdays: (scheduleType === 'Weekly' || scheduleType === 'Fortnightly') && selectedWeekdays.length > 0 ? selectedWeekdays : undefined,
        monthlyType: scheduleType === 'Monthly' ? monthlyType : undefined,
        monthlyDates: scheduleType === 'Monthly' && monthlyType === 'date' && monthlyDates.length > 0 ? monthlyDates : undefined,
        monthlyWeekdayRules: scheduleType === 'Monthly' && monthlyType === 'weekday' && monthlyWeekdayRules.length > 0 ? monthlyWeekdayRules : undefined,
        yearlyDates: scheduleType === 'Yearly' && yearlyDates.length > 0 ? yearlyDates : undefined,
        calendarType: (scheduleType === 'Monthly' || scheduleType === 'Yearly') ? calendarType : undefined,
        // Alarm fields
        alarmEnabled,
        alarmTime: alarmEnabled ? alarmTime : null,
        alarmOffsetType: alarmEnabled ? alarmOffsetType : null,
        alarmOffsetMinutes: alarmEnabled && alarmOffsetType !== 'at' && alarmOffsetMinutes
          ? (alarmOffsetType === 'before' ? -Math.abs(parseInt(alarmOffsetMinutes)) : Math.abs(parseInt(alarmOffsetMinutes)))
          : null,
      };

      // Handle rewards - send as nested object or null to clear
      if (rewardCurrencyId && rewardSuccesses && rewardAmount) {
        goalData.reward = {
          currencyId: rewardCurrencyId,
          successes: parseInt(rewardSuccesses),
          amount: parseInt(rewardAmount),
        };
        console.log('Setting reward data:', goalData.reward);
      } else {
        // Explicitly set to null to clear reward fields
        goalData.reward = null;
        console.log('Clearing reward data');
      }

      // Handle consequences - send as nested object or null to clear
      if (consequenceCurrencyId && consequenceFailures && consequenceAmount) {
        goalData.consequence = {
          currencyId: consequenceCurrencyId,
          failures: parseInt(consequenceFailures),
          amount: parseInt(consequenceAmount),
        };
        console.log('Setting consequence data:', goalData.consequence);
      } else {
        // Explicitly set to null to clear consequence fields
        goalData.consequence = null;
        console.log('Clearing consequence data');
      }

      let createdOrUpdatedGoal: any;
      
      if (editingGoalId) {
        console.log('[API] Updating goal with data:', goalData);
        createdOrUpdatedGoal = await authenticatedPut(`/api/goals/${editingGoalId}`, goalData);
        console.log('[API] Goal updated successfully:', createdOrUpdatedGoal);
        showSuccess('Goal updated successfully!');
      } else {
        console.log('[API] Creating goal with data:', goalData);
        createdOrUpdatedGoal = await authenticatedPost('/api/goals', goalData);
        console.log('[API] Goal created successfully:', createdOrUpdatedGoal);
        
        // If a life area was pre-selected, link the newly created goal to it
        if (preselectedLifeAreaId && createdOrUpdatedGoal) {
          const goalId = createdOrUpdatedGoal.id || createdOrUpdatedGoal.data?.id;
          if (goalId) {
            console.log('[API] Linking newly created goal to life area:', { goalId, lifeAreaId: preselectedLifeAreaId });
            try {
              await authenticatedPost(`/api/life-areas/${preselectedLifeAreaId}/goals`, { goalId });
              console.log('[API] Goal linked to life area successfully');
            } catch (linkError) {
              console.error('[API] Error linking goal to life area:', linkError);
              // Don't fail the whole operation if linking fails
            }
          }
        }
        
        showSuccess('Goal created successfully!');
      }
      
      setTimeout(() => {
        if (returnToLifeAreaWizard === 'true' && wizardLifeAreaId) {
          // Show prompt to create another goal
          setModalVisible(false);
          setShowCreateAnotherPrompt(true);
        } else if (returnToAddReflection === 'true') {
          // Navigate back to reflect screen with params to reopen AddReflectionModal
          const params = new URLSearchParams({
            openModal: 'true',
            reflectionCategory: reflectionCategory || '',
            reflectionType: reflectionType || 'Proactive',
            reflectionDescription: reflectionDescription || '',
            reflectionDate: reflectionDate || new Date().toISOString(),
          });
          router.push(`/(tabs)/reflect?${params.toString()}`);
        } else if (fromReflection === 'true') {
          // Navigate back to reflection screen to continue the reflection
          router.push('/(tabs)/reflect');
        } else if (returnToSettings === 'true') {
          // Navigate back to settings (Edit Life Area modal will still be open)
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
    const displayName = currency ? currency.name : 'Select Currency';
    return displayName;
  };

  // Get the action verb for reward based on currency's onSuccess setting
  const getRewardActionText = () => {
    if (!rewardCurrencyId) return 'earn';
    const currency = currencies.find(c => c.id === rewardCurrencyId);
    if (!currency || !currency.onSuccess) return 'earn';
    
    if (currency.onSuccess === 'ADD') return 'earn';
    if (currency.onSuccess === 'SUBTRACT') return 'lose';
    return 'earn';
  };

  // Get the action verb for consequence based on currency's onFailure setting
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
              console.log('Selected life area:', area.name);
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

  const scheduleTypes: ScheduleType[] = [
    'Always Active',
    'Daily',
    'Weekly',
    'Fortnightly',
    'Monthly',
    'Yearly',
  ];

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
        {/* 1. Goal Title (Required) */}
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

        {/* 2. Description (Optional) */}
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

        {/* 3. Parent Goal (Optional) */}
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

        {/* 4. Life Area (Optional) */}
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

        {/* 5. Behaviour Categories - Linked to Reflection Preferences */}
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

        {/* 6. Type (Required) */}
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
                  onPress={() => {
                    console.log('Selected goal type:', goalType);
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

        {/* 7. Strategies (Optional) */}
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

        {/* 8. Goal Schedule */}
        <View style={styles.section}>
          <Text style={styles.label}>Goal Schedule</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowSchedulePicker(true)}
          >
            <Text style={styles.pickerText}>{scheduleType}</Text>
            <IconSymbol
              ios_icon_name="chevron.down"
              android_material_icon_name="arrow-drop-down"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          
          {/* Daily: Times per day */}
          {scheduleType === 'Daily' && (
            <View style={styles.subSection}>
              <Text style={styles.subLabel}>Times per day (optional)</Text>
              <TextInput
                style={styles.input}
                value={scheduleTimesPerDay}
                onChangeText={setScheduleTimesPerDay}
                placeholder="e.g., 3"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />
            </View>
          )}
          
          {/* Weekly: Day selection - Auto-show */}
          {scheduleType === 'Weekly' && (
            <View style={styles.subSection}>
              <Text style={styles.subLabel}>Select days</Text>
              <View style={{ padding: 16 }}>
                <Text style={styles.helperText}>Select one or multiple days</Text>
                <View style={styles.fortnightGrid}>
                  {WEEKDAYS.map((weekday, index) => {
                    const isSelected = selectedWeekdays.includes(weekday);
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.fortnightDayButton, isSelected && styles.fortnightDayButtonSelected]}
                        onPress={() => toggleWeekday(weekday)}
                      >
                        <Text style={[styles.fortnightDayText, isSelected && styles.fortnightDayTextSelected]}>
                          {weekday.substring(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
          
          {/* Fortnightly: 2 weeks of day selection - Auto-show */}
          {scheduleType === 'Fortnightly' && (
            <View style={styles.subSection}>
              <Text style={styles.subLabel}>Select days (2 weeks)</Text>
              <View style={{ padding: 16 }}>
                <Text style={styles.helperText}>Select multiple days across 2 weeks</Text>
                
                {/* Week 1 */}
                <Text style={styles.weekLabel}>Week 1</Text>
                <View style={styles.fortnightGrid}>
                  {WEEKDAYS.map((weekday, index) => {
                    const dayIndex = `week1-${weekday}`;
                    const isSelected = selectedWeekdays.includes(dayIndex);
                    return (
                      <TouchableOpacity
                        key={dayIndex}
                        style={[styles.fortnightDayButton, isSelected && styles.fortnightDayButtonSelected]}
                        onPress={() => toggleWeekday(dayIndex)}
                      >
                        <Text style={[styles.fortnightDayText, isSelected && styles.fortnightDayTextSelected]}>
                          {weekday.substring(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                
                {/* Week 2 */}
                <Text style={[styles.weekLabel, { marginTop: 16 }]}>Week 2</Text>
                <View style={styles.fortnightGrid}>
                  {WEEKDAYS.map((weekday, index) => {
                    const dayIndex = `week2-${weekday}`;
                    const isSelected = selectedWeekdays.includes(dayIndex);
                    return (
                      <TouchableOpacity
                        key={dayIndex}
                        style={[styles.fortnightDayButton, isSelected && styles.fortnightDayButtonSelected]}
                        onPress={() => toggleWeekday(dayIndex)}
                      >
                        <Text style={[styles.fortnightDayText, isSelected && styles.fortnightDayTextSelected]}>
                          {weekday.substring(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
          
          {/* Monthly: Date or weekday selection */}
          {scheduleType === 'Monthly' && (
            <View style={styles.subSection}>
              {/* Only show calendar type if alternative calendars are enabled */}
              {(['Gregorian'] as const).length > 0 && (
                <>
                  <Text style={styles.subLabel}>Calendar type</Text>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setShowCalendarPicker(true)}
                  >
                    <Text style={styles.pickerText}>{calendarType}</Text>
                    <IconSymbol
                      ios_icon_name="chevron.down"
                      android_material_icon_name="arrow-drop-down"
                      size={24}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                </>
              )}
              
              <Text style={[styles.subLabel, { marginTop: 12 }]}>Monthly schedule type</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[styles.radio, monthlyType === 'date' && styles.radioSelected]}
                  onPress={() => setMonthlyType('date')}
                >
                  <View style={styles.radioCircle}>
                    {monthlyType === 'date' && <View style={styles.radioCircleInner} />}
                  </View>
                  <Text style={styles.radioText}>Specific date(s)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.radio, monthlyType === 'weekday' && styles.radioSelected]}
                  onPress={() => setMonthlyType('weekday')}
                >
                  <View style={styles.radioCircle}>
                    {monthlyType === 'weekday' && <View style={styles.radioCircleInner} />}
                  </View>
                  <Text style={styles.radioText}>Weekday rule(s)</Text>
                </TouchableOpacity>
              </View>
              
              {monthlyType === 'date' && (
                <TouchableOpacity
                  style={[styles.picker, { marginTop: 12 }]}
                  onPress={() => setShowMonthlyDatePicker(true)}
                >
                  <Text style={styles.pickerText}>{getScheduleSummary()}</Text>
                  <IconSymbol
                    ios_icon_name="chevron.down"
                    android_material_icon_name="arrow-drop-down"
                    size={24}
                    color={colors.text}
                  />
                </TouchableOpacity>
              )}
              
              {monthlyType === 'weekday' && (
                <View style={{ marginTop: 12 }}>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setShowMonthlyWeekdayPicker(true)}
                  >
                    <Text style={styles.pickerText}>{getScheduleSummary()}</Text>
                    <IconSymbol
                      ios_icon_name="chevron.down"
                      android_material_icon_name="arrow-drop-down"
                      size={24}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          
          {/* Yearly: Date selection with calendar type */}
          {scheduleType === 'Yearly' && (
            <View style={styles.subSection}>
              {/* Only show calendar type if alternative calendars are enabled */}
              {(['Gregorian'] as const).length > 0 && (
                <>
                  <Text style={styles.subLabel}>Calendar type</Text>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setShowCalendarPicker(true)}
                  >
                    <Text style={styles.pickerText}>{calendarType}</Text>
                    <IconSymbol
                      ios_icon_name="chevron.down"
                      android_material_icon_name="arrow-drop-down"
                      size={24}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                </>
              )}
              
              <Text style={[styles.subLabel, { marginTop: 12 }]}>Select dates</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowYearlyDatePicker(true)}
              >
                <Text style={styles.pickerText}>{getScheduleSummary()}</Text>
                <IconSymbol
                  ios_icon_name="chevron.down"
                  android_material_icon_name="arrow-drop-down"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 9. Alarm (Optional) */}
        <View style={styles.section}>
          <View style={styles.alarmHeader}>
            <View style={styles.alarmTitleRow}>
              <IconSymbol
                ios_icon_name="bell.fill"
                android_material_icon_name="notifications"
                size={20}
                color={alarmEnabled ? colors.primary : colors.textSecondary}
              />
              <Text style={styles.label}>Alarm</Text>
            </View>
            <Switch
              value={alarmEnabled}
              onValueChange={(value) => {
                console.log('Alarm enabled:', value);
                setAlarmEnabled(value);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.background}
            />
          </View>
          
          {alarmEnabled && (
            <View style={styles.alarmSettings}>
              {/* Alarm Time */}
              <View style={styles.alarmRow}>
                <Text style={styles.subLabel}>Alarm Time</Text>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setShowAlarmTimePicker(true)}
                >
                  <IconSymbol
                    ios_icon_name="clock"
                    android_material_icon_name="access-time"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.timePickerText}>
                    {(() => {
                      const [h, m] = alarmTime.split(':');
                      const hour = parseInt(h);
                      const ampm = hour >= 12 ? 'PM' : 'AM';
                      const displayHour = hour % 12 || 12;
                      return `${displayHour}:${m} ${ampm}`;
                    })()}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {showAlarmTimePicker && (
                <DateTimePicker
                  value={alarmTimeDate}
                  mode="time"
                  is24Hour={false}
                  display="spinner"
                  onChange={(event, selectedDate) => {
                    setShowAlarmTimePicker(false);
                    if (selectedDate) {
                      setAlarmTimeDate(selectedDate);
                      const hours = selectedDate.getHours().toString().padStart(2, '0');
                      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
                      setAlarmTime(`${hours}:${minutes}`);
                    }
                  }}
                />
              )}
              
              {/* Alarm Offset Type */}
              <View style={styles.alarmRow}>
                <Text style={styles.subLabel}>When to alarm</Text>
                <View style={styles.offsetTypeGroup}>
                  {(['at', 'before', 'after'] as const).map((offsetType) => {
                    const isSelected = alarmOffsetType === offsetType;
                    const label = offsetType === 'at' ? 'At time' : offsetType === 'before' ? 'Before' : 'After';
                    return (
                      <TouchableOpacity
                        key={offsetType}
                        style={[styles.offsetTypeButton, isSelected && styles.offsetTypeButtonSelected]}
                        onPress={() => {
                          setAlarmOffsetType(offsetType);
                          if (offsetType === 'at') {
                            setAlarmOffsetMinutes('');
                          }
                        }}
                      >
                        <Text style={[styles.offsetTypeText, isSelected && styles.offsetTypeTextSelected]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              
              {/* Offset Minutes */}
              {alarmOffsetType !== 'at' && (
                <View style={styles.alarmRow}>
                  <Text style={styles.subLabel}>
                    Minutes {alarmOffsetType === 'before' ? 'before' : 'after'} scheduled time
                  </Text>
                  <TextInput
                    style={[styles.input, styles.offsetInput]}
                    value={alarmOffsetMinutes}
                    onChangeText={setAlarmOffsetMinutes}
                    placeholder="e.g., 30"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                  />
                  {alarmOffsetMinutes ? (
                    <Text style={styles.alarmPreviewText}>
                      {(() => {
                        const [h, m] = alarmTime.split(':');
                        const baseMinutes = parseInt(h) * 60 + parseInt(m);
                        const offsetMins = parseInt(alarmOffsetMinutes) || 0;
                        const totalMinutes = alarmOffsetType === 'before'
                          ? baseMinutes - offsetMins
                          : baseMinutes + offsetMins;
                        const adjustedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
                        const displayHour = Math.floor(adjustedMinutes / 60);
                        const displayMin = adjustedMinutes % 60;
                        const ampm = displayHour >= 12 ? 'PM' : 'AM';
                        const hour12 = displayHour % 12 || 12;
                        return `Alarm will ring at ${hour12}:${String(displayMin).padStart(2, '0')} ${ampm}`;
                      })()}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          )}
        </View>

        {/* 10. Rewards (Optional) */}
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

        {/* 10. Consequences (Optional) */}
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

      {/* Weekday Picker Modal */}
      <Modal
        visible={showWeekdayPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWeekdayPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Days</Text>
              <TouchableOpacity onPress={() => setShowWeekdayPicker(false)}>
                <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {WEEKDAYS.map((weekday) => {
                const isSelected = selectedWeekdays.includes(weekday);
                return (
                  <TouchableOpacity
                    key={weekday}
                    style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                    onPress={() => toggleWeekday(weekday)}
                  >
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>{weekday}</Text>
                    {isSelected && <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Monthly Date Picker Modal */}
      <Modal
        visible={showMonthlyDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMonthlyDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Dates</Text>
              <TouchableOpacity onPress={() => setShowMonthlyDatePicker(false)}>
                <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <View style={styles.dateGrid}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((date) => {
                  const isSelected = monthlyDates.includes(date);
                  return (
                    <TouchableOpacity
                      key={date}
                      style={[styles.dateButton, isSelected && styles.dateButtonSelected]}
                      onPress={() => toggleMonthlyDate(date)}
                    >
                      <Text style={[styles.dateButtonText, isSelected && styles.dateButtonTextSelected]}>{date}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Monthly Weekday Picker Modal */}
      <Modal
        visible={showMonthlyWeekdayPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMonthlyWeekdayPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Weekday Rules</Text>
              <TouchableOpacity onPress={() => setShowMonthlyWeekdayPicker(false)}>
                <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <View style={{ padding: 16 }}>
                <Text style={styles.helperText}>Add rules like "First Tuesday" or "Last Wednesday"</Text>
                {monthlyWeekdayRules.map((rule, index) => (
                  <View key={index} style={styles.ruleItem}>
                    <Text style={styles.ruleText}>{rule.position} {rule.weekday}</Text>
                    <TouchableOpacity onPress={() => removeMonthlyWeekdayRule(index)}>
                      <IconSymbol ios_icon_name="trash" android_material_icon_name="delete" size={20} color="#ff4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                <Text style={[styles.subLabel, { marginTop: 16 }]}>Add new rule</Text>
                {WEEK_POSITIONS.map((position) => (
                  <View key={position} style={{ marginBottom: 12 }}>
                    <Text style={styles.positionLabel}>{position}</Text>
                    <View style={styles.weekdayButtonGroup}>
                      {WEEKDAYS.map((weekday) => (
                        <TouchableOpacity
                          key={weekday}
                          style={styles.weekdayButton}
                          onPress={() => addMonthlyWeekdayRule(position, weekday)}
                        >
                          <Text style={styles.weekdayButtonText}>{weekday.substring(0, 3)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Yearly Date Picker Modal */}
      <Modal
        visible={showYearlyDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowYearlyDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Yearly Dates</Text>
              <TouchableOpacity onPress={() => setShowYearlyDatePicker(false)}>
                <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <View style={{ padding: 16 }}>
                <Text style={styles.helperText}>
                  Select dates throughout the year
                </Text>
                
                {/* Display selected dates */}
                {yearlyDates.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.subLabel}>Selected dates:</Text>
                    {yearlyDates.map((date, index) => {
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      const dateText = `${monthNames[date.month - 1]} ${date.day}`;
                      return (
                        <View key={index} style={styles.ruleItem}>
                          <Text style={styles.ruleText}>{dateText}</Text>
                          <TouchableOpacity onPress={() => removeYearlyDate(index)}>
                            <IconSymbol
                              ios_icon_name="trash"
                              android_material_icon_name="delete"
                              size={20}
                              color="#ff4444"
                            />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
                
                {/* Month and Day Selector */}
                <Text style={styles.subLabel}>Add new date</Text>
                <Text style={styles.helperText}>Select month and day</Text>
                
                {/* Month Selector */}
                <Text style={[styles.subLabel, { marginTop: 12 }]}>Month</Text>
                <View style={styles.monthGrid}>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => {
                    const monthNumber = index + 1;
                    return (
                      <TouchableOpacity
                        key={month}
                        style={styles.monthButton}
                        onPress={() => {
                          // Add date with selected month and day 1 as default
                          addYearlyDate(monthNumber, 1);
                        }}
                      >
                        <Text style={styles.monthButtonText}>{month}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                
                <Text style={styles.helperText}>
                  Tap a month to add the 1st of that month. You can then edit the day by removing and re-adding.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
                <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {(['Gregorian', 'Hebrew', 'Chinese', 'Islamic', 'Persian'] as CalendarType[]).map((calendar) => {
                const isSelected = calendar === calendarType;
                return (
                  <TouchableOpacity
                    key={calendar}
                    style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                    onPress={() => { setCalendarType(calendar); setShowCalendarPicker(false); }}
                  >
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>{calendar}</Text>
                    {isSelected && <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
                      console.log('Selected parent goal:', goal.title);
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

      {/* Schedule Picker Modal */}
      <Modal
        visible={showSchedulePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSchedulePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Schedule</Text>
              <TouchableOpacity onPress={() => setShowSchedulePicker(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {scheduleTypes.map((schedule) => {
                const isSelected = schedule === scheduleType;
                return (
                  <TouchableOpacity
                    key={schedule}
                    style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                    onPress={() => {
                      console.log('Selected schedule:', schedule);
                      setScheduleType(schedule);
                      setShowSchedulePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                      {schedule}
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
                  console.log('Clearing reward currency');
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
                      console.log('Selected reward currency:', currency.name);
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
                  console.log('Clearing consequence currency');
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
                      console.log('Selected consequence currency:', currency.name);
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
                  // Return to wizard with newGoalCreated flag
                  router.push(`/life-area-wizard?id=${wizardLifeAreaId}&step=2&newGoalCreated=true`);
                }}
              >
                <Text style={styles.alertButtonSecondaryText}>No, Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={() => {
                  setShowCreateAnotherPrompt(false);
                  // Reset form for new goal
                  setTitle('');
                  setDescription('');
                  setParentGoalId(undefined);
                  // Keep lifeAreaId prefilled
                  setBehaviorCategories([]);
                  setType('Proactive');
                  setStrategyIds([]);
                  setScheduleType('Always Active');
                  setScheduleTimesPerDay('');
                  setSelectedWeekdays([]);
                  setMonthlyType('date');
                  setMonthlyDates([]);
                  setMonthlyWeekdayRules([]);
                  setYearlyDates([]);
                  setCalendarType('Gregorian');
                  setRewardCurrencyId(undefined);
                  setRewardSuccesses('');
                  setRewardAmount('');
                  setConsequenceCurrencyId(undefined);
                  setConsequenceFailures('');
                  setConsequenceAmount('');
                  setAlarmEnabled(false);
                  setAlarmTime('09:00');
                  setAlarmOffsetType('at');
                  setAlarmOffsetMinutes('');
                }}
              >
                <Text style={styles.alertButtonText}>Yes, Create Another</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  subSection: {
    marginTop: 12,
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
  buttonContainer: {
    marginTop: 20,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
  },
  alarmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  alarmTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alarmSettings: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  alarmRow: {
    gap: 8,
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timePickerText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  offsetTypeGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  offsetTypeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  offsetTypeButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  offsetTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  offsetTypeTextSelected: {
    color: '#fff',
  },
  offsetInput: {
    width: '100%',
  },
  alarmPreviewText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
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
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 8,
  },
  dateButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.card,
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
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  dateButtonTextSelected: {
    color: '#fff',
  },
  ruleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  ruleText: {
    fontSize: 16,
    color: colors.text,
  },
  positionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  weekdayButtonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekdayButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  weekdayButtonText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 12,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  fortnightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fortnightDayButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fortnightDayButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  fortnightDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  fortnightDayTextSelected: {
    color: '#fff',
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  monthButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.primary,
    minWidth: 60,
    alignItems: 'center',
  },
  monthButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
