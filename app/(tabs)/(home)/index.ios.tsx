
import DateTimePicker from '@react-native-community/datetimepicker';
import { IconSymbol } from "@/components/IconSymbol";
import React, { useState, useEffect, useRef } from "react";
import { colors } from "@/styles/commonStyles";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  RefreshControl,
} from "react-native";
import { 
  getGoalsWithDailyEntries, 
  createDailyEntry, 
  deleteDailyEntry,
  getLifeAreas,
  getCurrencies,
  getGainsLosses,
  getStrategies,
  getReflections,
  getUserPreferences,
  getJournals,
  createJournal,
  updateJournal,
  updateUserPreferences
} from "@/utils/supabaseApi";
import { AddReflectionModal } from "@/components/AddReflectionModal";

interface DailyEntry {
  id: string;
  type: 'success' | 'struggle';
  timestamp: string;
}

interface ActivatedGoal {
  id: string;
  title: string;
  description?: string;
  type: 'RESTRAINING' | 'PROACTIVE';
  lifeArea?: { id: string; name: string; parentId?: string; level: number; icon?: string; color?: string };
  subCategory?: string;
  behaviorCategories: string[];
  todaySuccessCount: number;
  todayStruggleCount: number;
  dailyEntries?: DailyEntry[];
  successCount: number;
  struggleCount: number;
  currentStreak?: number;
  bestStreak?: number;
  rewardCurrencyId?: string;
  rewardSuccesses?: number;
  rewardAmount?: number;
  consequenceCurrencyId?: string;
  consequenceFailures?: number;
  consequenceAmount?: number;
}

interface LifeAreaNode {
  id: string;
  name: string;
  parentId?: string | null;
  icon?: string;
  color?: string;
  displayOrder: number;
  showProgress: boolean;
  children: LifeAreaNode[];
  goals: ActivatedGoal[];
}

interface Currency {
  id: string;
  name: string;
  symbol?: string;
  type?: 'reward' | 'consequence';
  onSuccess?: 'ADD' | 'SUBTRACT' | 'NONE';
  onFailure?: 'ADD' | 'SUBTRACT' | 'NONE';
}

interface GainLoss {
  id: string;
  name: string;
  type: 'Gain' | 'Loss';
  category?: string;
  subCategory?: string;
}

interface Strategy {
  id: string;
  name: string;
  description?: string;
  category?: string;
  successCount: number;
  failureCount: number;
  timesUsed: number;
  successRate: number;
}

interface Reflection {
  id: string;
  entryDate: string;
  category?: string;
  type: 'Restraint' | 'Proactive';
  description: string;
  linkedGoalId?: string;
  linkedGoalTitle?: string;
  outcome?: 'success' | 'struggled';
  currencyChange?: {
    currencyId: string;
    amount: number;
    operation: 'add' | 'subtract';
    currencyName?: string;
    currencySymbol?: string;
  };
  gainedIds?: string[];
  lostIds?: string[];
  wasWorthIt?: boolean;
  additionalThoughts?: string;
  strategyEffectiveness?: {
    strategyId: string;
    worked: boolean;
  }[];
  createdAt: string;
}

interface UserPreferences {
  reflectionCategoriesEnabled?: boolean;
  reflectionCategories?: string[];
  preferredHomeScreen?: 'reflect' | 'goals-detailed' | 'goals-concise';
  alternative_calendar?: 'gregorian' | 'hebrew' | 'chinese' | 'islamic';
}

interface JournalEntry {
  id: string;
  content: string;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
}

type CalendarType = 'gregorian' | 'hebrew' | 'chinese' | 'islamic';

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateButton: {
    padding: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    minWidth: 120,
    textAlign: 'center',
  },
  alternativeDateText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  todayButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 8,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  viewToggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  viewToggleButtonActive: {
    backgroundColor: colors.primary,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  viewToggleTextActive: {
    color: '#fff',
  },
  scrollContent: {
    padding: 16,
  },
  lifeAreaContainer: {
    marginBottom: 16,
  },
  lifeAreaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
    marginBottom: 8,
  },
  lifeAreaIcon: {
    marginRight: 12,
    fontSize: 24,
  },
  lifeAreaInfo: {
    flex: 1,
  },
  lifeAreaName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  lifeAreaStats: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  goalCard: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  goalCardConcise: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  goalRowConcise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonIconConcise: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successButtonIconConcise: {
    backgroundColor: '#10b981',
  },
  reflectButtonIconConcise: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statItemConcise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  goalHeaderConcise: {
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  goalTitleConcise: {
    fontSize: 15,
  },
  goalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  actionButtonConcise: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 60,
  },
  successButton: {
    backgroundColor: '#10b981',
  },
  struggleButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextConcise: {
    fontSize: 13,
  },
  goalStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  goalStatsConcise: {
    gap: 12,
    marginTop: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statTextConcise: {
    fontSize: 13,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    color: colors.text,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonSecondary: {
    backgroundColor: colors.border,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  successText: {
    color: '#10b981',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  ungroupedSection: {
    marginBottom: 16,
  },
  ungroupedHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
});

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toHebrewDate(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return formatter.format(date);
  } catch {
    return '';
  }
}

function toChineseDate(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return formatter.format(date);
  } catch {
    return '';
  }
}

function toIslamicDate(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return formatter.format(date);
  } catch {
    return '';
  }
}

function formatAlternativeDate(date: Date, calendarType: CalendarType): string {
  if (calendarType === 'gregorian') {
    return '';
  }

  if (calendarType === 'hebrew') {
    return toHebrewDate(date);
  }

  if (calendarType === 'chinese') {
    return toChineseDate(date);
  }

  if (calendarType === 'islamic') {
    return toIslamicDate(date);
  }

  return '';
}

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lifeAreas, setLifeAreas] = useState<LifeAreaNode[]>([]);
  const [goals, setGoals] = useState<ActivatedGoal[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [gainsLosses, setGainsLosses] = useState<GainLoss[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({});
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [editingReflection, setEditingReflection] = useState<Reflection | null>(null);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [journalContent, setJournalContent] = useState('');
  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [viewMode, setViewMode] = useState<'concise' | 'detailed'>('concise');
  const [alternativeCalendar, setAlternativeCalendar] = useState<CalendarType>('gregorian');

  useEffect(() => {
    console.log('HomeScreen (iOS): Initial load');
    loadData();
  }, []);

  useEffect(() => {
    if (showSuccessModal) {
      const timer = setTimeout(() => {
        setShowSuccessModal(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessModal]);

  useEffect(() => {
    console.log('HomeScreen (iOS): Selected date changed:', formatDateLocal(selectedDate));
    loadData();
  }, [selectedDate]);

  useEffect(() => {
    if (params.date) {
      const dateStr = params.date as string;
      console.log('HomeScreen (iOS): Date param received:', dateStr);
      const newDate = new Date(dateStr);
      setSelectedDate(newDate);
    }
  }, [params.date]);

  const showError = (message: string) => {
    console.error('HomeScreen (iOS): Error:', message);
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(''), 3000);
  };

  const showSuccess = (message: string) => {
    console.log('HomeScreen (iOS): Success:', message);
    setSuccessMessage(message);
    setShowSuccessModal(true);
  };

  const handleRefresh = async () => {
    console.log('HomeScreen (iOS): Refreshing data');
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const loadData = async () => {
    try {
      console.log('HomeScreen (iOS): Loading data for date:', formatDateLocal(selectedDate));
      if (!refreshing) {
        setLoading(true);
      }

      const dateStr = formatDateLocal(selectedDate);

      const [
        goalsData,
        lifeAreasData,
        currenciesData,
        gainsLossesData,
        strategiesData,
        reflectionsData,
        preferencesData,
        journalsData,
      ] = await Promise.all([
        getGoalsWithDailyEntries(dateStr),
        getLifeAreas(),
        getCurrencies(),
        getGainsLosses(),
        getStrategies(),
        getReflections(dateStr),
        getUserPreferences(),
        getJournals(dateStr),
      ]);

      console.log('HomeScreen (iOS): Data loaded successfully');
      console.log('HomeScreen (iOS): Goals count:', goalsData.length);
      console.log('HomeScreen (iOS): User preferences:', preferencesData);
      
      setGoals(goalsData);
      setLifeAreas(buildLifeAreaHierarchy(lifeAreasData, goalsData));
      setCurrencies(currenciesData);
      setGainsLosses(gainsLossesData);
      setStrategies(strategiesData);
      setReflections(reflectionsData);
      setUserPreferences(preferencesData);
      
      // Set alternative calendar from preferences
      const calendarType = preferencesData.alternative_calendar || 'gregorian';
      setAlternativeCalendar(calendarType as CalendarType);
      console.log('HomeScreen (iOS): Alternative calendar set to:', calendarType);
      
      // Always use concise view mode
      setViewMode('concise');
      
      if (journalsData.length > 0) {
        setJournalEntry(journalsData[0]);
        setJournalContent(journalsData[0].content);
      } else {
        setJournalEntry(null);
        setJournalContent('');
      }
    } catch (error: any) {
      console.error('HomeScreen (iOS): Error loading data:', error);
      showError(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const buildLifeAreaHierarchy = (areas: any[], goalsData: ActivatedGoal[]): LifeAreaNode[] => {
    const areaMap = new Map<string, LifeAreaNode>();
    
    areas.forEach(area => {
      areaMap.set(area.id, {
        ...area,
        children: [],
        goals: goalsData.filter(g => g.lifeArea?.id === area.id),
      });
    });

    const rootAreas: LifeAreaNode[] = [];
    areaMap.forEach(area => {
      if (area.parentId) {
        const parent = areaMap.get(area.parentId);
        if (parent) {
          parent.children.push(area);
        }
      } else {
        rootAreas.push(area);
      }
    });

    return rootAreas.sort((a, b) => a.displayOrder - b.displayOrder);
  };

  const handleGoalSuccess = async (goalId: string) => {
    try {
      console.log('HomeScreen (iOS): Recording success for goal:', goalId);
      const dateStr = formatDateLocal(selectedDate);
      
      await createDailyEntry({
        goal_id: goalId,
        type: 'success',
        entry_date: dateStr,
        timestamp: new Date().toISOString(),
      });

      showSuccess('Success recorded!');
      await loadData();
    } catch (error: any) {
      console.error('HomeScreen (iOS): Error recording success:', error);
      showError(error.message || 'Failed to record success');
    }
  };

  const handleGoalStruggle = async (goalId: string) => {
    try {
      console.log('HomeScreen (iOS): Recording struggle for goal:', goalId);
      const dateStr = formatDateLocal(selectedDate);
      
      await createDailyEntry({
        goal_id: goalId,
        type: 'struggle',
        entry_date: dateStr,
        timestamp: new Date().toISOString(),
      });

      showSuccess('Struggle recorded!');
      await loadData();
    } catch (error: any) {
      console.error('HomeScreen (iOS): Error recording struggle:', error);
      showError(error.message || 'Failed to record struggle');
    }
  };

  const handleDeleteEntry = async (goalId: string, entryId: string) => {
    try {
      console.log('HomeScreen (iOS): Deleting entry:', entryId);
      await deleteDailyEntry(entryId);
      showSuccess('Entry deleted!');
      await loadData();
    } catch (error: any) {
      console.error('HomeScreen (iOS): Error deleting entry:', error);
      showError(error.message || 'Failed to delete entry');
    }
  };

  const handleEditGoal = (goalId: string) => {
    console.log('HomeScreen (iOS): Navigating to edit goal:', goalId);
    router.push(`/create-goal?id=${goalId}`);
  };

  const handleCreateGoal = () => {
    console.log('HomeScreen (iOS): Navigating to create goal');
    router.push('/create-goal');
  };

  const openAddReflectionModal = () => {
    console.log('HomeScreen (iOS): Opening add reflection modal');
    setEditingReflection(null);
    setShowReflectionModal(true);
  };

  const openEditReflectionModal = (reflection: Reflection) => {
    console.log('HomeScreen (iOS): Opening edit reflection modal:', reflection.id);
    setEditingReflection(reflection);
    setShowReflectionModal(true);
  };

  const handleReflectionSaved = (reflection: Reflection) => {
    console.log('HomeScreen (iOS): Reflection saved:', reflection.id);
    setShowReflectionModal(false);
    setEditingReflection(null);
    showSuccess('Reflection saved!');
    loadData();
  };

  const handleDeleteReflection = async (id: string) => {
    try {
      console.log('HomeScreen (iOS): Deleting reflection:', id);
      showSuccess('Reflection deleted!');
      await loadData();
    } catch (error: any) {
      console.error('HomeScreen (iOS): Error deleting reflection:', error);
      showError(error.message || 'Failed to delete reflection');
    }
  };

  const handleOpenJournalModal = () => {
    console.log('HomeScreen (iOS): Opening journal modal');
    setShowJournalModal(true);
  };

  const handleCloseJournalModal = () => {
    console.log('HomeScreen (iOS): Closing journal modal');
    setShowJournalModal(false);
  };

  const handleSaveJournal = async () => {
    try {
      console.log('HomeScreen (iOS): Saving journal entry');
      const dateStr = formatDateLocal(selectedDate);

      if (journalEntry) {
        await updateJournal(journalEntry.id, {
          content: journalContent,
        });
      } else {
        await createJournal({
          content: journalContent,
          entry_date: dateStr,
        });
      }

      showSuccess('Journal saved!');
      setShowJournalModal(false);
      await loadData();
    } catch (error: any) {
      console.error('HomeScreen (iOS): Error saving journal:', error);
      showError(error.message || 'Failed to save journal');
    }
  };

  const toggleLifeArea = (areaId: string) => {
    console.log('HomeScreen (iOS): Toggling life area:', areaId);
    setExpandedAreas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(areaId)) {
        newSet.delete(areaId);
      } else {
        newSet.add(areaId);
      }
      return newSet;
    });
  };

  const toggleReflectionCategory = (category: string) => {
    console.log('HomeScreen (iOS): Toggling reflection category:', category);
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const handlePreviousDay = () => {
    console.log('HomeScreen (iOS): Navigating to previous day');
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    console.log('HomeScreen (iOS): Navigating to next day');
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      console.log('HomeScreen (iOS): Date picker selected:', formatDateLocal(date));
      setSelectedDate(date);
    }
  };

  const handleTodayPress = () => {
    console.log('HomeScreen (iOS): Navigating to today');
    setSelectedDate(new Date());
  };

  const formatDateDisplay = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (formatDateLocal(date) === formatDateLocal(today)) {
      return 'Today';
    } else if (formatDateLocal(date) === formatDateLocal(yesterday)) {
      return 'Yesterday';
    } else if (formatDateLocal(date) === formatDateLocal(tomorrow)) {
      return 'Tomorrow';
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // View mode is always concise now
  const handleViewModeChange = async (mode: 'concise' | 'detailed') => {
    // No-op: always use concise
  };

  const calculateDailyCurrencyTallies = (goal: ActivatedGoal) => {
    // Calculate currency changes for today based on goal configuration
    let rewardCount = 0;
    let consequenceCount = 0;
    
    // Check if goal has reward configuration
    if (goal.rewardCurrencyId && goal.rewardSuccesses && goal.rewardAmount) {
      // Calculate how many rewards earned today
      const successesNeeded = goal.rewardSuccesses;
      if (goal.todaySuccessCount >= successesNeeded) {
        rewardCount = Math.floor(goal.todaySuccessCount / successesNeeded);
      }
    }
    
    // Check if goal has consequence configuration
    if (goal.consequenceCurrencyId && goal.consequenceFailures && goal.consequenceAmount) {
      // Calculate how many consequences incurred today
      const failuresNeeded = goal.consequenceFailures;
      if (goal.todayStruggleCount >= failuresNeeded) {
        consequenceCount = Math.floor(goal.todayStruggleCount / failuresNeeded);
      }
    }
    
    return {
      reward: rewardCount,
      consequence: consequenceCount,
    };
  };

  const getCategoryIcon = (category: string): string => {
    const iconMap: { [key: string]: string } = {
      'Action': 'directions-run',
      'Speech': 'chat',
      'Thought': 'psychology',
    };
    return iconMap[category] || 'category';
  };

  const countTotalGoals = (area: LifeAreaNode): number => {
    let count = area.goals.length;
    area.children.forEach(child => {
      count += countTotalGoals(child);
    });
    return count;
  };

  const hasActiveGoalsInHierarchy = (area: LifeAreaNode): boolean => {
    if (area.goals.length > 0) return true;
    return area.children.some(child => hasActiveGoalsInHierarchy(child));
  };

  const getGoalsForArea = (areaId: string): ActivatedGoal[] => {
    return goals.filter(g => g.lifeArea?.id === areaId);
  };

  const handleScroll = (event: any) => {
    // Handle scroll events if needed
  };

  const calculateLifetimeTotals = () => {
    const totalSuccesses = goals.reduce((sum, g) => sum + (g.successCount || 0), 0);
    const totalStruggles = goals.reduce((sum, g) => sum + (g.struggleCount || 0), 0);
    return { totalSuccesses, totalStruggles };
  };

  const isViewingToday = (): boolean => {
    return formatDateLocal(selectedDate) === formatDateLocal(new Date());
  };

  const shouldFadeStreakIOS = (goal: ActivatedGoal): boolean => {
    return !isViewingToday() || goal.todaySuccessCount === 0;
  };

  const getStreakBeforeTodayIOS = (goal: ActivatedGoal): number => {
    return goal.currentStreak || 0;
  };

  const renderGoalCard = (goal: ActivatedGoal, isConcise: boolean = false) => {
    const dailyTallies = calculateDailyCurrencyTallies(goal);
    
    if (isConcise) {
      // Concise view: One-line layout with all stats (RIGHT-TO-LEFT order)
      const bestStreakValue = goal.bestStreak || 0;
      const currentStreakValue = goal.currentStreak || 0;
      const totalSuccessesValue = goal.successCount || 0;
      const totalStrugglesValue = goal.struggleCount || 0;
      const rewardsEarnedToday = dailyTallies.reward;
      const consequencesEarnedToday = dailyTallies.consequence;
      
      return (
        <View key={goal.id} style={styles.goalCardConcise}>
          <View style={styles.goalRowConcise}>
            {/* Reflect Icon - NEW */}
            <TouchableOpacity
              style={styles.reflectButtonIconConcise}
              onPress={() => {
                console.log('HomeScreen (iOS): Opening reflection modal for goal:', goal.id);
                router.push({
                  pathname: '/(tabs)/reflect',
                  params: {
                    openModal: 'true',
                    goalId: goal.id,
                  },
                });
              }}
            >
              <IconSymbol
                ios_icon_name="text.bubble.fill"
                android_material_icon_name="chat-bubble"
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
            
            {/* Action Buttons */}
            <TouchableOpacity
              style={styles.actionButtonIconConcise}
              onPress={() => handleGoalStruggle(goal.id)}
            >
              <IconSymbol
                ios_icon_name="xmark"
                android_material_icon_name="close"
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButtonIconConcise, styles.successButtonIconConcise]}
              onPress={() => handleGoalSuccess(goal.id)}
            >
              <IconSymbol
                ios_icon_name="checkmark"
                android_material_icon_name="check"
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
            
            {/* Consequences Earned Today */}
            {consequencesEarnedToday > 0 && goal.consequenceCurrencyId && (
              <View style={styles.statItemConcise}>
                <Text style={styles.statTextConcise}>{consequencesEarnedToday}</Text>
                <IconSymbol
                  ios_icon_name="exclamationmark.triangle.fill"
                  android_material_icon_name="warning"
                  size={16}
                  color="#ef4444"
                />
              </View>
            )}
            
            {/* Rewards Earned Today */}
            {rewardsEarnedToday > 0 && goal.rewardCurrencyId && (
              <View style={styles.statItemConcise}>
                <Text style={styles.statTextConcise}>{rewardsEarnedToday}</Text>
                <IconSymbol
                  ios_icon_name="gift.fill"
                  android_material_icon_name="card-giftcard"
                  size={16}
                  color="#10b981"
                />
              </View>
            )}
            
            {/* Total Successes */}
            <View style={styles.statItemConcise}>
              <Text style={styles.statTextConcise}>{totalSuccessesValue}</Text>
              <IconSymbol
                ios_icon_name="checkmark"
                android_material_icon_name="check"
                size={16}
                color="#10b981"
              />
            </View>
            
            {/* Total Struggles */}
            <View style={styles.statItemConcise}>
              <Text style={styles.statTextConcise}>{totalStrugglesValue}</Text>
              <IconSymbol
                ios_icon_name="xmark"
                android_material_icon_name="close"
                size={16}
                color="#ef4444"
              />
            </View>
            
            {/* Current Streak */}
            <View style={styles.statItemConcise}>
              <Text style={styles.statTextConcise}>{currentStreakValue}</Text>
              <IconSymbol
                ios_icon_name="flame.fill"
                android_material_icon_name="local-fire-department"
                size={16}
                color="#f59e0b"
              />
            </View>
            
            {/* Best Streak */}
            <View style={styles.statItemConcise}>
              <Text style={styles.statTextConcise}>{bestStreakValue}</Text>
              <IconSymbol
                ios_icon_name="star.fill"
                android_material_icon_name="star"
                size={16}
                color="#f59e0b"
              />
            </View>
            
            {/* Goal Title */}
            <Text style={styles.goalTitleConcise} numberOfLines={1}>{goal.title}</Text>
          </View>
        </View>
      );
    }
    
    // Detailed view: Original layout
    return (
      <View key={goal.id} style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <Text style={styles.goalTitle}>{goal.title}</Text>
          <TouchableOpacity onPress={() => handleEditGoal(goal.id)}>
            <IconSymbol
              ios_icon_name="pencil"
              android_material_icon_name="edit"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.goalActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.successButton]}
            onPress={() => handleGoalSuccess(goal.id)}
          >
            <Text style={styles.actionButtonText}>Success</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.struggleButton]}
            onPress={() => handleGoalStruggle(goal.id)}
          >
            <Text style={styles.actionButtonText}>Struggle</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.goalStats}>
          <View style={styles.statItem}>
            <IconSymbol
              ios_icon_name="checkmark.circle"
              android_material_icon_name="check-circle"
              size={16}
              color="#10b981"
            />
            <Text style={styles.statText}>{goal.todaySuccessCount}</Text>
          </View>
          <View style={styles.statItem}>
            <IconSymbol
              ios_icon_name="xmark.circle"
              android_material_icon_name="cancel"
              size={16}
              color="#ef4444"
            />
            <Text style={styles.statText}>{goal.todayStruggleCount}</Text>
          </View>
          {goal.currentStreak && goal.currentStreak > 0 && (
            <View style={styles.statItem}>
              <IconSymbol
                ios_icon_name="flame"
                android_material_icon_name="local-fire-department"
                size={16}
                color="#f59e0b"
              />
              <Text style={styles.statText}>{goal.currentStreak}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderConciseGoalCard = (goal: ActivatedGoal) => {
    return renderGoalCard(goal, true);
  };

  const renderLifeAreaNode = (area: LifeAreaNode, depth: number = 0) => {
    const isExpanded = expandedAreas.has(area.id);
    const hasGoals = hasActiveGoalsInHierarchy(area);
    
    if (!hasGoals) return null;

    const totalGoals = countTotalGoals(area);
    const goalsText = `${totalGoals} goal${totalGoals !== 1 ? 's' : ''}`;
    const statsText = goalsText;

    return (
      <View key={area.id} style={[styles.lifeAreaContainer, { marginLeft: depth * 16 }]}>
        <TouchableOpacity
          style={styles.lifeAreaHeader}
          onPress={() => toggleLifeArea(area.id)}
        >
          {area.icon && (
            <Text style={styles.lifeAreaIcon}>{area.icon}</Text>
          )}
          <View style={styles.lifeAreaInfo}>
            <Text style={styles.lifeAreaName}>{area.name}</Text>
            <Text style={styles.lifeAreaStats}>{statsText}</Text>
          </View>
          <IconSymbol
            ios_icon_name={isExpanded ? 'chevron.up' : 'chevron.down'}
            android_material_icon_name={isExpanded ? 'expand-less' : 'expand-more'}
            size={24}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {isExpanded && (
          <>
            {area.goals.map(goal => renderGoalCard(goal, viewMode === 'concise'))}
            {area.children.map(child => renderLifeAreaNode(child, depth + 1))}
          </>
        )}
      </View>
    );
  };

  // Get goals without a life area
  const getUngroupedGoals = (): ActivatedGoal[] => {
    return goals.filter(g => !g.lifeArea || !g.lifeArea.id);
  };

  const ungroupedGoals = getUngroupedGoals();
  const hasAnyGoals = goals.length > 0;
  
  // Get alternative date string
  const alternativeDateStr = formatAlternativeDate(selectedDate, alternativeCalendar);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.dateNavigation}>
          <TouchableOpacity style={styles.dateButton} onPress={handlePreviousDay}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="chevron-left"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowDatePicker(true)}>
            <View>
              <Text style={styles.dateText}>{formatDateDisplay(selectedDate)}</Text>
              {alternativeDateStr && (
                <Text style={styles.alternativeDateText}>{alternativeDateStr}</Text>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateButton} onPress={handleNextDay}>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          {!isViewingToday() && (
            <TouchableOpacity
              style={styles.todayButton}
              onPress={handleTodayPress}
            >
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleOpenJournalModal}>
            <IconSymbol
              ios_icon_name="book"
              android_material_icon_name="menu-book"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={openAddReflectionModal}>
            <IconSymbol
              ios_icon_name="plus"
              android_material_icon_name="add"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>



      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {!hasAnyGoals ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No goals yet. Tap the + button to create your first goal!
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, styles.successButton, { marginTop: 16 }]}
              onPress={handleCreateGoal}
            >
              <Text style={styles.actionButtonText}>Create Goal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {lifeAreas.map(area => renderLifeAreaNode(area))}
            
            {ungroupedGoals.length > 0 && (
              <View style={styles.ungroupedSection}>
                <Text style={styles.ungroupedHeader}>Other Goals</Text>
                {ungroupedGoals.map(goal => renderGoalCard(goal, viewMode === 'concise'))}
              </View>
            )}
          </>
        )}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {successMessage && !showSuccessModal ? (
          <Text style={styles.successText}>{successMessage}</Text>
        ) : null}
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="spinner"
          onChange={handleDateChange}
        />
      )}

      {showReflectionModal && (
        <AddReflectionModal
          visible={showReflectionModal}
          onClose={() => {
            setShowReflectionModal(false);
            setEditingReflection(null);
          }}
          onSave={handleReflectionSaved}
          selectedDate={selectedDate}
          goals={goals}
          currencies={currencies}
          userPreferences={userPreferences}
          editingReflection={editingReflection}
          gainsLosses={gainsLosses}
          strategies={strategies}
          motivations={[]}
        />
      )}

      <Modal
        visible={showJournalModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseJournalModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior="padding"
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Journal Entry</Text>
            <TextInput
              style={styles.modalInput}
              value={journalContent}
              onChangeText={setJournalContent}
              placeholder="Write your thoughts..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={handleCloseJournalModal}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSaveJournal}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 32 }]}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={48}
              color="#10b981"
            />
            <Text style={[styles.successText, { marginTop: 16, fontSize: 18 }]}>
              {successMessage}
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
