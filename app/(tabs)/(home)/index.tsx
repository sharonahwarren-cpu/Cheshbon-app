
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";
import { getLocalTimezone } from '@/utils/dateUtils';
import React, { useState, useEffect, useRef } from "react";
import { DateTime } from 'luxon';
import { DatePickerModal } from "@/components/DatePickerModal";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
  Image,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
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
  updateUserPreferences,
  updateGoal
} from "@/utils/supabaseApi";
import { AddReflectionModal } from "@/components/AddReflectionModal";
import { ReflectionListModal } from "@/components/ReflectionListModal";

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
  trackingType?: 'once_per_day' | 'tally' | 'one_time_only';
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
}

interface JournalEntry {
  id: string;
  content: string;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
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
  scrollContent: {
    padding: 16,
  },
  lifeAreaContainer: {
    marginBottom: 8,
  },
  lifeAreaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    paddingLeft: 4,
    backgroundColor: colors.card,
    borderRadius: 4,
    marginBottom: 6,
    minHeight: 32,
    borderLeftWidth: 4,
  },
  lifeAreaIcon: {
    marginRight: 6,
    marginLeft: 4,
    fontSize: 16,
  },
  lifeAreaInfo: {
    flex: 1,
  },
  lifeAreaName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  lifeAreaStats: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  goalCardConcise: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 1,
    paddingRight: 0,
    marginBottom: 8,
    position: 'relative',
  },
  goalRowConcise: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 2,
    paddingRight: 100,
  },
  goalNameConcise: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  goalIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  goalActionButtons: {
    flexDirection: 'row',
    gap: 0,
    position: 'absolute',
    top: 0,
    right: 0,
  },
  actionButtonIconConcise: {
    width: 32,
    height: 32,
    borderRadius: 0,
    backgroundColor: '#7C9885',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successButtonIconConcise: {
    backgroundColor: '#7C9885',
  },
  reflectButtonIconConcise: {
    width: 32,
    height: 32,
    borderRadius: 0,
    backgroundColor: '#B87C6C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  struggleButtonIconConcise: {
    width: 32,
    height: 32,
    borderRadius: 0,
    backgroundColor: '#B87C6C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statItemConcise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statTextConcise: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  streakIconFaded: {
    opacity: 0.3,
  },
  streakIconVisible: {
    opacity: 1,
  },
  fadedButton: {
    opacity: 0.3,
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
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatAlternativeDate(date: Date, calendarType: string): string {
  // Placeholder for alternative calendar formatting
  return formatDateLocal(date);
}

function isToday(date: Date): boolean {
  const today = new Date();
  return formatDateLocal(date) === formatDateLocal(today);
}

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [lifeAreas, setLifeAreas] = useState<LifeAreaNode[]>([]);
  const [goals, setGoals] = useState<ActivatedGoal[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [gainsLosses, setGainsLosses] = useState<GainLoss[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({});
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [editingReflection, setEditingReflection] = useState<Reflection | null>(null);
  const [prefilledGoalId, setPrefilledGoalId] = useState<string | undefined>(undefined);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [journalContent, setJournalContent] = useState('');
  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showReflectionListModal, setShowReflectionListModal] = useState(false);
  const [reflectionListGoalId, setReflectionListGoalId] = useState<string | undefined>(undefined);
  const [reflectionListOutcome, setReflectionListOutcome] = useState<'success' | 'struggled' | undefined>(undefined);
  const [reflectionListTitle, setReflectionListTitle] = useState('');
  const [reflectionListShowAll, setReflectionListShowAll] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('HomeScreen: Initial load');
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
    console.log('HomeScreen: Selected date changed:', formatDateLocal(selectedDate));
    loadData();
  }, [selectedDate]);

  useEffect(() => {
    if (params.date) {
      const dateStr = params.date as string;
      console.log('HomeScreen: Date param received:', dateStr);
      const newDate = new Date(dateStr);
      setSelectedDate(newDate);
    }
  }, [params.date]);

  const showError = (message: string) => {
    console.error('HomeScreen: Error:', message);
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(''), 3000);
  };

  const showSuccess = (message: string) => {
    console.log('HomeScreen: Success:', message);
    setSuccessMessage(message);
    setShowSuccessModal(true);
  };

  const loadData = async () => {
    try {
      console.log('HomeScreen: Loading data for date:', formatDateLocal(selectedDate));
      setLoading(true);

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

      console.log('HomeScreen: Data loaded successfully');
      console.log('HomeScreen: Goals count:', goalsData.length);
      setGoals(goalsData);
      setLifeAreas(buildLifeAreaHierarchy(lifeAreasData, goalsData));
      setCurrencies(currenciesData);
      setGainsLosses(gainsLossesData);
      setStrategies(strategiesData);
      setReflections(reflectionsData);
      setUserPreferences(preferencesData);
      
      if (journalsData.length > 0) {
        setJournalEntry(journalsData[0]);
        setJournalContent(journalsData[0].content);
      } else {
        setJournalEntry(null);
        setJournalContent('');
      }
    } catch (error: any) {
      console.error('HomeScreen: Error loading data:', error);
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
      
      // Auto-expand all life areas by default
      setExpandedAreas(prev => new Set([...prev, area.id]));
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
      console.log('HomeScreen: Recording success for goal:', goalId);
      const dateStr = formatDateLocal(selectedDate);
      
      const goal = goals.find(g => g.id === goalId);
      if (!goal) {
        showError('Goal not found');
        return;
      }
      
      const isOncePerDay = goal.trackingType === 'once_per_day';
      const isOneTimeOnly = goal.trackingType === 'one_time_only';
      
      // Optimistic UI update - update state immediately
      const updatedGoals = goals.map(g => {
        if (g.id === goalId) {
          if (isOncePerDay || isOneTimeOnly) {
            const hasSuccessToday = g.todaySuccessCount > 0;
            if (hasSuccessToday) {
              // Undo success
              return {
                ...g,
                todaySuccessCount: 0,
                todayStruggleCount: 0,
              };
            } else {
              // Add success
              return {
                ...g,
                todaySuccessCount: 1,
                todayStruggleCount: 0,
              };
            }
          } else {
            // Tally type
            return {
              ...g,
              todaySuccessCount: g.todaySuccessCount + 1,
            };
          }
        }
        return g;
      });
      
      setGoals(updatedGoals);
      setLifeAreas(buildLifeAreaHierarchy(lifeAreas.map(a => ({ ...a })), updatedGoals));
      
      // Background database sync
      if (isOncePerDay || isOneTimeOnly) {
        const { getReflections, deleteReflection, createReflection: createReflectionFn } = await import('@/utils/supabaseApi');
        const todayReflections = await getReflections(dateStr);
        const goalTodayReflections = todayReflections.filter((r: any) => r.linked_goal_id === goalId);
        
        const todaySuccessReflection = goalTodayReflections.find((r: any) => r.outcome === 'success');
        const todayStruggleReflection = goalTodayReflections.find((r: any) => r.outcome === 'struggled');
        
        if (todaySuccessReflection) {
          await deleteReflection(todaySuccessReflection.id);
          
          const todaySuccessEntry = goal.dailyEntries?.find(e => e.type === 'success');
          if (todaySuccessEntry) {
            await deleteDailyEntry(todaySuccessEntry.id);
          }
          
          const allReflections = await getReflections();
          const goalReflections = allReflections.filter((r: any) => r.linked_goal_id === goalId);
          const successCount = goalReflections.filter((r: any) => r.outcome === 'success').length;
          const struggleCount = goalReflections.filter((r: any) => r.outcome === 'struggled').length;
          
          const sortedReflections = goalReflections
            .sort((a: any, b: any) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
          
          let currentStreak = 0;
          let bestStreak = 0;
          let tempStreak = 0;
          
          for (const r of sortedReflections) {
            if ((r as any).outcome === 'success') {
              tempStreak++;
              if (tempStreak > bestStreak) {
                bestStreak = tempStreak;
              }
            } else if ((r as any).outcome === 'struggled') {
              if (currentStreak === 0) {
                currentStreak = tempStreak;
              }
              tempStreak = 0;
            }
          }
          
          if (currentStreak === 0) {
            currentStreak = tempStreak;
          }
          
          await updateGoal(goalId, {
            success_count: successCount,
            struggle_count: struggleCount,
            current_streak: currentStreak,
            best_streak: bestStreak,
          });
        } else {
          if (todayStruggleReflection) {
            await deleteReflection(todayStruggleReflection.id);
            
            const todayStruggleEntry = goal.dailyEntries?.find(e => e.type === 'struggle');
            if (todayStruggleEntry) {
              await deleteDailyEntry(todayStruggleEntry.id);
            }
          }
          
          await createDailyEntry({
            goal_id: goalId,
            type: 'success',
            entry_date: dateStr,
            timestamp: new Date().toISOString(),
          });
          
          await createReflectionFn({
            entry_date: dateStr,
            category: goal.behaviorCategories && goal.behaviorCategories.length > 0 ? goal.behaviorCategories[0] : undefined,
            type: goal.type === 'RESTRAINING' ? 'Restraint' : 'Proactive',
            description: `Quick Entry - ${goal.title}`,
            linked_goal_id: goalId,
            outcome: 'success',
          });
          
          const allReflections = await getReflections();
          const goalReflections = allReflections.filter((r: any) => r.linked_goal_id === goalId);
          const successCount = goalReflections.filter((r: any) => r.outcome === 'success').length;
          const struggleCount = goalReflections.filter((r: any) => r.outcome === 'struggled').length;
          
          const sortedReflections = goalReflections
            .sort((a: any, b: any) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
          
          let currentStreak = 0;
          let bestStreak = 0;
          let tempStreak = 0;
          
          for (const r of sortedReflections) {
            if ((r as any).outcome === 'success') {
              tempStreak++;
              if (tempStreak > bestStreak) {
                bestStreak = tempStreak;
              }
            } else if ((r as any).outcome === 'struggled') {
              if (currentStreak === 0) {
                currentStreak = tempStreak;
              }
              tempStreak = 0;
            }
          }
          
          if (currentStreak === 0) {
            currentStreak = tempStreak;
          }
          
          await updateGoal(goalId, {
            success_count: successCount,
            struggle_count: struggleCount,
            current_streak: currentStreak,
            best_streak: bestStreak,
          });
        }
      } else {
        await createDailyEntry({
          goal_id: goalId,
          type: 'success',
          entry_date: dateStr,
          timestamp: new Date().toISOString(),
        });

        const { createReflection } = await import('@/utils/supabaseApi');
        await createReflection({
          entry_date: dateStr,
          category: goal.behaviorCategories && goal.behaviorCategories.length > 0 ? goal.behaviorCategories[0] : undefined,
          type: goal.type === 'RESTRAINING' ? 'Restraint' : 'Proactive',
          description: `Quick Entry - ${goal.title}`,
          linked_goal_id: goalId,
          outcome: 'success',
        });

        const newSuccessCount = (goal.successCount || 0) + 1;
        const newCurrentStreak = (goal.currentStreak || 0) + 1;
        const newBestStreak = Math.max(newCurrentStreak, goal.bestStreak || 0);
        
        await updateGoal(goalId, {
          success_count: newSuccessCount,
          current_streak: newCurrentStreak,
          best_streak: newBestStreak,
        });
      }

      // Reload data in background to sync with database
      await loadData();
    } catch (error: any) {
      console.error('HomeScreen: Error recording success:', error);
      showError(error.message || 'Failed to record success');
      // Reload to revert optimistic update
      await loadData();
    }
  };

  const handleGoalStruggle = async (goalId: string) => {
    try {
      console.log('HomeScreen: Recording struggle for goal:', goalId);
      const dateStr = formatDateLocal(selectedDate);
      
      const goal = goals.find(g => g.id === goalId);
      if (!goal) {
        showError('Goal not found');
        return;
      }
      
      const isTally = goal.trackingType === 'tally';
      
      // Optimistic UI update - update state immediately
      const updatedGoals = goals.map(g => {
        if (g.id === goalId) {
          if (isTally) {
            return {
              ...g,
              todayStruggleCount: g.todayStruggleCount + 1,
            };
          }
        }
        return g;
      });
      
      setGoals(updatedGoals);
      setLifeAreas(buildLifeAreaHierarchy(lifeAreas.map(a => ({ ...a })), updatedGoals));
      
      // Background database sync
      await createDailyEntry({
        goal_id: goalId,
        type: 'struggle',
        entry_date: dateStr,
        timestamp: new Date().toISOString(),
      });

      const { createReflection } = await import('@/utils/supabaseApi');
      await createReflection({
        entry_date: dateStr,
        category: goal.behaviorCategories && goal.behaviorCategories.length > 0 ? goal.behaviorCategories[0] : undefined,
        type: goal.type === 'RESTRAINING' ? 'Restraint' : 'Proactive',
        description: `Quick Entry - ${goal.title}`,
        linked_goal_id: goalId,
        outcome: 'struggled',
      });

      const newStruggleCount = (goal.struggleCount || 0) + 1;
      
      await updateGoal(goalId, {
        struggle_count: newStruggleCount,
        current_streak: 0,
      });

      // Reload data in background to sync with database
      await loadData();
    } catch (error: any) {
      console.error('HomeScreen: Error recording struggle:', error);
      showError(error.message || 'Failed to record struggle');
      // Reload to revert optimistic update
      await loadData();
    }
  };

  const handleDeleteEntry = async (goalId: string, entryId: string) => {
    try {
      console.log('HomeScreen: Deleting entry:', entryId);
      await deleteDailyEntry(entryId);
      showSuccess('Entry deleted!');
      await loadData();
    } catch (error: any) {
      console.error('HomeScreen: Error deleting entry:', error);
      showError(error.message || 'Failed to delete entry');
    }
  };

  const handleEditGoal = (goalId: string) => {
    console.log('HomeScreen: Navigating to edit goal:', goalId);
    router.push(`/create-goal?id=${goalId}`);
  };

  const handleCreateGoal = () => {
    console.log('HomeScreen: Navigating to create goal');
    router.push('/create-goal');
  };

  const openAddReflectionModal = (goalId?: string, outcome?: 'success' | 'struggled', startAtStep4?: boolean) => {
    console.log('HomeScreen: Opening add reflection modal', goalId ? `for goal: ${goalId}` : '', outcome ? `with outcome: ${outcome}` : '', startAtStep4 ? 'starting at step 4' : '');
    
    if (goalId) {
      const goal = goals.find(g => g.id === goalId);
      if (goal) {
        console.log('HomeScreen: Prefilling reflection modal with goal data:', {
          id: goal.id,
          title: goal.title,
          behaviorCategories: goal.behaviorCategories,
          type: goal.type,
          outcome,
          startAtStep4,
        });
        
        const prefilled = {
          id: goal.id,
          category: goal.behaviorCategories && goal.behaviorCategories.length > 0 ? goal.behaviorCategories[0] : undefined,
          type: goal.type === 'RESTRAINING' ? 'Restraint' as const : 'Proactive' as const,
          description: `Quick Entry - ${goal.title}`,
          behaviorCategories: goal.behaviorCategories,
          outcome: outcome,
          selectedDate: selectedDate,
          startAtStep4: startAtStep4,
        };
        
        console.log('HomeScreen: Setting prefilledGoalData:', prefilled);
        setEditingReflection(null);
        setPrefilledGoalId(prefilled as any);
        setShowReflectionModal(true);
      }
    } else {
      setEditingReflection(null);
      setPrefilledGoalId(undefined);
      setShowReflectionModal(true);
    }
  };

  const openEditReflectionModal = (reflection: Reflection) => {
    console.log('HomeScreen: Opening edit reflection modal:', reflection.id);
    setEditingReflection(reflection);
    setPrefilledGoalId(undefined);
    setShowReflectionModal(true);
  };

  const handleReflectionSaved = (reflection: Reflection) => {
    console.log('HomeScreen: Reflection saved:', reflection.id);
    setShowReflectionModal(false);
    setEditingReflection(null);
    setPrefilledGoalId(undefined);
    showSuccess('Reflection saved!');
    loadData();
  };

  const handleDeleteReflection = async (id: string) => {
    try {
      console.log('HomeScreen: Deleting reflection:', id);
      
      const reflection = reflections.find(r => r.id === id);
      
      const { deleteReflection } = await import('@/utils/supabaseApi');
      await deleteReflection(id);
      
      if (reflection && reflection.linkedGoalId) {
        console.log('HomeScreen: Reflection was linked to goal, recalculating stats for goal:', reflection.linkedGoalId);
        
        const { getReflections } = await import('@/utils/supabaseApi');
        const allReflections = await getReflections();
        const goalReflections = allReflections.filter((r: any) => r.linked_goal_id === reflection.linkedGoalId);
        
        const successCount = goalReflections.filter((r: any) => r.outcome === 'success').length;
        const struggleCount = goalReflections.filter((r: any) => r.outcome === 'struggled').length;
        
        const sortedReflections = goalReflections
          .sort((a: any, b: any) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
        
        let currentStreak = 0;
        let bestStreak = 0;
        let tempStreak = 0;
        
        for (const r of sortedReflections) {
          if ((r as any).outcome === 'success') {
            tempStreak++;
            if (tempStreak > bestStreak) {
              bestStreak = tempStreak;
            }
          } else if ((r as any).outcome === 'struggled') {
            if (currentStreak === 0) {
              currentStreak = tempStreak;
            }
            tempStreak = 0;
          }
        }
        
        if (currentStreak === 0) {
          currentStreak = tempStreak;
        }
        
        console.log('HomeScreen: Recalculated stats:', {
          successCount,
          struggleCount,
          currentStreak,
          bestStreak,
        });
        
        await updateGoal(reflection.linkedGoalId, {
          success_count: successCount,
          struggle_count: struggleCount,
          current_streak: currentStreak,
          best_streak: bestStreak,
        });
      }
      
      showSuccess('Reflection deleted!');
      await loadData();
    } catch (error: any) {
      console.error('HomeScreen: Error deleting reflection:', error);
      showError(error.message || 'Failed to delete reflection');
    }
  };

  const handleOpenReflectionList = (goal: ActivatedGoal, outcome: 'success' | 'struggled') => {
    console.log('HomeScreen: Opening reflection list for goal:', goal.id, 'outcome:', outcome, 'trackingType:', goal.trackingType);
    
    const isOncePerDay = goal.trackingType === 'once_per_day';
    const isOneTimeOnly = goal.trackingType === 'one_time_only';
    
    setReflectionListGoalId(goal.id);
    setReflectionListOutcome(outcome);
    setReflectionListTitle(`${goal.title} - ${outcome === 'success' ? 'Successes' : 'Struggles'}`);
    setReflectionListShowAll(false);
    setShowReflectionListModal(true);
  };

  const handleCloseReflectionList = async () => {
    console.log('HomeScreen: Closing reflection list and reloading data');
    setShowReflectionListModal(false);
    setReflectionListGoalId(undefined);
    setReflectionListOutcome(undefined);
    setReflectionListTitle('');
    setReflectionListShowAll(false);
    // CRITICAL FIX: Reload data to update icon visibility and counts after reflection deletion
    await loadData();
  };

  const handleOpenJournalModal = () => {
    console.log('HomeScreen: Opening journal modal');
    setShowJournalModal(true);
  };

  const handleCloseJournalModal = () => {
    console.log('HomeScreen: Closing journal modal');
    setShowJournalModal(false);
  };

  const handleSaveJournal = async () => {
    try {
      console.log('HomeScreen: Saving journal entry');
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
      console.error('HomeScreen: Error saving journal:', error);
      showError(error.message || 'Failed to save journal');
    }
  };

  const toggleLifeArea = (areaId: string) => {
    console.log('HomeScreen: Toggling life area:', areaId);
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

  const handlePreviousDay = () => {
    console.log('HomeScreen: Navigating to previous day');
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    console.log('HomeScreen: Navigating to next day');
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
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

  const calculateDailyCurrencyTallies = (goal: ActivatedGoal) => {
    let rewardCount = 0;
    let consequenceCount = 0;
    
    if (goal.rewardCurrencyId && goal.rewardSuccesses && goal.rewardAmount) {
      const successesNeeded = goal.rewardSuccesses;
      if (goal.todaySuccessCount >= successesNeeded) {
        rewardCount = Math.floor(goal.todaySuccessCount / successesNeeded);
      }
    }
    
    if (goal.consequenceCurrencyId && goal.consequenceFailures && goal.consequenceAmount) {
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

  const handleSuccessPressIn = (goalId: string) => {
    const timer = setTimeout(() => {
      console.log('HomeScreen: Long press detected on success button');
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
      openAddReflectionModal(goalId, 'success', true);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleSuccessPressOut = (goalId: string) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
      console.log('HomeScreen: Quick tap on success button');
      handleGoalSuccess(goalId);
    }
  };

  const renderConciseGoalCard = (goal: ActivatedGoal, lifeAreaColor?: string) => {
    const dailyTallies = calculateDailyCurrencyTallies(goal);
    const isOncePerDay = goal.trackingType === 'once_per_day';
    const isOneTimeOnly = goal.trackingType === 'one_time_only';
    const isTally = goal.trackingType === 'tally';
    
    const todaySuccesses = goal.todaySuccessCount || 0;
    const todayStruggles = goal.todayStruggleCount || 0;
    const hasActionToday = todaySuccesses > 0 || todayStruggles > 0;
    
    console.log('HomeScreen: Rendering goal card:', {
      goalId: goal.id,
      title: goal.title,
      trackingType: goal.trackingType,
      todaySuccesses,
      todayStruggles,
      hasActionToday,
      successCount: goal.successCount,
      struggleCount: goal.struggleCount,
      currentStreak: goal.currentStreak,
      bestStreak: goal.bestStreak,
      lifeAreaColor,
    });
    
    const bestStreakValue = goal.bestStreak || 0;
    const currentStreakValue = goal.currentStreak || 0;
    const rewardsEarnedToday = dailyTallies.reward;
    const consequencesEarnedToday = dailyTallies.consequence;
    
    const displaySuccessCount = (isOncePerDay || isOneTimeOnly) ? (goal.successCount || 0) : todaySuccesses;
    const displayStruggleCount = (isOncePerDay || isOneTimeOnly) ? (goal.struggleCount || 0) : todayStruggles;
    
    const hasSuccessToday = todaySuccesses > 0;
    const hasStruggleToday = todayStruggles > 0;
    
    const shouldShowStreak = (isOncePerDay || isOneTimeOnly)
      ? (!hasActionToday || hasSuccessToday)
      : (currentStreakValue > 0);
    
    const streakDisplayValue = ((isOncePerDay || isOneTimeOnly) && !hasActionToday) ? 1 : currentStreakValue;
    const isStreakFaded = (isOncePerDay || isOneTimeOnly) && !hasActionToday;
    
    const isNewRecord = currentStreakValue > 0 && currentStreakValue === bestStreakValue && bestStreakValue > 1;
    const shouldShowBestStreak = (isOncePerDay || isOneTimeOnly)
      ? (hasSuccessToday && isNewRecord) 
      : (bestStreakValue > 0 && currentStreakValue > 0);
    
    const isSuccessButtonFaded = (isOncePerDay || isOneTimeOnly) && hasActionToday;
    const isStruggleButtonFaded = false; // Never fade struggle button for tally
    
    const shouldShowTrophy = (isOncePerDay || isOneTimeOnly) && hasSuccessToday;
    const shouldShowX = false; // Never show X for once_per_day
    
    const shouldShowTallyTick = isTally && todaySuccesses > 0;
    const shouldShowTallyX = isTally && todayStruggles > 0;
    
    // Get currency icon
    const rewardCurrency = goal.rewardCurrencyId ? currencies.find(c => c.id === goal.rewardCurrencyId) : null;
    const consequenceCurrency = goal.consequenceCurrencyId ? currencies.find(c => c.id === goal.consequenceCurrencyId) : null;
    
    const rewardIcon = rewardCurrency?.symbol || '🎁';
    const consequenceIcon = consequenceCurrency?.symbol || '⚠️';
    
    // CRITICAL FIX: Apply Life Area color to goal card
    const goalCardStyle = lifeAreaColor 
      ? [styles.goalCardConcise, { borderLeftWidth: 4, borderLeftColor: lifeAreaColor }]
      : styles.goalCardConcise;
    
    return (
      <View 
        key={goal.id} 
        style={goalCardStyle}
      >
        <View style={styles.goalRowConcise}>
          <TouchableOpacity 
            style={{ flex: 1 }}
            onPress={() => handleEditGoal(goal.id)}
          >
            <Text style={styles.goalNameConcise} numberOfLines={2}>{goal.title}</Text>
          </TouchableOpacity>
          
          <View style={styles.goalActionButtons}>
            <TouchableOpacity
              style={[
                styles.reflectButtonIconConcise,
                isSuccessButtonFaded && styles.fadedButton
              ]}
              onPress={(e) => {
                e.stopPropagation();
                console.log('HomeScreen: Opening reflection modal for goal:', goal.id);
                openAddReflectionModal(goal.id);
              }}
            >
              <IconSymbol
                ios_icon_name="text.bubble.fill"
                android_material_icon_name="chat-bubble"
                size={16}
                color="#fff"
              />
            </TouchableOpacity>
            
            {isTally && (
              <TouchableOpacity
                style={[
                  styles.struggleButtonIconConcise,
                  isStruggleButtonFaded && styles.fadedButton
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleGoalStruggle(goal.id);
                }}
              >
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={16}
                  color="#fff"
                />
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[
                styles.actionButtonIconConcise, 
                styles.successButtonIconConcise,
                isSuccessButtonFaded && styles.fadedButton
              ]}
              onPressIn={() => (isOncePerDay || isOneTimeOnly) && handleSuccessPressIn(goal.id)}
              onPressOut={() => (isOncePerDay || isOneTimeOnly) ? handleSuccessPressOut(goal.id) : handleGoalSuccess(goal.id)}
              delayPressIn={0}
            >
              <IconSymbol
                ios_icon_name="checkmark"
                android_material_icon_name="check"
                size={16}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.goalIconsRow}>
          
          {consequencesEarnedToday > 0 && goal.consequenceCurrencyId && (
            <View style={styles.statItemConcise}>
              <Text style={styles.statTextConcise}>{consequencesEarnedToday}</Text>
              {consequenceCurrency?.symbol ? (
                <Text style={{ fontSize: 16, color: '#ef4444' }}>{consequenceCurrency.symbol}</Text>
              ) : (
                <IconSymbol
                  ios_icon_name="exclamationmark.triangle.fill"
                  android_material_icon_name="warning"
                  size={16}
                  color="#7C9885"
                />
              )}
            </View>
          )}
          
          {rewardsEarnedToday > 0 && goal.rewardCurrencyId && (
            <View style={styles.statItemConcise}>
              <Text style={styles.statTextConcise}>{rewardsEarnedToday}</Text>
              {rewardCurrency?.symbol ? (
                <Text style={{ fontSize: 16, color: '#10b981' }}>{rewardCurrency.symbol}</Text>
              ) : (
                <IconSymbol
                  ios_icon_name="gift.fill"
                  android_material_icon_name="card-giftcard"
                  size={16}
                  color="#7C9885"
                />
              )}
            </View>
          )}
          
          {shouldShowBestStreak && (
            <View style={styles.statItemConcise}>
              <Text style={styles.statTextConcise}>{bestStreakValue}</Text>
              <IconSymbol
                ios_icon_name="star.fill"
                android_material_icon_name="star"
                size={16}
                color="#f59e0b"
                style={styles.streakIconVisible}
              />
            </View>
          )}
          
          {shouldShowStreak && (
            <View style={styles.statItemConcise}>
              <Text style={styles.statTextConcise}>{streakDisplayValue}</Text>
              <IconSymbol
                ios_icon_name="flame.fill"
                android_material_icon_name="local-fire-department"
                size={16}
                color="#f59e0b"
                style={isStreakFaded ? styles.streakIconFaded : styles.streakIconVisible}
              />
            </View>
          )}
          
          {shouldShowTrophy && (
            <TouchableOpacity
              style={styles.statItemConcise}
              onPress={(e) => {
                e.stopPropagation();
                handleOpenReflectionList(goal, 'success');
              }}
            >
              <Text style={styles.statTextConcise}>{displaySuccessCount}</Text>
              <IconSymbol
                ios_icon_name="trophy.fill"
                android_material_icon_name="emoji-events"
                size={16}
                color="#FFD700"
              />
            </TouchableOpacity>
          )}
          
          {shouldShowTallyTick && (
            <TouchableOpacity
              style={styles.statItemConcise}
              onPress={(e) => {
                e.stopPropagation();
                handleOpenReflectionList(goal, 'success');
              }}
            >
              <Text style={styles.statTextConcise}>{todaySuccesses}</Text>
              <IconSymbol
                ios_icon_name="checkmark"
                android_material_icon_name="check"
                size={16}
                color="#7C9885"
              />
            </TouchableOpacity>
          )}
          
          {shouldShowTallyX && (
            <TouchableOpacity
              style={styles.statItemConcise}
              onPress={(e) => {
                e.stopPropagation();
                handleOpenReflectionList(goal, 'struggled');
              }}
            >
              <Text style={styles.statTextConcise}>{todayStruggles}</Text>
              <IconSymbol
                ios_icon_name="xmark"
                android_material_icon_name="close"
                size={16}
                color="#B87C6C"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderLifeAreaNode = (area: LifeAreaNode, depth: number = 0) => {
    const isExpanded = expandedAreas.has(area.id);
    const hasGoals = hasActiveGoalsInHierarchy(area);
    
    if (!hasGoals) return null;

    const totalGoals = countTotalGoals(area);
    const areaColor = area.color || colors.primary;

    return (
      <View key={area.id} style={[styles.lifeAreaContainer, { marginLeft: depth * 16 }]}>
        <TouchableOpacity
          style={[styles.lifeAreaHeader, { borderLeftColor: areaColor }]}
          onPress={() => toggleLifeArea(area.id)}
        >
          {area.icon && (
            <Text style={styles.lifeAreaIcon}>{area.icon}</Text>
          )}
          <View style={styles.lifeAreaInfo}>
            <Text style={styles.lifeAreaName}>{area.name}</Text>
          </View>
          <IconSymbol
            ios_icon_name={isExpanded ? 'chevron.up' : 'chevron.down'}
            android_material_icon_name={isExpanded ? 'expand-less' : 'expand-more'}
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {isExpanded && (
          <>
            {area.goals.map(goal => renderConciseGoalCard(goal, areaColor))}
            {area.children.map(child => renderLifeAreaNode(child, depth + 1))}
          </>
        )}
      </View>
    );
  };

  const getUngroupedGoals = (): ActivatedGoal[] => {
    return goals.filter(g => !g.lifeArea || !g.lifeArea.id);
  };

  const ungroupedGoals = getUngroupedGoals();
  const hasAnyGoals = goals.length > 0;

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
          <Text style={styles.dateText}>{formatDateDisplay(selectedDate)}</Text>
          <TouchableOpacity style={styles.dateButton} onPress={handleNextDay}>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          {!isToday(selectedDate) && (
            <TouchableOpacity
              style={styles.todayButton}
              onPress={() => setSelectedDate(new Date())}
            >
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleOpenJournalModal}>
            <Image 
              source={require('@/assets/images/Chesbon_app_Logo Small.png')} 
              style={{ width: 24, height: 24 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleCreateGoal}>
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
                {ungroupedGoals.map(goal => renderConciseGoalCard(goal))}
              </View>
            )}
          </>
        )}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>

      {showReflectionModal && (
        <AddReflectionModal
          visible={showReflectionModal}
          onClose={() => {
            setShowReflectionModal(false);
            setEditingReflection(null);
            setPrefilledGoalId(undefined);
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
          prefilledGoalData={prefilledGoalId as any}
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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

      {showReflectionListModal && reflectionListGoalId && reflectionListOutcome && (
        <ReflectionListModal
          visible={showReflectionListModal}
          onClose={handleCloseReflectionList}
          title={reflectionListTitle}
          filterType={reflectionListOutcome === 'success' ? 'successes' : 'struggles'}
          goalId={reflectionListGoalId}
          startDate={formatDateLocal(selectedDate)}
          endDate={formatDateLocal(selectedDate)}
          showAllReflections={reflectionListShowAll}
        />
      )}

    </SafeAreaView>
  );
}
