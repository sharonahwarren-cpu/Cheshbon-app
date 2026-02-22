
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
  alternativeCalendar?: 'gregorian' | 'hebrew' | 'chinese' | 'islamic';
}

interface AlarmConfig {
  id: string;
  time: string; // "HH:mm"
  offsetDays: number; // 0 = day of goal, negative = days before, positive = days after
}

type BehaviorCategory = 'Action' | 'Speech' | 'Thought' | 'Feeling';
type GoalType = 'Restraining' | 'Proactive';
type ScheduleType = 'Always Active' | 'Daily' | 'Weekly' | 'Fortnightly' | 'Monthly' | 'Yearly';
type CalendarType = 'Gregorian' | 'Hebrew' | 'Chinese' | 'Islamic';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]); // 0=Sun, 6=Sat
  const [selectedFortnightDays, setSelectedFortnightDays] = useState<number[]>([]); // 0-13 for 2 weeks
  const [monthlyType, setMonthlyType] = useState<'date' | 'weekday'>('date');
  const [monthlyDates, setMonthlyDates] = useState<number[]>([]);
  const [monthlyWeekdayRules, setMonthlyWeekdayRules] = useState<Array<{position: string; weekday: string}>>([]);
  const [yearlyDates, setYearlyDates] = useState<Array<{month: number; day: number}>>([]);
  const [calendarType, setCalendarType] = useState<CalendarType>('Gregorian');
  
  // End date state
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  // Reward state
  const [rewardCurrencyId, setRewardCurrencyId] = useState<string | undefined>();
  const [rewardSuccesses, setRewardSuccesses] = useState<string>('');
  const [rewardAmount, setRewardAmount] = useState<string>('');
  
  // Consequence state
  const [consequenceCurrencyId, setConsequenceCurrencyId] = useState<string | undefined>();
  const [consequenceFailures, setConsequenceFailures] = useState<string>('');
  const [consequenceAmount, setConsequenceAmount] = useState<string>('');

  // Alarm state - support multiple alarms
  const [alarms, setAlarms] = useState<AlarmConfig[]>([]);
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  const [editingAlarmIndex, setEditingAlarmIndex] = useState<number | null>(null);
  const [currentAlarmTime, setCurrentAlarmTime] = useState('09:00');
  const [currentAlarmOffsetDays, setCurrentAlarmOffsetDays] = useState('0');
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
    alternativeCalendar: 'gregorian',
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
  const [showFortnightPicker, setShowFortnightPicker] = useState(false);
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
      const promises = [
        authenticatedGet<any>('/api/goals'),
        authenticatedGet<any>('/api/life-areas'),
        authenticatedGet<any>('/api/strategies'),
        authenticatedGet<any>('/api/currencies'),
        authenticatedGet<any>('/api/user-preferences'),
      ];

      if (editingGoalId) {
        promises.push(authenticatedGet<any>(`/api/goals/${editingGoalId}`));
      }

      const results = await Promise.all(promises);
      const [goalsData, lifeAreasData, strategiesData, currenciesData, preferencesData, goalDetailsData] = results;
      
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
        if (goalDetails.selectedFortnightDays) {
          setSelectedFortnightDays(goalDetails.selectedFortnightDays);
        }
        if (goalDetails.monthlyType) {
          setMonthlyType(goalDetails.monthlyType);
        }
        if (goalDetails.monthlyDates) {
          setMonthlyDates(goalDetails.monthlyDates);
        }
        if (goalDetails.monthlyWeekdayRules) {
          setMonthlyWeekdayRules(goalDetails.monthlyWeekdayRules);
        }
        if (goalDetails.yearlyDates) {
          setYearlyDates(goalDetails.yearlyDates);
        }
        if (goalDetails.calendarType) {
          setCalendarType(goalDetails.calendarType);
        }
        
        // Load end date
        if (goalDetails.endDate) {
          setHasEndDate(true);
          setEndDate(new Date(goalDetails.endDate));
        }
        
        if (goalDetails.rewardCurrencyId) {
          setRewardCurrencyId(goalDetails.rewardCurrencyId);
          setRewardSuccesses(goalDetails.rewardSuccesses?.toString() || '');
          setRewardAmount(goalDetails.rewardAmount?.toString() || '');
        }
        
        if (goalDetails.consequenceCurrencyId) {
          setConsequenceCurrencyId(goalDetails.consequenceCurrencyId);
          setConsequenceFailures(goalDetails.consequenceFailures?.toString() || '');
          setConsequenceAmount(goalDetails.consequenceAmount?.toString() || '');
        }
        
        // Load alarms
        if (goalDetails.alarms && Array.isArray(goalDetails.alarms)) {
          setAlarms(goalDetails.alarms);
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

  const toggleWeekday = (dayIndex: number) => {
    const newWeekdays = selectedWeekdays.includes(dayIndex)
      ? selectedWeekdays.filter(d => d !== dayIndex)
      : [...selectedWeekdays, dayIndex].sort((a, b) => a - b);
    setSelectedWeekdays(newWeekdays);
  };

  const toggleFortnightDay = (dayIndex: number) => {
    const newDays = selectedFortnightDays.includes(dayIndex)
      ? selectedFortnightDays.filter(d => d !== dayIndex)
      : [...selectedFortnightDays, dayIndex].sort((a, b) => a - b);
    setSelectedFortnightDays(newDays);
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

  const openAddAlarmModal = () => {
    setEditingAlarmIndex(null);
    setCurrentAlarmTime('09:00');
    setCurrentAlarmOffsetDays('0');
    const timeDate = new Date();
    timeDate.setHours(9, 0, 0, 0);
    setAlarmTimeDate(timeDate);
    setShowAlarmModal(true);
  };

  const openEditAlarmModal = (index: number) => {
    const alarm = alarms[index];
    setEditingAlarmIndex(index);
    setCurrentAlarmTime(alarm.time);
    setCurrentAlarmOffsetDays(alarm.offsetDays.toString());
    const [hours, minutes] = alarm.time.split(':');
    const timeDate = new Date();
    timeDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    setAlarmTimeDate(timeDate);
    setShowAlarmModal(true);
  };

  const saveAlarm = () => {
    const newAlarm: AlarmConfig = {
      id: editingAlarmIndex !== null ? alarms[editingAlarmIndex].id : `alarm-${Date.now()}`,
      time: currentAlarmTime,
      offsetDays: parseInt(currentAlarmOffsetDays) || 0,
    };

    if (editingAlarmIndex !== null) {
      const updatedAlarms = [...alarms];
      updatedAlarms[editingAlarmIndex] = newAlarm;
      setAlarms(updatedAlarms);
    } else {
      setAlarms([...alarms, newAlarm]);
    }
    setShowAlarmModal(false);
  };

  const deleteAlarm = (index: number) => {
    const updatedAlarms = alarms.filter((_, i) => i !== index);
    setAlarms(updatedAlarms);
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
        scheduleType,
        scheduleTimesPerDay: scheduleType === 'Daily' && scheduleTimesPerDay ? parseInt(scheduleTimesPerDay) : undefined,
        selectedWeekdays: scheduleType === 'Weekly' && selectedWeekdays.length > 0 ? selectedWeekdays : undefined,
        selectedFortnightDays: scheduleType === 'Fortnightly' && selectedFortnightDays.length > 0 ? selectedFortnightDays : undefined,
        monthlyType: scheduleType === 'Monthly' ? monthlyType : undefined,
        monthlyDates: scheduleType === 'Monthly' && monthlyType === 'date' && monthlyDates.length > 0 ? monthlyDates : undefined,
        monthlyWeekdayRules: scheduleType === 'Monthly' && monthlyType === 'weekday' && monthlyWeekdayRules.length > 0 ? monthlyWeekdayRules : undefined,
        yearlyDates: scheduleType === 'Yearly' && yearlyDates.length > 0 ? yearlyDates : undefined,
        calendarType: (scheduleType === 'Monthly' || scheduleType === 'Yearly') ? calendarType : undefined,
        alarms: alarms.length > 0 ? alarms : undefined,
        endDate: hasEndDate && endDate ? endDate.toISOString() : null,
      };

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

  const scheduleTypes: ScheduleType[] = [
    'Always Active',
    'Daily',
    'Weekly',
    'Fortnightly',
    'Monthly',
    'Yearly',
  ];

  // Get available calendar types based on user preferences
  const getAvailableCalendarTypes = (): CalendarType[] => {
    const calendars: CalendarType[] = ['Gregorian'];
    const altCalendar = userPreferences.alternativeCalendar;
    
    if (altCalendar === 'hebrew') calendars.push('Hebrew');
    if (altCalendar === 'chinese') calendars.push('Chinese');
    if (altCalendar === 'islamic') calendars.push('Islamic');
    
    return calendars;
  };

  const screenTitle = editingGoalId ? 'Edit Goal' : 'Create Goal';
  const submitButtonTitle = editingGoalId ? 'Update Goal' : 'Create Goal';
  const rewardActionText = getRewardActionText();
  const consequenceActionText = getConsequenceActionText();

  const getScheduleSummary = () => {
    if (scheduleType === 'Weekly') {
      if (selectedWeekdays.length === 0) return 'No days selected';
      return selectedWeekdays.map(i => WEEKDAYS[i]).join(', ');
    }
    if (scheduleType === 'Fortnightly') {
      if (selectedFortnightDays.length === 0) return 'No days selected';
      const weekLabels = selectedFortnightDays.map(i => {
        const weekNum = Math.floor(i / 7) + 1;
        const dayName = WEEKDAYS[i % 7];
        return `Week ${weekNum} ${dayName}`;
      });
      return weekLabels.join(', ');
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

        {/* Goal Schedule */}
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
          
          {/* Weekly: Day selection in box format */}
          {scheduleType === 'Weekly' && (
            <View style={styles.subSection}>
              <Text style={styles.subLabel}>Select days</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowWeekdayPicker(true)}
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
          
          {/* Fortnightly: 2 weeks of day selection */}
          {scheduleType === 'Fortnightly' && (
            <View style={styles.subSection}>
              <Text style={styles.subLabel}>Select days (2 weeks)</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowFortnightPicker(true)}
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
          
          {/* Monthly: Date or weekday selection with calendar type */}
          {scheduleType === 'Monthly' && (
            <View style={styles.subSection}>
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
          
          {/* End Date (Optional) */}
          {scheduleType !== 'Always Active' && (
            <View style={styles.subSection}>
              <View style={styles.endDateHeader}>
                <Text style={styles.subLabel}>End Date (Optional)</Text>
                <Switch
                  value={hasEndDate}
                  onValueChange={(value) => {
                    setHasEndDate(value);
                    if (!value) {
                      setEndDate(undefined);
                    }
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
              {hasEndDate && (
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text style={styles.pickerText}>
                    {endDate ? endDate.toLocaleDateString() : 'Select end date'}
                  </Text>
                  <IconSymbol
                    ios_icon_name="calendar"
                    android_material_icon_name="calendar-today"
                    size={24}
                    color={colors.text}
                  />
                </TouchableOpacity>
              )}
              {showEndDatePicker && (
                <DateTimePicker
                  value={endDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowEndDatePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      setEndDate(selectedDate);
                    }
                  }}
                  minimumDate={new Date()}
                />
              )}
            </View>
          )}
        </View>

        {/* Alarms - Multiple alarms support */}
        <View style={styles.section}>
          <View style={styles.alarmHeader}>
            <View style={styles.alarmTitleRow}>
              <IconSymbol
                ios_icon_name="bell.fill"
                android_material_icon_name="notifications"
                size={20}
                color={alarms.length > 0 ? colors.primary : colors.textSecondary}
              />
              <Text style={styles.label}>Alarms</Text>
            </View>
            <TouchableOpacity
              style={styles.addAlarmButton}
              onPress={openAddAlarmModal}
            >
              <IconSymbol
                ios_icon_name="plus"
                android_material_icon_name="add"
                size={20}
                color="#fff"
              />
              <Text style={styles.addAlarmButtonText}>Add Alarm</Text>
            </TouchableOpacity>
          </View>
          
          {alarms.length > 0 && (
            <View style={styles.alarmsContainer}>
              {alarms.map((alarm, index) => {
                const [h, m] = alarm.time.split(':');
                const hour = parseInt(h);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour % 12 || 12;
                const timeText = `${displayHour}:${m} ${ampm}`;
                
                const offsetText = alarm.offsetDays === 0
                  ? 'On the day'
                  : alarm.offsetDays < 0
                  ? `${Math.abs(alarm.offsetDays)} day${Math.abs(alarm.offsetDays) > 1 ? 's' : ''} before`
                  : `${alarm.offsetDays} day${alarm.offsetDays > 1 ? 's' : ''} after`;
                
                return (
                  <View key={alarm.id} style={styles.alarmCard}>
                    <View style={styles.alarmCardContent}>
                      <IconSymbol
                        ios_icon_name="bell.fill"
                        android_material_icon_name="notifications"
                        size={18}
                        color={colors.primary}
                      />
                      <View style={styles.alarmCardText}>
                        <Text style={styles.alarmCardTime}>{timeText}</Text>
                        <Text style={styles.alarmCardOffset}>{offsetText}</Text>
                      </View>
                    </View>
                    <View style={styles.alarmCardActions}>
                      <TouchableOpacity
                        style={styles.alarmCardButton}
                        onPress={() => openEditAlarmModal(index)}
                      >
                        <IconSymbol
                          ios_icon_name="pencil"
                          android_material_icon_name="edit"
                          size={18}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.alarmCardButton}
                        onPress={() => deleteAlarm(index)}
                      >
                        <IconSymbol
                          ios_icon_name="trash"
                          android_material_icon_name="delete"
                          size={18}
                          color="#ff4444"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
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

      {/* Weekly Picker Modal - Box format like Fortnightly */}
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
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <View style={{ padding: 16 }}>
                <Text style={styles.helperText}>Select one or multiple days</Text>
                <View style={styles.fortnightGrid}>
                  {WEEKDAYS.map((weekday, index) => {
                    const isSelected = selectedWeekdays.includes(index);
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.fortnightDayButton, isSelected && styles.fortnightDayButtonSelected]}
                        onPress={() => toggleWeekday(index)}
                      >
                        <Text style={[styles.fortnightDayText, isSelected && styles.fortnightDayTextSelected]}>
                          {weekday.substring(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Fortnight Picker Modal - 2 weeks of Sun-Sat */}
      <Modal
        visible={showFortnightPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFortnightPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Days (2 Weeks)</Text>
              <TouchableOpacity onPress={() => setShowFortnightPicker(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <View style={{ padding: 16 }}>
                <Text style={styles.helperText}>Select multiple days across 2 weeks</Text>
                
                {/* Week 1 */}
                <Text style={styles.weekLabel}>Week 1</Text>
                <View style={styles.fortnightGrid}>
                  {WEEKDAYS.map((weekday, index) => {
                    const dayIndex = index;
                    const isSelected = selectedFortnightDays.includes(dayIndex);
                    return (
                      <TouchableOpacity
                        key={dayIndex}
                        style={[styles.fortnightDayButton, isSelected && styles.fortnightDayButtonSelected]}
                        onPress={() => toggleFortnightDay(dayIndex)}
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
                    const dayIndex = index + 7;
                    const isSelected = selectedFortnightDays.includes(dayIndex);
                    return (
                      <TouchableOpacity
                        key={dayIndex}
                        style={[styles.fortnightDayButton, isSelected && styles.fortnightDayButtonSelected]}
                        onPress={() => toggleFortnightDay(dayIndex)}
                      >
                        <Text style={[styles.fortnightDayText, isSelected && styles.fortnightDayTextSelected]}>
                          {weekday.substring(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
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
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
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
                      <Text style={[styles.dateButtonText, isSelected && styles.dateButtonTextSelected]}>
                        {date}
                      </Text>
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
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <View style={{ padding: 16 }}>
                <Text style={styles.helperText}>
                  Add rules like "First Tuesday" or "Last Wednesday"
                </Text>
                
                {monthlyWeekdayRules.map((rule, index) => {
                  const ruleText = `${rule.position} ${rule.weekday}`;
                  return (
                    <View key={index} style={styles.ruleItem}>
                      <Text style={styles.ruleText}>{ruleText}</Text>
                      <TouchableOpacity onPress={() => removeMonthlyWeekdayRule(index)}>
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
                
                <Text style={[styles.subLabel, { marginTop: 16 }]}>Add new rule</Text>
                {WEEK_POSITIONS.map((position) => (
                  <View key={position} style={{ marginBottom: 12 }}>
                    <Text style={styles.positionLabel}>{position}</Text>
                    <View style={styles.weekdayButtonGroup}>
                      {WEEKDAYS.map((weekday) => (
                        <TouchableOpacity
                          key={weekday}
                          style={styles.weekdayButton}
                          onPress={() => {
                            addMonthlyWeekdayRule(position, weekday);
                          }}
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
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <View style={{ padding: 16 }}>
                <Text style={styles.helperText}>
                  Add dates like "Dec 1" or "Apr 3"
                </Text>
                
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
                
                <Text style={[styles.subLabel, { marginTop: 16 }]}>Add new date</Text>
                <Text style={styles.helperText}>
                  Select month and day to add
                </Text>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => {
                    addYearlyDate(12, 1);
                  }}
                >
                  <IconSymbol
                    ios_icon_name="plus"
                    android_material_icon_name="add"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.addButtonText}>Add Date (Example: Dec 1)</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Calendar Type Picker Modal - Only show enabled calendars */}
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
            <ScrollView style={styles.modalScroll}>
              {getAvailableCalendarTypes().map((calendar) => {
                const isSelected = calendar === calendarType;
                return (
                  <TouchableOpacity
                    key={calendar}
                    style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                    onPress={() => {
                      setCalendarType(calendar);
                      setShowCalendarPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                      {calendar}
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

      {/* Alarm Edit/Add Modal */}
      <Modal
        visible={showAlarmModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAlarmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingAlarmIndex !== null ? 'Edit Alarm' : 'Add Alarm'}</Text>
              <TouchableOpacity onPress={() => setShowAlarmModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
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
                    const [h, m] = currentAlarmTime.split(':');
                    const hour = parseInt(h);
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const displayHour = hour % 12 || 12;
                    return `${displayHour}:${m} ${ampm}`;
                  })()}
                </Text>
              </TouchableOpacity>
              
              {showAlarmTimePicker && (
                <DateTimePicker
                  value={alarmTimeDate}
                  mode="time"
                  is24Hour={false}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowAlarmTimePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      setAlarmTimeDate(selectedDate);
                      const hours = selectedDate.getHours().toString().padStart(2, '0');
                      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
                      setCurrentAlarmTime(`${hours}:${minutes}`);
                    }
                  }}
                />
              )}
              
              <Text style={[styles.subLabel, { marginTop: 16 }]}>Days offset from scheduled goal</Text>
              <Text style={styles.helperText}>
                0 = day of goal, negative = days before, positive = days after
              </Text>
              <TextInput
                style={styles.input}
                value={currentAlarmOffsetDays}
                onChangeText={setCurrentAlarmOffsetDays}
                placeholder="e.g., 0, -2, 1"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />
              
              <TouchableOpacity
                style={[styles.addButton, { marginTop: 20 }]}
                onPress={saveAlarm}
              >
                <Text style={styles.addButtonText}>
                  {editingAlarmIndex !== null ? 'Update Alarm' : 'Add Alarm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* All other existing modals (Parent Goal, Life Area, Strategy, Schedule, Currency, Success/Error, Create Another) */}
      
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
                  setScheduleType('Always Active');
                  setScheduleTimesPerDay('');
                  setSelectedWeekdays([]);
                  setSelectedFortnightDays([]);
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
                  setAlarms([]);
                  setHasEndDate(false);
                  setEndDate(undefined);
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
    flex: 1,
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
  endDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    marginBottom: 12,
  },
  alarmTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addAlarmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  addAlarmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  alarmsContainer: {
    gap: 8,
  },
  alarmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alarmCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  alarmCardText: {
    flex: 1,
  },
  alarmCardTime: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  alarmCardOffset: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  alarmCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  alarmCardButton: {
    padding: 8,
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
  weekLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
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
});
