
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
  trackingType?: 'once_per_day' | 'tally';
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
  goalCardConcise: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  goalRowConcise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  goalNameConcise: {
    width: '100%',
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  goalIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButtonIconConcise: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successButtonIconConcise: {
    backgroundColor: '#10b981',
  },
  reflectButtonIconConcise: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10b981',
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
    fontSize: 14,
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
      
      // Find the goal
      const goal = goals.find(g => g.id === goalId);
      if (!goal) {
        showError('Goal not found');
        return;
      }
      
      // Create daily entry
      await createDailyEntry({
        goal_id: goalId,
        type: 'success',
        entry_date: dateStr,
        timestamp: new Date().toISOString(),
      });

      // Create reflection record for the success
      const { createReflection } = await import('@/utils/supabaseApi');
      await createReflection({
        entry_date: dateStr,
        category: goal.behaviorCategories && goal.behaviorCategories.length > 0 ? goal.behaviorCategories[0] : undefined,
        type: goal.type === 'RESTRAINING' ? 'Restraint' : 'Proactive',
        description: `Quick Entry - ${goal.title}`,
        linked_goal_id: goalId,
        outcome: 'success',
      });
      console.log('HomeScreen: Reflection created for success');

      // Update goal counts and streaks
      const newSuccessCount = (goal.successCount || 0) + 1;
      const newCurrentStreak = (goal.currentStreak || 0) + 1;
      const newBestStreak = Math.max(newCurrentStreak, goal.bestStreak || 0);
      
      await updateGoal(goalId, {
        success_count: newSuccessCount,
        current_streak: newCurrentStreak,
        best_streak: newBestStreak,
      });

      // Reload data to update UI - NO SUCCESS MESSAGE POPUP
      await loadData();
    } catch (error: any) {
      console.error('HomeScreen: Error recording success:', error);
      showError(error.message || 'Failed to record success');
    }
  };

  const handleGoalStruggle = async (goalId: string) => {
    try {
      console.log('HomeScreen: Recording struggle for goal:', goalId);
      const dateStr = formatDateLocal(selectedDate);
      
      // Find the goal
      const goal = goals.find(g => g.id === goalId);
      if (!goal) {
        showError('Goal not found');
        return;
      }
      
      // Create daily entry
      await createDailyEntry({
        goal_id: goalId,
        type: 'struggle',
        entry_date: dateStr,
        timestamp: new Date().toISOString(),
      });

      // Create reflection record for the struggle
      const { createReflection } = await import('@/utils/supabaseApi');
      await createReflection({
        entry_date: dateStr,
        category: goal.behaviorCategories && goal.behaviorCategories.length > 0 ? goal.behaviorCategories[0] : undefined,
        type: goal.type === 'RESTRAINING' ? 'Restraint' : 'Proactive',
        description: `Quick Entry - ${goal.title}`,
        linked_goal_id: goalId,
        outcome: 'struggled',
      });
      console.log('HomeScreen: Reflection created for struggle');

      // Update goal counts and reset streak
      const newStruggleCount = (goal.struggleCount || 0) + 1;
      
      await updateGoal(goalId, {
        struggle_count: newStruggleCount,
        current_streak: 0, // Reset streak on struggle
      });

      // Reload data to update UI - NO SUCCESS MESSAGE POPUP
      await loadData();
    } catch (error: any) {
      console.error('HomeScreen: Error recording struggle:', error);
      showError(error.message || 'Failed to record struggle');
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

  const openAddReflectionModal = (goalId?: string, outcome?: 'success' | 'struggled') => {
    console.log('HomeScreen: Opening add reflection modal', goalId ? `for goal: ${goalId}` : '', outcome ? `with outcome: ${outcome}` : '');
    
    if (goalId) {
      const goal = goals.find(g => g.id === goalId);
      if (goal) {
        console.log('HomeScreen: Prefilling reflection modal with goal data:', {
          id: goal.id,
          title: goal.title,
          behaviorCategories: goal.behaviorCategories,
          type: goal.type,
          outcome,
        });
        
        // Build prefilled data with Quick Entry format
        const prefilled = {
          id: goal.id,
          category: goal.behaviorCategories && goal.behaviorCategories.length > 0 ? goal.behaviorCategories[0] : undefined,
          type: goal.type === 'RESTRAINING' ? 'Restraint' as const : 'Proactive' as const,
          description: `Quick Entry - ${goal.title}`,
          behaviorCategories: goal.behaviorCategories,
          outcome: outcome,
          selectedDate: selectedDate,
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
      
      // Find the reflection to get its linked goal
      const reflection = reflections.find(r => r.id === id);
      
      // Delete the reflection
      const { deleteReflection } = await import('@/utils/supabaseApi');
      await deleteReflection(id);
      
      // If reflection was linked to a goal, recalculate goal stats
      if (reflection && reflection.linkedGoalId) {
        console.log('HomeScreen: Reflection was linked to goal, recalculating stats for goal:', reflection.linkedGoalId);
        
        // Get all remaining reflections for this goal
        const { getReflections } = await import('@/utils/supabaseApi');
        const allReflections = await getReflections();
        const goalReflections = allReflections.filter((r: any) => r.linked_goal_id === reflection.linkedGoalId);
        
        // Recalculate success and struggle counts
        const successCount = goalReflections.filter((r: any) => r.outcome === 'success').length;
        const struggleCount = goalReflections.filter((r: any) => r.outcome === 'struggled').length;
        
        // Recalculate streaks
        // Sort reflections by date (newest first)
        const sortedReflections = goalReflections
          .sort((a: any, b: any) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
        
        let currentStreak = 0;
        let bestStreak = 0;
        let tempStreak = 0;
        
        // Calculate current streak (from most recent date backwards)
        for (const r of sortedReflections) {
          if ((r as any).outcome === 'success') {
            tempStreak++;
            if (tempStreak > bestStreak) {
              bestStreak = tempStreak;
            }
          } else if ((r as any).outcome === 'struggled') {
            if (currentStreak === 0) {
              // If we haven't set current streak yet, it means the most recent entries were successes
              currentStreak = tempStreak;
            }
            tempStreak = 0;
          }
        }
        
        // If we never hit a struggle, the current streak is the temp streak
        if (currentStreak === 0) {
          currentStreak = tempStreak;
        }
        
        console.log('HomeScreen: Recalculated stats:', {
          successCount,
          struggleCount,
          currentStreak,
          bestStreak,
        });
        
        // Update the goal with recalculated stats
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
    
    // CRITICAL FIX: For "once per day" goals showing cumulative counts, 
    // we should show ALL reflections, not just today's
    // For tally goals, we show only today's reflections
    const isOncePerDay = goal.trackingType === 'once_per_day';
    
    setReflectionListGoalId(goal.id);
    setReflectionListOutcome(outcome);
    setReflectionListTitle(`${goal.title} - ${outcome === 'success' ? 'Successes' : 'Struggles'}`);
    setReflectionListShowAll(isOncePerDay); // Show all reflections for once per day goals
    setShowReflectionListModal(true);
  };

  const handleCloseReflectionList = () => {
    console.log('HomeScreen: Closing reflection list');
    setShowReflectionListModal(false);
    setReflectionListGoalId(undefined);
    setReflectionListOutcome(undefined);
    setReflectionListTitle('');
    setReflectionListShowAll(false);
    // Reload data to reflect any changes made in the modal
    loadData();
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

  const renderConciseGoalCard = (goal: ActivatedGoal) => {
    const dailyTallies = calculateDailyCurrencyTallies(goal);
    const isOneTimeGoal = goal.trackingType === 'once_per_day';
    
    // CRITICAL FIX: For tally goals, show TODAY'S counts (reset daily)
    // For once_per_day goals, show CUMULATIVE counts
    const todaySuccesses = goal.todaySuccessCount || 0;
    const todayStruggles = goal.todayStruggleCount || 0;
    
    // Display values based on tracking type
    let displaySuccessCount: number;
    let displayStruggleCount: number;
    
    if (isOneTimeGoal) {
      // Once per day: Show cumulative total
      displaySuccessCount = goal.successCount || 0;
      displayStruggleCount = 0; // Hidden for once_per_day goals
    } else {
      // Tally: Show today's count only
      displaySuccessCount = todaySuccesses;
      displayStruggleCount = todayStruggles;
    }
    
    const bestStreakValue = goal.bestStreak || 0;
    const currentStreakValue = goal.currentStreak || 0;
    const rewardsEarnedToday = dailyTallies.reward;
    const consequencesEarnedToday = dailyTallies.consequence;
    
    // For once_per_day goals, only show tick if success recorded TODAY
    const shouldShowTickForOncePerDay = isOneTimeGoal && todaySuccesses > 0;
    
    // Streak logic: Show streak icons when there's a current streak
    const hasCurrentStreak = currentStreakValue > 0;
    const shouldShowStreak = hasCurrentStreak;
    
    // Best streak should show when it exists and there's a current streak
    const shouldShowBestStreak = bestStreakValue > 0 && hasCurrentStreak
    
    return (
      <TouchableOpacity 
        key={goal.id} 
        style={styles.goalCardConcise}
        onPress={() => handleEditGoal(goal.id)}
      >
        <View style={styles.goalRowConcise}>
          {/* Goal Name - FULL WIDTH ON TOP */}
          <Text style={styles.goalNameConcise} numberOfLines={2}>{goal.title}</Text>
          
          {/* Icons Row - UNDER THE GOAL NAME */}
          <View style={styles.goalIconsRow}>
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
            
            {/* Best Streak - Only show if there's a current streak */}
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
            
            {/* Current Streak - Only show if there's a current streak */}
            {shouldShowStreak && (
              <View style={styles.statItemConcise}>
                <Text style={styles.statTextConcise}>{currentStreakValue}</Text>
                <IconSymbol
                  ios_icon_name="flame.fill"
                  android_material_icon_name="local-fire-department"
                  size={16}
                  color="#f59e0b"
                  style={styles.streakIconVisible}
                />
              </View>
            )}
            
            {/* Success Count - Show only if applicable - CLICKABLE */}
            {(!isOneTimeGoal || shouldShowTickForOncePerDay) && (
              <TouchableOpacity
                style={styles.statItemConcise}
                onPress={(e) => {
                  e.stopPropagation();
                  handleOpenReflectionList(goal, 'success');
                }}
              >
                <Text style={styles.statTextConcise}>{displaySuccessCount}</Text>
                <IconSymbol
                  ios_icon_name={isOneTimeGoal ? "checkmark.circle.fill" : "checkmark"}
                  android_material_icon_name={isOneTimeGoal ? "check-circle" : "check"}
                  size={16}
                  color={colors.success}
                />
              </TouchableOpacity>
            )}
            
            {/* Struggle Count - HIDDEN for one-time goals AFTER success recorded - CLICKABLE */}
            {!isOneTimeGoal && (
              <TouchableOpacity
                style={styles.statItemConcise}
                onPress={(e) => {
                  e.stopPropagation();
                  handleOpenReflectionList(goal, 'struggled');
                }}
              >
                <Text style={styles.statTextConcise}>{displayStruggleCount}</Text>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={16}
                  color={colors.error}
                />
              </TouchableOpacity>
            )}
            
            {/* Reflect Icon */}
            <TouchableOpacity
              style={[styles.reflectButtonIconConcise, { backgroundColor: "#7C9885" }]}
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
            
            {/* Struggle Button - HIDDEN for one-time goals AFTER success recorded */}
            {!isOneTimeGoal && (
              <TouchableOpacity
                style={[styles.actionButtonIconConcise, { backgroundColor: "#B87C6C" }]}
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
            
            {/* Success Button - RIGHTMOST */}
            <TouchableOpacity
              style={[styles.actionButtonIconConcise, styles.successButtonIconConcise, { backgroundColor: "#7C9885" }]}
              onPress={(e) => {
                e.stopPropagation();
                handleGoalSuccess(goal.id);
              }}
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
      </TouchableOpacity>
    );
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
            {area.goals.map(goal => renderConciseGoalCard(goal))}
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
            <IconSymbol
              ios_icon_name="book"
              android_material_icon_name="menu-book"
              size={24}
              color={colors.text}
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
