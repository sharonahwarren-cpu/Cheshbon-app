
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { LoadingButton } from '@/components/LoadingButton';
import { authenticatedGet, authenticatedPost, authenticatedPut } from '@/utils/api';
import { HDate, months } from '@hebcal/core';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState, useEffect } from 'react';
import { colors } from '@/styles/commonStyles';
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
import { IconSymbol } from '@/components/IconSymbol';
import { DateTime } from 'luxon';
import { getLocalTimezone } from '@/utils/dateUtils';
import { GoalSchedulePreview } from '@/components/GoalSchedulePreview';
import type { GoalSchedule } from '@/utils/scheduleCalculations';

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

interface YearlyDateRange {
  startMonth: number;
  startDay: number;
  endMonth?: number;
  endDay?: number;
}

type BehaviorCategory = 'Action' | 'Speech' | 'Thought' | 'Feeling';
type GoalType = 'Restraining' | 'Proactive';
type ScheduleType = 'Always Active' | 'Daily' | 'Weekly' | 'Fortnightly' | 'Monthly' | 'Yearly';
type CalendarType = 'Gregorian' | 'Hebrew' | 'Chinese' | 'Islamic';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_POSITIONS = ['First', 'Second', 'Third', 'Fourth', 'Last'];

// Helper function to check if a Hebrew year is a leap year
const isHebrewLeapYear = (hebrewYear: number): boolean => {
  // Hebrew leap year calculation: years 3, 6, 8, 11, 14, 17, 19 in a 19-year cycle
  const yearInCycle = hebrewYear % 19;
  return [3, 6, 8, 11, 14, 17, 0].includes(yearInCycle);
};

// Helper function to get month names based on calendar type
const getMonthNames = (calendarType: CalendarType, year?: number): string[] => {
  if (calendarType === 'Hebrew') {
    // Use Hebcal to get proper Hebrew month names
    // Check if it's a leap year (has Adar I and Adar II)
    const hebrewYear = year || new HDate().getFullYear();
    const isLeapYear = isHebrewLeapYear(hebrewYear);
    
    if (isLeapYear) {
      return [
        'Tishrei (תִּשְׁרֵי)',
        'Cheshvan (חֶשְׁוָן)',
        'Kislev (כִּסְלֵו)',
        'Tevet (טֵבֵת)',
        'Shevat (שְׁבָט)',
        'Adar I (אֲדָר א׳)',
        'Adar II (אֲדָר ב׳)',
        'Nisan (נִיסָן)',
        'Iyar (אִיָּר)',
        'Sivan (סִיוָן)',
        'Tammuz (תַּמּוּז)',
        'Av (אָב)',
        'Elul (אֱלוּל)',
      ];
    } else {
      return [
        'Tishrei (תִּשְׁרֵי)',
        'Cheshvan (חֶשְׁוָן)',
        'Kislev (כִּסְלֵו)',
        'Tevet (טֵבֵת)',
        'Shevat (שְׁבָט)',
        'Adar (אֲדָר)',
        'Nisan (נִיסָן)',
        'Iyar (אִיָּר)',
        'Sivan (סִיוָן)',
        'Tammuz (תַּמּוּז)',
        'Av (אָב)',
        'Elul (אֱלוּל)',
      ];
    }
  } else if (calendarType === 'Chinese') {
    return [
      '正月 (Zhēngyuè)',
      '二月 (Èryuè)',
      '三月 (Sānyuè)',
      '四月 (Sìyuè)',
      '五月 (Wǔyuè)',
      '六月 (Liùyuè)',
      '七月 (Qīyuè)',
      '八月 (Bāyuè)',
      '九月 (Jiǔyuè)',
      '十月 (Shíyuè)',
      '十一月 (Shíyīyuè)',
      '十二月 (Shí\'èryuè)',
    ];
  } else if (calendarType === 'Islamic') {
    return [
      'Muharram (مُحَرَّم)',
      'Safar (صَفَر)',
      'Rabi\' al-Awwal (رَبِيع ٱلْأَوَّل)',
      'Rabi\' al-Thani (رَبِيع ٱلثَّانِي)',
      'Jumada al-Awwal (جُمَادَىٰ ٱلْأُولَىٰ)',
      'Jumada al-Thani (جُمَادَىٰ ٱلثَّانِيَة)',
      'Rajab (رَجَب)',
      'Sha\'ban (شَعْبَان)',
      'Ramadan (رَمَضَان)',
      'Shawwal (شَوَّال)',
      'Dhu al-Qi\'dah (ذُو ٱلْقَعْدَة)',
      'Dhu al-Hijjah (ذُو ٱلْحِجَّة)',
    ];
  }
  // Gregorian (default)
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
};

// Helper function to get max days in a month based on calendar type
const getMaxDaysInMonth = (month: number, calendarType: CalendarType): number => {
  if (calendarType === 'Hebrew') {
    // Hebrew months have either 29 or 30 days
    // Use current Hebrew year to determine
    const hebrewYear = new HDate().getFullYear();
    const isLeapYear = isHebrewLeapYear(hebrewYear);
    
    // Month numbers in Hebrew calendar
    const daysInHebrewMonth = [30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29]; // 13 months for leap year
    if (isLeapYear) {
      return daysInHebrewMonth[month - 1] || 30;
    } else {
      // Non-leap year (12 months)
      const nonLeapDays = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
      return nonLeapDays[month - 1] || 30;
    }
  } else if (calendarType === 'Islamic') {
    // Islamic months alternate between 29 and 30 days
    return month % 2 === 1 ? 30 : 29;
  } else if (calendarType === 'Chinese') {
    // Chinese lunar months have 29 or 30 days
    return 30;
  }
  // Gregorian
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return daysInMonth[month - 1] || 31;
};

// Helper function to format date based on calendar type
// Uses luxon for timezone-aware conversion from UTC
const formatDateByCalendar = (date: Date, calendarType: CalendarType): string => {
  try {
    // Convert the Date (which may be UTC) to local timezone using luxon
    const localZone = getLocalTimezone();
    const dt = DateTime.fromJSDate(date, { zone: 'UTC' }).setZone(localZone);
    const localDate = dt.toJSDate();
    
    console.log(`[CreateGoal] formatDateByCalendar: UTC=${date.toISOString()} -> Local(${localZone})=${dt.toISO()}`);
    
    if (calendarType === 'Gregorian') {
      return dt.toFormat('MMMM d, yyyy');
    }
    
    if (calendarType === 'Hebrew') {
      try {
        const hdate = new HDate(localDate);
        const monthName = hdate.getMonthName();
        const day = hdate.getDate();
        const year = hdate.getFullYear();
        return `${day} ${monthName} ${year}`;
      } catch (error) {
        console.error('Error formatting Hebrew date:', error);
        return dt.toFormat('MMMM d, yyyy');
      }
    }
    
    // For alternative calendars, use Intl.DateTimeFormat
    const calendarMap: Record<CalendarType, string> = {
      'Gregorian': 'gregory',
      'Hebrew': 'hebrew',
      'Chinese': 'chinese',
      'Islamic': 'islamic',
    };
    
    const calendarId = calendarMap[calendarType];
    
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        calendar: calendarId,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: localZone,
      });
      return formatter.format(date);
    } catch (error) {
      console.error('Error formatting date with calendar:', calendarType, error);
      return dt.toFormat('MMMM d, yyyy');
    }
  } catch (error) {
    console.error('Error in formatDateByCalendar:', error);
    return date.toLocaleDateString();
  }
};

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
  
  // Removed old scheduling state - preparing for new Goal Scheduler format
  
  // Reward state
  const [rewardCurrencyId, setRewardCurrencyId] = useState<string | undefined>();
  const [rewardSuccesses, setRewardSuccesses] = useState<string>('');
  const [rewardAmount, setRewardAmount] = useState<string>('');
  
  // Consequence state
  const [consequenceCurrencyId, setConsequenceCurrencyId] = useState<string | undefined>();
  const [consequenceFailures, setConsequenceFailures] = useState<string>('');
  const [consequenceAmount, setConsequenceAmount] = useState<string>('');

  // Removed alarm state - preparing for new Goal Scheduler format

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
  // Removed scheduling picker state - preparing for new Goal Scheduler format
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');

  // Removed monthly weekday picker state - preparing for new Goal Scheduler format

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

      // Set calendar type based on user preferences
      if (preferences.alternativeCalendar) {
        const calendarMap: Record<string, CalendarType> = {
          'gregorian': 'Gregorian',
          'hebrew': 'Hebrew',
          'chinese': 'Chinese',
          'islamic': 'Islamic',
        };
        setCalendarType(calendarMap[preferences.alternativeCalendar] || 'Gregorian');
      }
      
      // Log timezone info for debugging
      const deviceTimezone = getLocalTimezone();
      const storedTimezone = preferences.timezone;
      console.log('[CreateGoal] Timezone info:', {
        device: deviceTimezone,
        stored: storedTimezone,
        calendar: preferences.alternativeCalendar,
      });

      if (preselectedLifeAreaId && !editingGoalId) {
        console.log('[CreateGoal] Pre-selecting life area:', preselectedLifeAreaId);
        setLifeAreaId(preselectedLifeAreaId);
      }

      if (editingGoalId && goalDetailsData) {
        const goalDetails = goalDetailsData?.data || goalDetailsData;
        console.log('[API] Goal details loaded for editing:', JSON.stringify(goalDetails, null, 2));
        
        setTitle(goalDetails.title || '');
        setDescription(goalDetails.description || '');
        // Backend uses camelCase for these fields
        setParentGoalId(goalDetails.parentGoalId || goalDetails.parent_goal_id);
        setLifeAreaId(goalDetails.lifeAreaId || goalDetails.life_area_id);
        setBehaviorCategories(goalDetails.behaviorCategories || goalDetails.behavior_categories || []);
        setType(goalDetails.type || 'Proactive');
        setStrategyIds(goalDetails.strategyIds || goalDetails.strategy_ids || []);
        
        // scheduleType: prefer scheduleType, fall back to scheduleRecurrenceType (capitalize first letter)
        const rawScheduleType = goalDetails.scheduleType || goalDetails.schedule_type;
        const rawRecurrenceType = goalDetails.scheduleRecurrenceType || goalDetails.schedule_recurrence_type;
        let resolvedScheduleType: ScheduleType = 'Always Active';
        if (rawScheduleType) {
          resolvedScheduleType = rawScheduleType as ScheduleType;
        } else if (rawRecurrenceType) {
          // Convert 'daily' -> 'Daily', 'weekly' -> 'Weekly', etc.
          resolvedScheduleType = (rawRecurrenceType.charAt(0).toUpperCase() + rawRecurrenceType.slice(1)) as ScheduleType;
        }
        setScheduleType(resolvedScheduleType);
        setScheduleTimesPerDay((goalDetails.scheduleTimesPerDay || goalDetails.schedule_times_per_day)?.toString() || '');
        
        // Removed old scheduling data loading - preparing for new Goal Scheduler format
        
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
        
        // Removed alarm loading - preparing for new Goal Scheduler format
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

  // Removed old scheduling helper functions - preparing for new Goal Scheduler format

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
        // Removed old scheduling fields - preparing for new Goal Scheduler format
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

  // Removed getAvailableCalendarTypes - preparing for new Goal Scheduler format

  const screenTitle = editingGoalId ? 'Edit Goal' : 'Create Goal';
  const submitButtonTitle = editingGoalId ? 'Update Goal' : 'Create Goal';
  const rewardActionText = getRewardActionText();
  const consequenceActionText = getConsequenceActionText();

  // Removed getScheduleSummary - preparing for new Goal Scheduler format

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

        {/* Goal Schedule - Simplified for new scheduler */}
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

        {/* Removed Schedule Preview - preparing for new Goal Scheduler format */}

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

      {/* Removed old scheduling modals - preparing for new Goal Scheduler format */}

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

      {/* Removed Alarm Modal - preparing for new Goal Scheduler format */}

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
                  setWeekendsOnly(false);
                  setWeekdaysOnly(false);
                  setSelectedFortnightDays([]);
                  setFortnightEvenOdd('');
                  setMonthlyType('date');
                  setMonthlyDates([]);
                  setMonthlyWeekdayRules([]);
                  setMonthlyRandomCount('');
                  setMonthlyRangeStart('');
                  setMonthlyRangeEnd('');
                  setYearlyDates([]);
                  setCalendarType('Gregorian');
                  setExclusionDates([]);
                  setSpecificTimes([]);
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
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  advancedToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  advancedSection: {
    marginTop: 12,
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exclusionsList: {
    gap: 8,
    marginVertical: 12,
  },
  exclusionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exclusionText: {
    fontSize: 14,
    color: colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.card,
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
});
