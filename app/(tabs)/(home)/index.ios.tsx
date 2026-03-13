
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
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback } from "react";
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

  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  appLogoButton: {
    padding: 2,
  },
  appLogo: {
    width: 48,
    height: 48,
  },
  calendarContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  calendarNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  smallNavButton: {
    padding: 2,
  },
  calendarButton: {
    padding: 2,
    alignItems: 'center',
  },
  calendarDateLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
    maxWidth: 100,
    textAlign: 'center',
  },
  profileButton: {
    padding: 2,
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  defaultProfileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7C9885',
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingLeft: 5,
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
    backgroundColor: '#7C9885',
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
  // PERFORMANCE FIX: Remove loading state - render immediately
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);

  // CRITICAL FIX: Fetch user avatar on every screen focus
  // This ensures the avatar updates when returning from profile screen
  const fetchUserAvatar = async () => {
    try {
      const { getProfile, getGravatarUrl } = await import('@/utils/supabaseApi');
      const { supabase } = await import('@/lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const profile = await getProfile();
        
        if (profile?.avatar_url) {
          console.log('HomeScreen: Setting avatar from profile:', profile.avatar_url);
          setUserAvatarUrl(profile.avatar_url);
        } else if (user.email) {
          // Default to Gravatar if no custom avatar
          const gravatarUrl = getGravatarUrl(user.email);
          console.log('HomeScreen: Setting avatar from Gravatar:', gravatarUrl);
          setUserAvatarUrl(gravatarUrl);
        }
      }
    } catch (error) {
      console.error('HomeScreen: Error fetching user avatar:', error);
    }
  };

  useEffect(() => {
    console.log('HomeScreen: Initial load - rendering immediately');
    
    // PERFORMANCE FIX: Load data in background without blocking render
    // UI shows instantly with empty state, then updates when data arrives
    loadData();
    fetchUserAvatar();
    
    // PERFORMANCE FIX: Run cleanup in background, don't block initial render
    // This is a maintenance task, not critical for first render
    setTimeout(() => {
      import('@/utils/supabaseApi').then(({ cleanupOrphanedDailyEntries }) => {
        cleanupOrphanedDailyEntries().then((result) => {
          console.log('HomeScreen: Background cleanup completed:', result.deletedCount);
        }).catch((error) => {
          console.error('HomeScreen: Background cleanup error:', error);
        });
      });
    }, 5000); // Run after 5 seconds, not on mount
  }, []);

  // CRITICAL FIX: Refresh avatar when screen comes into focus
  // This ensures avatar updates when returning from profile screen
  useFocusEffect(
    useCallback(() => {
      console.log('HomeScreen: Screen focused - refreshing avatar');
      fetchUserAvatar();
    }, [])
  );

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
      // PERFORMANCE FIX: No loading state - UI already rendered

      const dateStr = formatDateLocal(selectedDate);

      // PERFORMANCE FIX: Load critical data first (goals), then load supporting data
      // This creates a progressive loading experience instead of waiting for everything
      
      // Phase 1: Load goals immediately (most important for UI)
      const goalsData = await getGoalsWithDailyEntries(dateStr);
      console.log('HomeScreen: Goals loaded:', goalsData.length);
      setGoals(goalsData);
      
      // Phase 2: Load life areas and build hierarchy (needed for grouping)
      const lifeAreasData = await getLifeAreas();
      setLifeAreas(buildLifeAreaHierarchy(lifeAreasData, goalsData));
      
      // Phase 3: Load supporting data in parallel (not critical for initial render)
      Promise.all([
        getCurrencies(),
        getGainsLosses(),
        getStrategies(),
        getReflections(dateStr),
        getUserPreferences(),
        getJournals(dateStr),
      ]).then(([
        currenciesData,
        gainsLossesData,
        strategiesData,
        reflectionsData,
        preferencesData,
        journalsData,
      ]) => {
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
        
        console.log('HomeScreen: All supporting data loaded');
      }).catch((error) => {
        console.error('HomeScreen: Error loading supporting data:', error);
        // Don't show error - supporting data is not critical
      });
      
    } catch (error: any) {
      console.error('HomeScreen: Error loading critical data:', error);
      showError(error.message || 'Failed to load goals');
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
      
      // CRITICAL FIX: Don't do optimistic updates - wait for backend to complete
      // This prevents the race condition where UI updates but data doesn't save
      
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

      // CRITICAL FIX: Reload data AFTER backend operations complete
      // This ensures UI shows correct data and prevents race conditions
      await loadData();
    } catch (error: any) {
      console.error('HomeScreen: Error recording success:', error);
      showError(error.message || 'Failed to record success');
      // Reload to ensure UI is in sync with backend
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
      
      // CRITICAL FIX: Delete corresponding daily_entry BEFORE deleting reflection
      // This ensures data stays in sync
      if (reflection && reflection.linkedGoalId) {
        console.log('HomeScreen: Finding and deleting corresponding daily_entry');
        const dateStr = formatDateLocal(selectedDate);
        
        // Get the goal to find its daily entries
        const goal = goals.find(g => g.id === reflection.linkedGoalId);
        if (goal && goal.dailyEntries) {
          // Find the daily entry that matches this reflection's outcome and date
          const matchingEntry = goal.dailyEntries.find(e => 
            e.type === reflection.outcome && 
            formatDateLocal(new Date(e.timestamp)) === dateStr
          );
          
          if (matchingEntry) {
            console.log('HomeScreen: Deleting daily_entry:', matchingEntry.id);
            await deleteDailyEntry(matchingEntry.id);
          }
        }
      }
      
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
    const isTally = goal.trackingType === 'tally';
    
    setReflectionListGoalId(goal.id);
    setReflectionListOutcome(outcome);
    setReflectionListTitle(`${goal.title} - ${outcome === 'success' ? 'Successes' : 'Struggles'}`);
    
    // CRITICAL FIX: For tally goals, show only TODAY's reflections (date-filtered)
    // For once_per_day/one_time_only, show ALL reflections (cumulative)
    setReflectionListShowAll(!isTally);
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
    
    // CRITICAL FIX: Use the actual counts from the goal data
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
    
    // CRITICAL FIX: For tally goals, show TODAY's counts. For once_per_day/one_time_only, show cumulative counts
    const displaySuccessCount = isTally ? todaySuccesses : (goal.successCount || 0);
    const displayStruggleCount = isTally ? todayStruggles : (goal.struggleCount || 0);
    
    const hasSuccessToday = todaySuccesses > 0;
    const hasStruggleToday = todayStruggles > 0;
    
    // CRITICAL FIX: Streak logic
    // For once_per_day/one_time_only: Show streak ONLY if there's a success today OR if there's a current streak from yesterday
    // For tally: Never show streak (tally goals don't have streaks)
    const shouldShowStreak = (isOncePerDay || isOneTimeOnly) && (hasSuccessToday || currentStreakValue > 0);
    
    const streakDisplayValue = currentStreakValue;
    const isStreakFaded = false; // Never fade streak - if it shows, it's real
    
    const isNewRecord = currentStreakValue > 0 && currentStreakValue === bestStreakValue && bestStreakValue > 1;
    const shouldShowBestStreak = (isOncePerDay || isOneTimeOnly) && hasSuccessToday && isNewRecord;
    
    // CRITICAL FIX: Button fading logic
    // For once_per_day/one_time_only: Fade buttons ONLY if there's an action today
    // For tally: NEVER fade buttons (you can always add more)
    const isSuccessButtonFaded = (isOncePerDay || isOneTimeOnly) && hasActionToday;
    const isReflectButtonFaded = (isOncePerDay || isOneTimeOnly) && hasActionToday;
    const isStruggleButtonFaded = false; // Never fade struggle button for tally
    
    // CRITICAL FIX: Trophy/X icon visibility
    // For once_per_day/one_time_only: Show trophy ONLY if there's a success TODAY
    // For tally: Show tick/X ONLY if there are counts TODAY
    const shouldShowTrophy = (isOncePerDay || isOneTimeOnly) && hasSuccessToday;
    const shouldShowX = false; // Never show X for once_per_day (they don't track struggles cumulatively)
    
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

  // PERFORMANCE FIX: No loading screen - render content immediately
  // UI shows empty state or cached data, then updates when data loads

  const handleProfilePress = () => {
    console.log('HomeScreen: Navigating to profile');
    router.push('/(tabs)/profile');
  };

  const handleAppLogoPress = () => {
    console.log('HomeScreen: Opening Reflect page');
    // CRITICAL FIX: Use push for proper navigation on iOS
    router.push('/(tabs)/reflect');
  };

  const handleDatePickerConfirm = (date: Date) => {
    console.log('HomeScreen: Date selected:', formatDateLocal(date));
    setSelectedDate(date);
    setShowDatePicker(false);
  };

  const handleDatePickerCancel = () => {
    console.log('HomeScreen: Date picker cancelled');
    setShowDatePicker(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {/* Left: App Logo - Opens Reflect page */}
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.appLogoButton} onPress={handleAppLogoPress}>
            <Image 
              source={require('@/assets/images/Chesbon_app_Logo Small.png')} 
              style={styles.appLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Center: Calendar with small navigation arrows above date label */}
        <View style={styles.headerCenter}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarNavRow}>
              <TouchableOpacity style={styles.smallNavButton} onPress={handlePreviousDay}>
                <IconSymbol
                  ios_icon_name="chevron.left"
                  android_material_icon_name="chevron-left"
                  size={14}
                  color={colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.calendarButton} onPress={() => setShowDatePicker(true)}>
                <IconSymbol
                  ios_icon_name="calendar"
                  android_material_icon_name="event"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallNavButton} onPress={handleNextDay}>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="chevron-right"
                  size={14}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.calendarDateLabel} numberOfLines={1}>
              {isToday(selectedDate) ? 'Today' : formatDateDisplay(selectedDate)}
            </Text>
          </View>
        </View>

        {/* Right: Profile Icon */}
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.profileButton} onPress={handleProfilePress}>
            {userAvatarUrl ? (
              <Image 
                source={{ uri: userAvatarUrl }} 
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.defaultProfileIcon}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={20}
                  color="#fff"
                />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        value={selectedDate}
        mode="date"
        onConfirm={handleDatePickerConfirm}
        onCancel={handleDatePickerCancel}
      />

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
