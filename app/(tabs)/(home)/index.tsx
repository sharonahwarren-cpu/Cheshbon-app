
import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { authenticatedGet, authenticatedPost, authenticatedDelete } from "@/utils/api";

interface CurrencyBalance {
  currencyId: string;
  currencyName: string;
  symbol: string;
  totalBalance: number;
  goalBreakdown?: Array<{ goalId: string; goalTitle: string; balance: number }>;
}

interface WinsVsLosses {
  wins: number;
  losses: number;
  totalReflections: number;
}

interface SuccessVsStruggles {
  successes: number;
  struggles: number;
  total: number;
}

interface ReflectionStats {
  totalReflections: number;
  totalRestraints: number;
  totalProactive: number;
  worthItPercentage: number;
}

interface JournalCount {
  count: number;
}

interface GainsLossesSummary {
  totalGains: number;
  totalLosses: number;
  byCategory: Array<{ category: string; gains: number; losses: number }>;
  topGains: Array<{ id: string; name: string; count: number }>;
  topLosses: Array<{ id: string; name: string; count: number }>;
}

interface BehaviorCounts {
  actionEntries: number;
  speechEntries: number;
  thoughtEntries: number;
}

interface GoalProgress {
  goalId: string;
  goalTitle: string;
  progress: number;
  successCount: number;
  struggleCount: number;
  rewardCurrencyBalance?: number;
  rewardCurrencySymbol?: string;
  consequenceCurrencyBalance?: number;
  consequenceCurrencySymbol?: string;
}

interface DailyEntry {
  id: string;
  type: 'success' | 'struggle';
  timestamp: string;
}

interface LifeArea {
  id: string;
  name: string;
  parentId?: string;
  level: number;
}

interface ActivatedGoal {
  id: string;
  title: string;
  description?: string;
  type: 'RESTRAINING' | 'PROACTIVE';
  lifeArea?: { id: string; name: string; parentId?: string; level: number };
  subCategory?: string;
  behaviorCategories: string[];
  todaySuccessCount: number;
  todayStruggleCount: number;
  dailyEntries?: DailyEntry[];
  successCount: number;
  struggleCount: number;
  rewardCurrencyId?: string;
  rewardSuccesses?: number;
  rewardAmount?: number;
  consequenceCurrencyId?: string;
  consequenceFailures?: number;
  consequenceAmount?: number;
}

interface CategoryGroup {
  name: string;
  id: string;
  level: number;
  subCategories: Record<string, CategoryGroup>;
  goals: ActivatedGoal[];
}

interface Currency {
  id: string;
  name: string;
  symbol?: string;
  onSuccess?: 'ADD' | 'SUBTRACT' | 'NONE';
  onFailure?: 'ADD' | 'SUBTRACT' | 'NONE';
}

export default function HomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [activeTab, setActiveTab] = useState<'reports' | 'express'>('reports');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [currencyBalances, setCurrencyBalances] = useState<CurrencyBalance[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [winsVsLosses, setWinsVsLosses] = useState<WinsVsLosses | null>(null);
  const [successVsStruggles, setSuccessVsStruggles] = useState<SuccessVsStruggles | null>(null);
  const [reflectionStats, setReflectionStats] = useState<ReflectionStats | null>(null);
  const [journalCount, setJournalCount] = useState<JournalCount | null>(null);
  const [gainsLossesSummary, setGainsLossesSummary] = useState<GainsLossesSummary | null>(null);
  const [behaviorCounts, setBehaviorCounts] = useState<BehaviorCounts | null>(null);
  const [goalProgress, setGoalProgress] = useState<GoalProgress[]>([]);
  
  const [activatedGoals, setActivatedGoals] = useState<ActivatedGoal[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<Record<string, CategoryGroup>>({});
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [currencyModalType, setCurrencyModalType] = useState<'claim' | 'pay'>('claim');
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>('');
  const [selectedCurrencyName, setSelectedCurrencyName] = useState<string>('');
  const [selectedCurrencySymbol, setSelectedCurrencySymbol] = useState<string>('');
  const [currencyModalAmount, setCurrencyModalAmount] = useState<string>('');
  const [currencyModalMaxAmount, setCurrencyModalMaxAmount] = useState<number>(0);
  const [currencyModalLoading, setCurrencyModalLoading] = useState(false);
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');
  
  const [showQuickReflectionModal, setShowQuickReflectionModal] = useState(false);
  const [quickReflectionGoalId, setQuickReflectionGoalId] = useState<string | undefined>();
  const [quickReflectionStep, setQuickReflectionStep] = useState(1);
  const [quickReflectionOutcome, setQuickReflectionOutcome] = useState<'success' | 'struggled' | undefined>();
  const [quickReflectionDescription, setQuickReflectionDescription] = useState('');
  const [quickReflectionWorthIt, setQuickReflectionWorthIt] = useState<boolean | undefined>();
  const [quickReflectionThoughts, setQuickReflectionThoughts] = useState('');

  useEffect(() => {
    console.log("HomeScreen mounted");
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'express') {
      console.log("Selected date changed, reloading express data:", selectedDate);
      loadExpressData();
    }
  }, [selectedDate]);

  useEffect(() => {
    if (params.fromReflection === 'true') {
      console.log("Returned from reflection, switching to Express tab");
      setActiveTab('express');
      router.setParams({ fromReflection: undefined });
    }
  }, [params.fromReflection]);

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const showSuccess = (message: string) => {
    setSuccessModalMessage(message);
    setShowSuccessModal(true);
    setTimeout(() => {
      setShowSuccessModal(false);
    }, 2000);
  };

  const loadData = async () => {
    console.log("Loading home screen data");
    setLoading(true);
    try {
      if (activeTab === 'reports') {
        await loadReportsData();
      } else {
        await loadExpressData();
      }
    } catch (error: any) {
      console.error("Error loading data:", error);
      showError(error.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadReportsData = async () => {
    console.log("Loading reports data");
    try {
      const [
        currencyRes,
        currenciesRes,
        winsLossesRes,
        successStrugglesRes,
        reflectionStatsRes,
        journalCountRes,
        gainsLossesRes,
        behaviorCountsRes,
        goalProgressRes,
      ] = await Promise.all([
        authenticatedGet('/api/reports/currency-balances'),
        authenticatedGet('/api/currencies'),
        authenticatedGet('/api/reports/wins-vs-losses'),
        authenticatedGet('/api/reports/success-vs-struggles'),
        authenticatedGet('/api/reports/reflection-stats'),
        authenticatedGet('/api/reports/journal-count'),
        authenticatedGet('/api/reports/gains-losses-summary'),
        authenticatedGet('/api/reports/behavior-counts'),
        authenticatedGet('/api/reports/goal-progress'),
      ]);

      const currencyData = Array.isArray(currencyRes) ? currencyRes : (currencyRes?.data || []);
      const currenciesData = Array.isArray(currenciesRes) ? currenciesRes : (currenciesRes?.data || []);
      const winsLossesData = winsLossesRes?.data || winsLossesRes || null;
      const successStrugglesData = successStrugglesRes?.data || successStrugglesRes || null;
      const reflectionStatsData = reflectionStatsRes?.data || reflectionStatsRes || null;
      const journalCountData = journalCountRes?.data || journalCountRes || null;
      const gainsLossesData = gainsLossesRes?.data || gainsLossesRes || null;
      const behaviorCountsData = behaviorCountsRes?.data || behaviorCountsRes || null;
      const goalProgressData = Array.isArray(goalProgressRes) ? goalProgressRes : (goalProgressRes?.data || []);

      setCurrencyBalances(currencyData);
      setCurrencies(currenciesData);
      setWinsVsLosses(winsLossesData);
      setSuccessVsStruggles(successStrugglesData);
      setReflectionStats(reflectionStatsData);
      setJournalCount(journalCountData);
      setGainsLossesSummary(gainsLossesData);
      setBehaviorCounts(behaviorCountsData);
      setGoalProgress(goalProgressData);

      console.log("Reports data loaded successfully with currency balances");
    } catch (error) {
      console.error("Error loading reports data:", error);
      throw error;
    }
  };

  const loadExpressData = async () => {
    console.log("Loading express data (activated goals) for date:", selectedDate.toISOString());
    try {
      const dateString = selectedDate.toISOString().split('T')[0];
      const goalsRes = await authenticatedGet(`/api/goals/activated-today?date=${dateString}`);
      const goalsData = Array.isArray(goalsRes) ? goalsRes : (goalsRes?.data || []);
      
      setActivatedGoals(goalsData);
      
      const groups: Record<string, CategoryGroup> = {};
      
      goalsData.forEach((goal: ActivatedGoal) => {
        if (!goal.lifeArea) {
          if (!groups['Uncategorized']) {
            groups['Uncategorized'] = {
              name: 'Uncategorized',
              id: 'uncategorized',
              level: 0,
              subCategories: {},
              goals: [],
            };
          }
          groups['Uncategorized'].goals.push(goal);
          return;
        }

        const lifeArea = goal.lifeArea;
        const categoryKey = lifeArea.id;
        
        if (lifeArea.level === 1 || !lifeArea.parentId) {
          if (!groups[categoryKey]) {
            groups[categoryKey] = {
              name: lifeArea.name,
              id: lifeArea.id,
              level: lifeArea.level,
              subCategories: {},
              goals: [],
            };
          }
          groups[categoryKey].goals.push(goal);
        } else {
          const parentId = lifeArea.parentId;
          
          if (!groups[parentId]) {
            groups[parentId] = {
              name: 'Parent Category',
              id: parentId,
              level: 1,
              subCategories: {},
              goals: [],
            };
          }
          
          if (!groups[parentId].subCategories[categoryKey]) {
            groups[parentId].subCategories[categoryKey] = {
              name: lifeArea.name,
              id: lifeArea.id,
              level: lifeArea.level,
              subCategories: {},
              goals: [],
            };
          }
          groups[parentId].subCategories[categoryKey].goals.push(goal);
        }
      });
      
      const sortedGroups: Record<string, CategoryGroup> = {};
      const categoryKeys = Object.keys(groups).sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return groups[a].name.localeCompare(groups[b].name);
      });
      
      categoryKeys.forEach(key => {
        sortedGroups[key] = groups[key];
      });
      
      setCategoryGroups(sortedGroups);
      console.log("Express data loaded successfully with nested categories:", sortedGroups);
    } catch (error) {
      console.error("Error loading express data:", error);
      throw error;
    }
  };

  const handleGoalSuccess = async (goalId: string) => {
    console.log("Recording success for goal:", goalId);
    try {
      const timestamp = new Date(selectedDate).toISOString();
      await authenticatedPost(`/api/goals/${goalId}/success`, { timestamp });
      await loadExpressData();
    } catch (error: any) {
      console.error("Error recording success:", error);
      showError(error.message || "Failed to record success");
    }
  };

  const handleGoalStruggle = async (goalId: string) => {
    console.log("Recording struggle for goal:", goalId);
    try {
      const timestamp = new Date(selectedDate).toISOString();
      await authenticatedPost(`/api/goals/${goalId}/struggle`, { timestamp });
      await loadExpressData();
    } catch (error: any) {
      console.error("Error recording struggle:", error);
      showError(error.message || "Failed to record struggle");
    }
  };

  const handleDeleteEntry = async (goalId: string, entryId: string) => {
    console.log("Deleting entry:", entryId, "for goal:", goalId);
    try {
      await authenticatedDelete(`/api/goals/${goalId}/entries/${entryId}`);
      await loadExpressData();
    } catch (error: any) {
      console.error("Error deleting entry:", error);
      showError(error.message || "Failed to delete entry");
    }
  };

  const handleEditGoal = (goalId: string) => {
    console.log("Opening goal editor for:", goalId);
    router.push(`/create-goal?id=${goalId}`);
  };

  const handleQuickReflection = (goalId: string, entryId?: string) => {
    console.log("Opening quick reflection modal for goal:", goalId, "entry:", entryId);
    setQuickReflectionGoalId(goalId);
    setQuickReflectionStep(1);
    setQuickReflectionOutcome(undefined);
    setQuickReflectionDescription('');
    setQuickReflectionWorthIt(undefined);
    setQuickReflectionThoughts('');
    setShowQuickReflectionModal(true);
  };

  const handleQuickReflectionNext = () => {
    if (quickReflectionStep < 5) {
      setQuickReflectionStep(quickReflectionStep + 1);
    }
  };

  const handleQuickReflectionBack = () => {
    if (quickReflectionStep > 1) {
      setQuickReflectionStep(quickReflectionStep - 1);
    }
  };

  const handleQuickReflectionSave = async () => {
    console.log("Saving quick reflection");
    setShowQuickReflectionModal(false);
    
    const dateString = selectedDate.toISOString().split('T')[0];
    const params: any = {
      goalId: quickReflectionGoalId,
      date: dateString,
      fromExpress: 'true',
    };
    
    if (quickReflectionOutcome) {
      params.outcome = quickReflectionOutcome;
    }
    if (quickReflectionDescription) {
      params.description = quickReflectionDescription;
    }
    
    router.push({
      pathname: '/(tabs)/reflect',
      params,
    });
  };

  const toggleCategory = (categoryKey: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey],
    }));
  };

  const handleReflection = (goalId?: string) => {
    console.log("Opening reflection screen", goalId ? `for goal: ${goalId}` : "");
    const dateString = selectedDate.toISOString().split('T')[0];
    const params: any = { 
      date: dateString,
      fromExpress: 'true'
    };
    if (goalId) {
      params.goalId = goalId;
    }
    router.push({
      pathname: '/(tabs)/reflect',
      params,
    });
  };

  const handlePreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const formatDateDisplay = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    const diffTime = compareDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays === 1) return 'Tomorrow';
    
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const isRewardCurrency = (currency: Currency): boolean => {
    return currency.onSuccess === 'ADD';
  };

  const openCurrencyModal = (currencyId: string, currencyName: string, currencySymbol: string, balance: number, type: 'claim' | 'pay') => {
    console.log("Opening currency modal:", type, currencyName, balance);
    setSelectedCurrencyId(currencyId);
    setSelectedCurrencyName(currencyName);
    setSelectedCurrencySymbol(currencySymbol);
    setCurrencyModalType(type);
    setCurrencyModalMaxAmount(Math.abs(balance));
    setCurrencyModalAmount(Math.abs(balance).toString());
    setShowCurrencyModal(true);
  };

  const handleCurrencyAction = async () => {
    console.log("Handling currency action:", currencyModalType, selectedCurrencyName, currencyModalAmount);
    
    const amount = parseFloat(currencyModalAmount);
    if (isNaN(amount) || amount <= 0) {
      showError('Please enter a valid amount');
      return;
    }
    
    if (amount > currencyModalMaxAmount) {
      showError(`Amount cannot exceed ${currencyModalMaxAmount}`);
      return;
    }
    
    setCurrencyModalLoading(true);
    try {
      const endpoint = currencyModalType === 'claim' 
        ? `/api/currencies/${selectedCurrencyId}/claim`
        : `/api/currencies/${selectedCurrencyId}/pay`;
      
      const response = await authenticatedPost(endpoint, { amount });
      
      setShowCurrencyModal(false);
      setCurrencyModalAmount('');
      
      const actionText = currencyModalType === 'claim' ? 'claimed' : 'paid';
      showSuccess(`Successfully ${actionText} ${amount} ${selectedCurrencySymbol}`);
      
      await loadReportsData();
    } catch (error: any) {
      console.error("Error processing currency action:", error);
      showError(error.message || `Failed to ${currencyModalType} currency`);
    } finally {
      setCurrencyModalLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderGoalCard = (goal: ActivatedGoal) => {
    const typeIcon = goal.type === 'RESTRAINING' ? 'cancel' : 'check-circle';
    const typeColor = goal.type === 'RESTRAINING' ? colors.error : colors.success;
    
    const dailySuccessEntries = goal.dailyEntries?.filter(e => e.type === 'success') || [];
    const dailyStruggleEntries = goal.dailyEntries?.filter(e => e.type === 'struggle') || [];
    const successCount = dailySuccessEntries.length;
    const struggleCount = dailyStruggleEntries.length;
    
    const hasDescription = goal.description && goal.description.trim().length > 0;
    
    const rewardMessage = (() => {
      if (!goal.rewardCurrencyId || !goal.rewardSuccesses || !goal.rewardAmount) return null;
      const currency = currencies.find(c => c.id === goal.rewardCurrencyId);
      if (!currency) return null;
      
      const totalSuccesses = goal.successCount || 0;
      const remaining = goal.rewardSuccesses - (totalSuccesses % goal.rewardSuccesses);
      const symbol = currency.symbol || currency.name;
      
      return `${remaining} more ${remaining === 1 ? 'success' : 'successes'} until ${goal.rewardAmount} ${symbol}`;
    })();
    
    const consequenceMessage = (() => {
      if (!goal.consequenceCurrencyId || !goal.consequenceFailures || !goal.consequenceAmount) return null;
      const currency = currencies.find(c => c.id === goal.consequenceCurrencyId);
      if (!currency) return null;
      
      const totalStruggles = goal.struggleCount || 0;
      const remaining = goal.consequenceFailures - (totalStruggles % goal.consequenceFailures);
      const symbol = currency.symbol || currency.name;
      
      return `${remaining} more ${remaining === 1 ? 'struggle' : 'struggles'} until ${goal.consequenceAmount} ${symbol}`;
    })();
    
    return (
      <View key={goal.id} style={styles.goalCard}>
        <TouchableOpacity 
          style={styles.goalTitleRow}
          onPress={() => handleEditGoal(goal.id)}
        >
          <IconSymbol
            ios_icon_name={goal.type === 'RESTRAINING' ? 'xmark.circle.fill' : 'checkmark.circle.fill'}
            android_material_icon_name={typeIcon}
            size={20}
            color={typeColor}
          />
          <View style={styles.goalTitleContainer}>
            <Text style={styles.goalCardTitle}>{goal.title}</Text>
            {hasDescription && (
              <Text style={styles.goalDescription} numberOfLines={2}>
                {goal.description}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        
        <View style={styles.tallyRow}>
          <View style={styles.tallySection}>
            <Text style={[styles.tallyCount, { color: colors.success }]}>{successCount}</Text>
            <IconSymbol
              ios_icon_name="checkmark"
              android_material_icon_name="check"
              size={16}
              color={colors.success}
            />
          </View>
          <View style={styles.tallySection}>
            <Text style={[styles.tallyCount, { color: colors.error }]}>{struggleCount}</Text>
            <IconSymbol
              ios_icon_name="xmark"
              android_material_icon_name="close"
              size={16}
              color={colors.error}
            />
          </View>
        </View>
        
        {(rewardMessage || consequenceMessage) && (
          <View style={styles.currencyProgressContainer}>
            {rewardMessage && (
              <View style={styles.currencyProgressRow}>
                <IconSymbol
                  ios_icon_name="gift.fill"
                  android_material_icon_name="card-giftcard"
                  size={14}
                  color={colors.success}
                />
                <Text style={styles.currencyProgressText}>{rewardMessage}</Text>
              </View>
            )}
            {consequenceMessage && (
              <View style={styles.currencyProgressRow}>
                <IconSymbol
                  ios_icon_name="exclamationmark.triangle.fill"
                  android_material_icon_name="warning"
                  size={14}
                  color={colors.error}
                />
                <Text style={styles.currencyProgressText}>{consequenceMessage}</Text>
              </View>
            )}
          </View>
        )}
        
        {goal.dailyEntries && goal.dailyEntries.length > 0 && (
          <View style={styles.entriesContainer}>
            {goal.dailyEntries.map((entry) => {
              const isSuccess = entry.type === 'success';
              const entryColor = isSuccess ? colors.success : colors.error;
              const entryIcon = isSuccess ? 'check' : 'close';
              
              return (
                <TouchableOpacity
                  key={entry.id}
                  style={[styles.entryBadge, { borderColor: entryColor }]}
                  onPress={() => handleQuickReflection(goal.id, entry.id)}
                >
                  <IconSymbol
                    ios_icon_name={isSuccess ? 'checkmark' : 'xmark'}
                    android_material_icon_name={entryIcon}
                    size={12}
                    color={entryColor}
                  />
                  <TouchableOpacity
                    style={styles.deleteEntryButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteEntry(goal.id, entry.id);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="xmark"
                      android_material_icon_name="close"
                      size={10}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.successButton]}
            onPress={() => handleGoalSuccess(goal.id)}
          >
            <IconSymbol
              ios_icon_name="checkmark"
              android_material_icon_name="check"
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.actionButtonText}>Success</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.struggleButton]}
            onPress={() => handleGoalStruggle(goal.id)}
          >
            <IconSymbol
              ios_icon_name="xmark"
              android_material_icon_name="close"
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.actionButtonText}>Struggle</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.reflectionButton]}
            onPress={() => handleQuickReflection(goal.id)}
          >
            <IconSymbol
              ios_icon_name="note.text"
              android_material_icon_name="edit"
              size={18}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCategoryGroup = (group: CategoryGroup, depth: number = 0): React.ReactNode => {
    const isCollapsed = collapsedCategories[group.id];
    const totalGoals = group.goals.length + 
      Object.values(group.subCategories).reduce((sum, subGroup) => {
        return sum + subGroup.goals.length + 
          Object.values(subGroup.subCategories).reduce((subSum, subSubGroup) => subSum + subSubGroup.goals.length, 0);
      }, 0);
    
    return (
      <View key={group.id} style={[styles.categorySection, { marginLeft: depth * 16 }]}>
        <TouchableOpacity 
          style={styles.categoryHeader}
          onPress={() => toggleCategory(group.id)}
        >
          <View style={styles.categoryTitleRow}>
            <IconSymbol
              ios_icon_name={isCollapsed ? 'chevron.right' : 'chevron.down'}
              android_material_icon_name={isCollapsed ? 'arrow-forward' : 'arrow-downward'}
              size={20}
              color={colors.text}
            />
            <Text style={styles.categoryTitle}>{group.name}</Text>
          </View>
          <Text style={styles.categoryCount}>{totalGoals}</Text>
        </TouchableOpacity>
        
        {!isCollapsed && (
          <>
            {Object.values(group.subCategories).sort((a, b) => a.name.localeCompare(b.name)).map(subGroup => 
              renderCategoryGroup(subGroup, depth + 1)
            )}
            
            {group.goals.map(goal => renderGoalCard(goal))}
          </>
        )}
      </View>
    );
  };

  const tabLabel = activeTab === 'reports' ? 'Reports' : 'Express';
  const dateDisplay = formatDateDisplay(selectedDate);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cheshbon</Text>
        <Text style={styles.headerSubtitle}>Your personal growth companion</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.tabActive]}
          onPress={() => {
            console.log("Switching to reports tab");
            setActiveTab('reports');
          }}
        >
          <IconSymbol
            ios_icon_name="chart.bar.fill"
            android_material_icon_name="assessment"
            size={20}
            color={activeTab === 'reports' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>
            Reports
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'express' && styles.tabActive]}
          onPress={() => {
            console.log("Switching to express tab");
            setActiveTab('express');
          }}
        >
          <IconSymbol
            ios_icon_name="bolt.fill"
            android_material_icon_name="flash-on"
            size={20}
            color={activeTab === 'express' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'express' && styles.tabTextActive]}>
            Express
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'express' && (
        <View style={styles.dateNavigator}>
          <TouchableOpacity 
            style={styles.dateNavButton}
            onPress={handlePreviousDay}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
          
          <Text style={styles.dateDisplay}>{dateDisplay}</Text>
          
          <TouchableOpacity 
            style={styles.dateNavButton}
            onPress={handleNextDay}
          >
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeTab === 'reports' ? (
          <>
            {currencyBalances.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Total Currency Balances</Text>
                {currencyBalances.map((balance, index) => {
                  const symbolText = balance.symbol || '';
                  const totalBalanceText = `${balance.totalBalance}`;
                  const totalBalanceColor = balance.totalBalance >= 0 ? colors.success : colors.error;
                  const currency = currencies.find(c => c.id === balance.currencyId);
                  
                  let buttonType: 'claim' | 'pay' = 'claim';
                  if (balance.totalBalance > 0) {
                    buttonType = (currency && isRewardCurrency(currency)) ? 'claim' : 'pay';
                  } else if (balance.totalBalance < 0) {
                    buttonType = (currency && isRewardCurrency(currency)) ? 'pay' : 'claim';
                  }
                  
                  const buttonText = buttonType === 'claim' ? 'Claim' : 'Pay';
                  const buttonIcon = buttonType === 'claim' ? 'download' : 'upload';
                  const buttonIosIcon = buttonType === 'claim' ? 'arrow.down.circle.fill' : 'arrow.up.circle.fill';
                  
                  return (
                    <View key={index} style={styles.reportCard}>
                      <View style={styles.reportHeader}>
                        <Text style={styles.reportTitle}>{balance.currencyName}</Text>
                        {symbolText && <Text style={styles.reportSymbol}>{symbolText}</Text>}
                      </View>
                      <View style={styles.reportRow}>
                        <Text style={styles.reportLabel}>Total Balance:</Text>
                        <Text style={[styles.reportValue, { color: totalBalanceColor }]}>
                          {totalBalanceText}
                        </Text>
                      </View>
                      
                      {balance.totalBalance !== 0 && (
                        <TouchableOpacity
                          style={[styles.currencyActionButton, buttonType === 'claim' ? styles.claimButton : styles.payButton]}
                          onPress={() => openCurrencyModal(balance.currencyId, balance.currencyName, symbolText, balance.totalBalance, buttonType)}
                        >
                          <IconSymbol
                            ios_icon_name={buttonIosIcon}
                            android_material_icon_name={buttonIcon}
                            size={18}
                            color={colors.background}
                          />
                          <Text style={styles.currencyActionButtonText}>{buttonText}</Text>
                        </TouchableOpacity>
                      )}
                      
                      {balance.goalBreakdown && balance.goalBreakdown.length > 0 && (
                        <View style={styles.goalBreakdownSection}>
                          <Text style={styles.goalBreakdownTitle}>Per Goal:</Text>
                          {balance.goalBreakdown.map((goalBalance, idx) => {
                            const goalBalanceText = `${goalBalance.balance}`;
                            const goalBalanceColor = goalBalance.balance >= 0 ? colors.success : colors.error;
                            
                            return (
                              <View key={idx} style={styles.goalBreakdownRow}>
                                <Text style={styles.goalBreakdownGoal}>{goalBalance.goalTitle}</Text>
                                <Text style={[styles.goalBreakdownBalance, { color: goalBalanceColor }]}>
                                  {symbolText}{goalBalanceText}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                      
                      <TouchableOpacity 
                        style={styles.drillDownHint}
                        onPress={() => {
                          console.log("Navigating to currency reflections for:", balance.currencyId);
                          router.push(`/currency-reflections?currencyId=${balance.currencyId}`);
                        }}
                      >
                        <IconSymbol
                          ios_icon_name="chevron.right"
                          android_material_icon_name="arrow-forward"
                          size={16}
                          color={colors.primary}
                        />
                        <Text style={styles.drillDownText}>Tap to view related reflections</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}

            {winsVsLosses && (
              <>
                <Text style={styles.sectionTitle}>Wins vs Losses</Text>
                <TouchableOpacity 
                  style={styles.reportCard}
                  onPress={() => {
                    console.log("Navigating to reflections");
                    router.push('/(tabs)/reflect');
                  }}
                >
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Wins:</Text>
                    <Text style={[styles.reportValue, { color: colors.success }]}>
                      {winsVsLosses.wins}
                    </Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Losses:</Text>
                    <Text style={[styles.reportValue, { color: colors.error }]}>
                      {winsVsLosses.losses}
                    </Text>
                  </View>
                  <View style={styles.drillDownHint}>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="arrow-forward"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.drillDownText}>Tap to view reflections</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {successVsStruggles && (
              <>
                <Text style={styles.sectionTitle}>Success vs Struggles</Text>
                <TouchableOpacity 
                  style={styles.reportCard}
                  onPress={() => {
                    console.log("Navigating to reflections");
                    router.push('/(tabs)/reflect');
                  }}
                >
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Successes:</Text>
                    <Text style={[styles.reportValue, { color: colors.success }]}>
                      {successVsStruggles.successes}
                    </Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Struggles:</Text>
                    <Text style={[styles.reportValue, { color: colors.error }]}>
                      {successVsStruggles.struggles}
                    </Text>
                  </View>
                  <View style={styles.drillDownHint}>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="arrow-forward"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.drillDownText}>Tap to view reflections</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {reflectionStats && (
              <>
                <Text style={styles.sectionTitle}>Reflection Statistics</Text>
                <TouchableOpacity 
                  style={styles.reportCard}
                  onPress={() => {
                    console.log("Navigating to reflections");
                    router.push('/(tabs)/reflect');
                  }}
                >
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Total Reflections:</Text>
                    <Text style={styles.reportValue}>{reflectionStats.totalReflections}</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Restraints:</Text>
                    <Text style={styles.reportValue}>{reflectionStats.totalRestraints}</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Proactive:</Text>
                    <Text style={styles.reportValue}>{reflectionStats.totalProactive}</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Worth It %:</Text>
                    <Text style={[styles.reportValue, { color: colors.primary }]}>
                      {reflectionStats.worthItPercentage}%
                    </Text>
                  </View>
                  <View style={styles.drillDownHint}>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="arrow-forward"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.drillDownText}>Tap to view reflections</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {journalCount && (
              <>
                <Text style={styles.sectionTitle}>Journal Entries</Text>
                <View style={styles.reportCard}>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Total Entries:</Text>
                    <Text style={styles.reportValue}>{journalCount.count}</Text>
                  </View>
                </View>
              </>
            )}

            {gainsLossesSummary && (
              <>
                <Text style={styles.sectionTitle}>Gains and Losses</Text>
                <TouchableOpacity 
                  style={styles.reportCard}
                  onPress={() => {
                    console.log("Navigating to reflections");
                    router.push('/(tabs)/reflect');
                  }}
                >
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Total Gains:</Text>
                    <Text style={[styles.reportValue, { color: colors.success }]}>
                      {gainsLossesSummary.totalGains}
                    </Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Total Losses:</Text>
                    <Text style={[styles.reportValue, { color: colors.error }]}>
                      {gainsLossesSummary.totalLosses}
                    </Text>
                  </View>
                  
                  {gainsLossesSummary.topGains.length > 0 && (
                    <>
                      <Text style={styles.reportSubtitle}>Top 3 Gains:</Text>
                      {gainsLossesSummary.topGains.map((gain, idx) => {
                        const countText = `${gain.count}x`;
                        
                        return (
                          <View key={idx} style={styles.reportRow}>
                            <Text style={styles.reportLabel}>{gain.name}:</Text>
                            <Text style={styles.reportValue}>{countText}</Text>
                          </View>
                        );
                      })}
                    </>
                  )}
                  
                  {gainsLossesSummary.topLosses.length > 0 && (
                    <>
                      <Text style={styles.reportSubtitle}>Top 3 Losses:</Text>
                      {gainsLossesSummary.topLosses.map((loss, idx) => {
                        const countText = `${loss.count}x`;
                        
                        return (
                          <View key={idx} style={styles.reportRow}>
                            <Text style={styles.reportLabel}>{loss.name}:</Text>
                            <Text style={styles.reportValue}>{countText}</Text>
                          </View>
                        );
                      })}
                    </>
                  )}
                  <View style={styles.drillDownHint}>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="arrow-forward"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.drillDownText}>Tap to view reflections</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {behaviorCounts && (
              <>
                <Text style={styles.sectionTitle}>Behavior Entries</Text>
                <TouchableOpacity 
                  style={styles.reportCard}
                  onPress={() => {
                    console.log("Navigating to reflections");
                    router.push('/(tabs)/reflect');
                  }}
                >
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Action Entries:</Text>
                    <Text style={styles.reportValue}>{behaviorCounts.actionEntries}</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Speech Entries:</Text>
                    <Text style={styles.reportValue}>{behaviorCounts.speechEntries}</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Thought Entries:</Text>
                    <Text style={styles.reportValue}>{behaviorCounts.thoughtEntries}</Text>
                  </View>
                  <View style={styles.drillDownHint}>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="arrow-forward"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.drillDownText}>Tap to view reflections</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {goalProgress.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Goal Progress</Text>
                {goalProgress.map((goal, index) => {
                  const progressText = `${goal.progress || 0}%`;
                  const successText = `${goal.successCount} successes`;
                  const struggleText = `${goal.struggleCount} struggles`;
                  
                  const hasRewardBalance = goal.rewardCurrencyBalance !== undefined && goal.rewardCurrencyBalance !== null;
                  const hasConsequenceBalance = goal.consequenceCurrencyBalance !== undefined && goal.consequenceCurrencyBalance !== null;
                  
                  return (
                    <TouchableOpacity 
                      key={index} 
                      style={styles.reportCard}
                      onPress={() => {
                        console.log("Navigating to reflections for goal:", goal.goalId);
                        router.push({
                          pathname: '/(tabs)/reflect',
                          params: { goalId: goal.goalId },
                        });
                      }}
                    >
                      <Text style={styles.goalTitle}>{goal.goalTitle}</Text>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: progressText }]} />
                      </View>
                      <View style={styles.reportRow}>
                        <Text style={styles.reportLabel}>Progress:</Text>
                        <Text style={styles.reportValue}>{progressText}</Text>
                      </View>
                      <View style={styles.reportRow}>
                        <Text style={styles.reportLabel}>Successes:</Text>
                        <Text style={[styles.reportValue, { color: colors.success }]}>
                          {goal.successCount}
                        </Text>
                      </View>
                      <View style={styles.reportRow}>
                        <Text style={styles.reportLabel}>Struggles:</Text>
                        <Text style={[styles.reportValue, { color: colors.error }]}>
                          {goal.struggleCount}
                        </Text>
                      </View>
                      
                      {(hasRewardBalance || hasConsequenceBalance) && (
                        <View style={styles.currencySection}>
                          {hasRewardBalance && (
                            <View style={styles.reportRow}>
                              <Text style={styles.reportLabel}>Reward Balance:</Text>
                              <Text style={[styles.reportValue, { color: colors.success }]}>
                                {goal.rewardCurrencyBalance} {goal.rewardCurrencySymbol || ''}
                              </Text>
                            </View>
                          )}
                          {hasConsequenceBalance && (
                            <View style={styles.reportRow}>
                              <Text style={styles.reportLabel}>Consequence Balance:</Text>
                              <Text style={[styles.reportValue, { color: colors.error }]}>
                                {goal.consequenceCurrencyBalance} {goal.consequenceCurrencySymbol || ''}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                      
                      <View style={styles.drillDownHint}>
                        <IconSymbol
                          ios_icon_name="chevron.right"
                          android_material_icon_name="arrow-forward"
                          size={16}
                          color={colors.primary}
                        />
                        <Text style={styles.drillDownText}>Tap to view reflections</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {currencyBalances.length === 0 && !winsVsLosses && !successVsStruggles && (
              <View style={styles.emptyState}>
                <IconSymbol
                  ios_icon_name="chart.bar"
                  android_material_icon_name="assessment"
                  size={64}
                  color={colors.muted}
                />
                <Text style={styles.emptyStateTitle}>No data yet</Text>
                <Text style={styles.emptyStateText}>
                  Start tracking your goals and reflections to see reports here
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {Object.keys(categoryGroups).length === 0 ? (
              <View style={styles.emptyState}>
                <IconSymbol
                  ios_icon_name="bolt"
                  android_material_icon_name="flash-on"
                  size={64}
                  color={colors.muted}
                />
                <Text style={styles.emptyStateTitle}>No active goals today</Text>
                <Text style={styles.emptyStateText}>
                  Create goals in Settings to track them here
                </Text>
              </View>
            ) : (
              Object.values(categoryGroups).map(group => renderCategoryGroup(group))
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={showQuickReflectionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowQuickReflectionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.quickReflectionModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowQuickReflectionModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Quick Reflection</Text>
              <View style={{ width: 24 }} />
            </View>
            
            <View style={styles.stepIndicator}>
              <Text style={styles.stepText}>Step {quickReflectionStep} of 5</Text>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {quickReflectionStep === 1 && (
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>How did it go?</Text>
                  <TouchableOpacity
                    style={[styles.outcomeButton, quickReflectionOutcome === 'success' && styles.outcomeButtonSelected]}
                    onPress={() => setQuickReflectionOutcome('success')}
                  >
                    <IconSymbol
                      ios_icon_name="checkmark.circle.fill"
                      android_material_icon_name="check-circle"
                      size={24}
                      color={quickReflectionOutcome === 'success' ? '#FFFFFF' : colors.success}
                    />
                    <Text style={[styles.outcomeButtonText, quickReflectionOutcome === 'success' && styles.outcomeButtonTextSelected]}>
                      Success
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.outcomeButton, quickReflectionOutcome === 'struggled' && styles.outcomeButtonSelected]}
                    onPress={() => setQuickReflectionOutcome('struggled')}
                  >
                    <IconSymbol
                      ios_icon_name="xmark.circle.fill"
                      android_material_icon_name="cancel"
                      size={24}
                      color={quickReflectionOutcome === 'struggled' ? '#FFFFFF' : colors.error}
                    />
                    <Text style={[styles.outcomeButtonText, quickReflectionOutcome === 'struggled' && styles.outcomeButtonTextSelected]}>
                      Struggled
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {quickReflectionStep === 2 && (
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>What happened?</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Describe what happened..."
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={4}
                    value={quickReflectionDescription}
                    onChangeText={setQuickReflectionDescription}
                  />
                </View>
              )}
              
              {quickReflectionStep === 3 && (
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Was it worth it?</Text>
                  <TouchableOpacity
                    style={[styles.outcomeButton, quickReflectionWorthIt === true && styles.outcomeButtonSelected]}
                    onPress={() => setQuickReflectionWorthIt(true)}
                  >
                    <IconSymbol
                      ios_icon_name="checkmark.circle.fill"
                      android_material_icon_name="check-circle"
                      size={24}
                      color={quickReflectionWorthIt === true ? '#FFFFFF' : colors.success}
                    />
                    <Text style={[styles.outcomeButtonText, quickReflectionWorthIt === true && styles.outcomeButtonTextSelected]}>
                      Yes
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.outcomeButton, quickReflectionWorthIt === false && styles.outcomeButtonSelected]}
                    onPress={() => setQuickReflectionWorthIt(false)}
                  >
                    <IconSymbol
                      ios_icon_name="xmark.circle.fill"
                      android_material_icon_name="cancel"
                      size={24}
                      color={quickReflectionWorthIt === false ? '#FFFFFF' : colors.error}
                    />
                    <Text style={[styles.outcomeButtonText, quickReflectionWorthIt === false && styles.outcomeButtonTextSelected]}>
                      No
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {quickReflectionStep === 4 && (
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Additional thoughts?</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Any additional reflections..."
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={4}
                    value={quickReflectionThoughts}
                    onChangeText={setQuickReflectionThoughts}
                  />
                </View>
              )}
              
              {quickReflectionStep === 5 && (
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Complete your reflection</Text>
                  <Text style={styles.stepDescription}>
                    Continue to the full reflection screen to add more details like gains, losses, and strategies.
                  </Text>
                </View>
              )}
            </ScrollView>
            
            <View style={styles.modalFooter}>
              {quickReflectionStep > 1 && (
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={handleQuickReflectionBack}
                >
                  <Text style={styles.modalButtonText}>Back</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={quickReflectionStep < 5 ? handleQuickReflectionNext : handleQuickReflectionSave}
                disabled={quickReflectionStep === 1 && !quickReflectionOutcome}
              >
                <Text style={styles.modalButtonPrimaryText}>
                  {quickReflectionStep < 5 ? 'Next' : 'Continue to Full Reflection'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCurrencyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.currencyModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{currencyModalType === 'claim' ? 'Claim' : 'Pay'} {selectedCurrencyName}</Text>
              <View style={{ width: 24 }} />
            </View>
            
            <View style={styles.currencyModalContent}>
              <Text style={styles.currencyModalLabel}>Amount {selectedCurrencySymbol && `(${selectedCurrencySymbol})`}</Text>
              <TextInput
                style={styles.currencyModalInput}
                value={currencyModalAmount}
                onChangeText={setCurrencyModalAmount}
                placeholder="Enter amount"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
              <Text style={styles.currencyModalHelper}>
                Maximum: {currencyModalMaxAmount} {selectedCurrencySymbol}
              </Text>
              
              <View style={styles.quickAmountButtons}>
                <TouchableOpacity
                  style={styles.quickAmountButton}
                  onPress={() => setCurrencyModalAmount((currencyModalMaxAmount / 4).toFixed(2))}
                >
                  <Text style={styles.quickAmountButtonText}>25%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAmountButton}
                  onPress={() => setCurrencyModalAmount((currencyModalMaxAmount / 2).toFixed(2))}
                >
                  <Text style={styles.quickAmountButtonText}>50%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAmountButton}
                  onPress={() => setCurrencyModalAmount((currencyModalMaxAmount * 0.75).toFixed(2))}
                >
                  <Text style={styles.quickAmountButtonText}>75%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAmountButton}
                  onPress={() => setCurrencyModalAmount(currencyModalMaxAmount.toString())}
                >
                  <Text style={styles.quickAmountButtonText}>100%</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowCurrencyModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleCurrencyAction}
                disabled={currencyModalLoading}
              >
                {currencyModalLoading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>
                    {currencyModalType === 'claim' ? 'Claim' : 'Pay'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={errorModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModal}>
            <Text style={styles.alertTitle}>Error</Text>
            <Text style={styles.alertMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSuccessModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={48}
              color={colors.success}
            />
            <Text style={styles.successModalMessage}>{successModalMessage}</Text>
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
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 16,
  },
  dateNavButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.backgroundAlt,
  },
  dateDisplay: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    minWidth: 120,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 12,
  },
  reportCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  reportSymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  reportValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  reportSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.cardBorder,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  goalBreakdownSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  goalBreakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  goalBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  goalBreakdownGoal: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  goalBreakdownBalance: {
    fontSize: 14,
    fontWeight: '600',
  },
  currencyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  claimButton: {
    backgroundColor: colors.success,
  },
  payButton: {
    backgroundColor: colors.error,
  },
  currencyActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  drillDownHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  drillDownText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  categorySection: {
    marginBottom: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  categoryCount: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 8,
  },
  goalCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  goalTitleContainer: {
    flex: 1,
  },
  goalCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  goalDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  tallyRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 12,
  },
  tallySection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tallyCount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  currencyProgressContainer: {
    marginTop: 8,
    gap: 6,
  },
  currencyProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currencyProgressText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  entriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  entryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: colors.backgroundAlt,
  },
  deleteEntryButton: {
    padding: 2,
    backgroundColor: colors.card,
    borderRadius: 3,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  successButton: {
    backgroundColor: colors.success,
  },
  struggleButton: {
    backgroundColor: colors.error,
  },
  reflectionButton: {
    backgroundColor: colors.primary,
    flex: 0,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickReflectionModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
  },
  currencyModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  stepIndicator: {
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalContent: {
    padding: 20,
    maxHeight: 400,
  },
  currencyModalContent: {
    padding: 20,
  },
  currencyModalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  currencyModalInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  currencyModalHelper: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  quickAmountButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickAmountButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  quickAmountButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  stepContent: {
    gap: 16,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  outcomeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  outcomeButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  outcomeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  outcomeButtonTextSelected: {
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  alertModal: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  alertMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  alertButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 100,
  },
  alertButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  currencySection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  successModal: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  successModalMessage: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
});
