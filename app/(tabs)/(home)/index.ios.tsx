
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  TextInput,
  KeyboardAvoidingView,
  RefreshControl,
} from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { AddReflectionModal } from "@/components/AddReflectionModal";
import { useRouter, useLocalSearchParams } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/styles/commonStyles";
import { authenticatedGet, authenticatedPost, authenticatedDelete, authenticatedPut } from "@/utils/api";
import DateTimePicker from '@react-native-community/datetimepicker';
import { DateTime } from 'luxon';
import { getLocalTimezone } from '@/utils/dateUtils';

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
}

interface JournalEntry {
  id: string;
  content: string;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to format alternative calendar dates
function formatAlternativeDate(date: Date, calendarType: string): string {
  try {
    if (calendarType === 'hebrew') {
      const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      return formatter.format(date);
    } else if (calendarType === 'chinese') {
      const formatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      return formatter.format(date);
    } else if (calendarType === 'islamic') {
      const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      return formatter.format(date);
    }
    return '';
  } catch (error) {
    console.error('Error formatting alternative date:', error);
    return 'Date unavailable';
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollPositionRef = useRef(0);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'reflect' | 'express'>('reflect');
  const [expressViewMode, setExpressViewMode] = useState<'detailed' | 'concise'>('detailed');
  
  const [activatedGoals, setActivatedGoals] = useState<ActivatedGoal[]>([]);
  const [lifeAreaHierarchy, setLifeAreaHierarchy] = useState<LifeAreaNode[]>([]);
  const [collapsedAreas, setCollapsedAreas] = useState<Record<string, boolean>>({});
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');
  
  const [showAddReflectionModal, setShowAddReflectionModal] = useState(false);
  const [prefilledGoalId, setPrefilledGoalId] = useState<string | undefined>(undefined);
  const [gainsLosses, setGainsLosses] = useState<GainLoss[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [motivations, setMotivations] = useState<{ id: string; name: string; createdAt: string; updatedAt: string }[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({});

  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);
  const [journalContent, setJournalContent] = useState('');
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [tempJournalContent, setTempJournalContent] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingReflection, setEditingReflection] = useState<Reflection | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [prefilledGoalData, setPrefilledGoalData] = useState<{
    category?: string;
    type?: 'Restraint' | 'Proactive';
    description?: string;
  } | undefined>(undefined);

  const loadData = React.useCallback(async (isRefreshing: boolean = false, preserveView: boolean = false) => {
    console.log("[Home iOS] Loading home screen data, isRefreshing:", isRefreshing, "preserveView:", preserveView);
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const dateString = formatDateLocal(selectedDate);
      const [goalsRes, lifeAreasRes, currenciesRes, gainsLossesRes, strategiesRes, prefsRes, journalRes, reflectionsRes, motivationsRes] = await Promise.all([
        authenticatedGet(`/api/goals/activated-today?date=${dateString}`),
        authenticatedGet('/api/life-areas'),
        authenticatedGet('/api/currencies'),
        authenticatedGet('/api/gains-losses'),
        authenticatedGet('/api/strategies'),
        authenticatedGet('/api/user-preferences'),
        authenticatedGet(`/api/journals/by-date?date=${dateString}`),
        authenticatedGet(`/api/reflections/by-date?date=${dateString}`),
        authenticatedGet('/api/reflection-motivations'),
      ]);
      
      const rawGoalsData = Array.isArray(goalsRes) ? goalsRes : (goalsRes?.data || []);
      const lifeAreasData = Array.isArray(lifeAreasRes) ? lifeAreasRes : (lifeAreasRes?.data || []);
      const currenciesData = Array.isArray(currenciesRes) ? currenciesRes : (currenciesRes?.data || []);
      const gainsLossesData = Array.isArray(gainsLossesRes) ? gainsLossesRes : (gainsLossesRes?.data || []);
      const strategiesData = Array.isArray(strategiesRes) ? strategiesRes : (strategiesRes?.data || []);
      const prefsData = prefsRes?.data || prefsRes || {};
      const journalData = journalRes?.data || journalRes || null;
      const reflectionsData = Array.isArray(reflectionsRes) ? reflectionsRes : (reflectionsRes?.data || []);
      const motivationsData = Array.isArray(motivationsRes) ? motivationsRes : (motivationsRes?.data || []);

      // Normalize goal data: after the backend fix, GET /activated-today returns `currentStreak`
      // calculated from the day BEFORE the requested date (excludes today).
      // POST /success returns `currentStreak` calculated FROM entryDate (includes today).
      //
      // When displaying the streak:
      // - If today has a success (todaySuccessCount > 0): the GET value is streak-before-today,
      //   so the actual current streak = currentStreak + 1 (add today's contribution).
      //   BUT: we only do this adjustment when viewing today (not past dates).
      // - If today has no success: currentStreak is already the correct "streak before today" value.
      //
      // This adjustment ensures the streak display is consistent between:
      // - Immediate POST response (includes today)
      // - Subsequent GET reload (excludes today, needs +1 adjustment when today has success)
      const isTodayView = dateString === formatDateLocal(new Date());
      const goalsData = rawGoalsData.map((goal: any) => {
        const baseCurrentStreak = goal.currentStreak !== undefined ? goal.currentStreak : (goal.streak !== undefined ? goal.streak : 0);
        const todaySuccessCount = (goal.dailyEntries || []).filter((e: any) => e.type === 'success').length;
        
        // BACKEND FIX ADJUSTMENT: When viewing today and there are successes,
        // the GET endpoint returns streak-before-today. Add 1 to include today's success.
        // This keeps the display consistent with the POST response value.
        const adjustedCurrentStreak = (isTodayView && todaySuccessCount > 0)
          ? baseCurrentStreak + 1
          : baseCurrentStreak;
        
        return {
          ...goal,
          currentStreak: adjustedCurrentStreak,
          bestStreak: goal.bestStreak !== undefined ? goal.bestStreak : 0,
        };
      });
      
      console.log('[Home iOS] Loaded life areas hierarchy:', lifeAreasData.length, 'root areas');
      console.log('[Home iOS] Loaded currencies for modal:', currenciesData.length, 'currencies');
      console.log('[Home iOS] Loaded goals from backend:', goalsData.length, 'goals for date:', dateString);
      console.log('[Home iOS] Loaded motivations:', motivationsData.length, 'motivations');
      console.log('[Home iOS] User preferences loaded:', prefsData);
      console.log('[Home iOS] Preferred home screen from backend:', prefsData.preferredHomeScreen);
      // Debug streak values to verify backend is returning correct data
      goalsData.forEach((goal: any) => {
        if (goal.currentStreak > 0 || goal.bestStreak > 0) {
          console.log(`[Home iOS] Goal "${goal.title}" streaks: current=${goal.currentStreak}, best=${goal.bestStreak}`);
        }
      });
      
      setActivatedGoals(goalsData);
      setLifeAreaHierarchy(lifeAreasData);
      setCurrencies(currenciesData);
      setGainsLosses(gainsLossesData);
      setStrategies(strategiesData);
      setMotivations(motivationsData);
      setUserPreferences(prefsData);
      setJournalEntry(journalData);
      setJournalContent(journalData?.content || '');
      setReflections(reflectionsData);
      
      // CRITICAL FIX: NEVER apply user's preferred home screen during refreshes
      // The preferred home screen should ONLY be applied when clicking the Home button in the tab bar
      // All other refreshes (pull-to-refresh, background updates, etc.) should preserve the current view
      // This prevents the page from jumping back to the default homepage during refreshes
      console.log('[Home iOS] Preserving current view state (never reset to default on refresh)');
      
      console.log("[Home iOS] Data loaded successfully");
    } catch (error: any) {
      console.error("[Home iOS] Error loading home data:", error);
      showError(error.message || "Failed to load data");
    } finally {
      if (isRefreshing) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [selectedDate]);

  useEffect(() => {
    console.log("HomeScreen iOS mounted");
    // CRITICAL FIX: On initial mount, apply the user's preferred home screen
    // This is the ONLY time we should apply the default homepage preference
    const applyDefaultHomepage = async () => {
      try {
        const prefsRes = await authenticatedGet('/api/user-preferences');
        const prefsData = prefsRes?.data || prefsRes || {};
        const preferredScreen = prefsData.preferredHomeScreen;
        
        console.log('[Home iOS] Initial mount - applying preferred home screen:', preferredScreen);
        
        if (preferredScreen === 'goals-detailed') {
          setCurrentView('express');
          setExpressViewMode('detailed');
        } else if (preferredScreen === 'goals-concise') {
          setCurrentView('express');
          setExpressViewMode('concise');
        } else {
          setCurrentView('reflect');
        }
      } catch (error) {
        console.error('[Home iOS] Error loading preferences on mount:', error);
        // Default to reflect view on error
        setCurrentView('reflect');
      }
      
      // Now load the rest of the data
      loadData(false);
    };
    
    applyDefaultHomepage();
  }, []);

  useEffect(() => {
    console.log("Selected date changed iOS, reloading data:", selectedDate);
    loadData(false);
  }, [selectedDate, loadData]);

  useEffect(() => {
    if (showSuccessModal) {
      const timer = setTimeout(() => {
        setShowSuccessModal(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessModal]);

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const showSuccess = (message: string) => {
    setSuccessModalMessage(message);
    setShowSuccessModal(true);
  };

  const handleRefresh = async () => {
    console.log("Pull-to-refresh triggered on Home screen iOS");
    await loadData(true);
  };

  const handleGoalSuccess = async (goalId: string) => {
    console.log("[Home iOS] ========== RECORDING SUCCESS ==========");
    console.log("[Home iOS] Goal ID:", goalId);
    console.log("[Home iOS] Selected Date:", selectedDate.toISOString());
    
    // Find the goal to get its behavior categories and type
    const goal = activatedGoals.find(g => g.id === goalId);
    if (!goal) {
      console.error("[Home iOS] Goal not found for success quick entry:", goalId);
      showError("Goal not found for quick entry.");
      return;
    }
    
    // Create UTC timestamp for the selected date at current time in local timezone
    // This ensures the backend extracts the correct local date from the timestamp
    const localZone = getLocalTimezone();
    const now = DateTime.now().setZone(localZone);
    const selectedDt = DateTime.fromJSDate(selectedDate, { zone: localZone })
      .set({ hour: now.hour, minute: now.minute, second: now.second });
    const utcTimestamp = selectedDt.toUTC().toISO();
    console.log(`[Home iOS] Success timestamp: local=${selectedDt.toISO()} -> UTC=${utcTimestamp}`);
    
    const newEntry: DailyEntry = {
      id: `temp-${Date.now()}`,
      type: 'success',
      timestamp: utcTimestamp || new Date(selectedDate).toISOString(),
    };
    
    console.log("[Home iOS] Creating temp entry:", JSON.stringify(newEntry, null, 2));
    
    // Optimistic UI update
    setActivatedGoals(prevGoals => 
      prevGoals.map(g => {
        if (g.id === goalId) {
          const updatedEntries = [...(g.dailyEntries || []), newEntry];
          console.log("[Home iOS] Updated entries for goal:", updatedEntries.length);
          return {
            ...g,
            dailyEntries: updatedEntries,
            todaySuccessCount: g.todaySuccessCount + 1,
          };
        }
        return g;
      })
    );
    
    try {
      const timestamp = utcTimestamp || new Date(selectedDate).toISOString();
      // CRITICAL FIX: Send the local date string explicitly to avoid timezone issues
      // The backend will use this date field instead of extracting from the UTC timestamp
      const localDateString = formatDateLocal(selectedDate);
      
      // CRITICAL FIX: Extract behavior category and reflection type from the goal
      // This ensures the reflection is created with the correct category and type
      const reflectionCategory = goal.behaviorCategories && goal.behaviorCategories.length > 0
        ? goal.behaviorCategories[0]
        : null;
      
      // Map goal type to reflection type
      const reflectionType: 'Proactive' | 'Restraint' = 
        goal.type === 'PROACTIVE' ? 'Proactive' : 'Restraint';
      
      const apiEndpoint = `/api/goals/${goalId}/success`;
      const apiPayload = {
        timestamp,
        date: localDateString,
        category: reflectionCategory,
        type: reflectionType,
        linkedGoalId: goal.id,
      };
      
      console.log("[Home iOS] ========== MAKING API CALL ==========");
      console.log("[Home iOS] Endpoint:", apiEndpoint);
      console.log("[Home iOS] Payload:", JSON.stringify(apiPayload, null, 2));
      console.log("[Home iOS] Local date string:", localDateString);
      console.log("[Home iOS] Calling authenticatedPost...");
      
      const response = await authenticatedPost(apiEndpoint, apiPayload);
      
      console.log("[Home iOS] ========== API CALL SUCCESSFUL ==========");
      console.log("[Home iOS] Response:", JSON.stringify(response, null, 2));
      
      // Update with real entry ID from backend
      setActivatedGoals(prevGoals => 
        prevGoals.map(g => {
          if (g.id === goalId) {
            return {
              ...g,
              dailyEntries: g.dailyEntries?.map(e => 
                e.id === newEntry.id ? { ...e, id: response.entryId || e.id } : e
              ),
              todaySuccessCount: response.todaySuccessCount !== undefined ? response.todaySuccessCount : g.todaySuccessCount,
              successCount: response.successCount !== undefined ? response.successCount : g.successCount,
              currentStreak: response.currentStreak !== undefined ? response.currentStreak : g.currentStreak,
              bestStreak: response.bestStreak !== undefined ? response.bestStreak : g.bestStreak,
            };
          }
          return g;
        })
      );
      
      console.log("[Home iOS] Success recorded successfully, entry ID:", response.entryId);
      console.log("[Home iOS] ========== SUCCESS COMPLETE ==========");
      
      // Reload data to ensure everything is in sync
      await loadData(true, true);
    } catch (error: any) {
      console.error("[Home iOS] ========== API CALL FAILED ==========");
      console.error("[Home iOS] Error:", error);
      console.error("[Home iOS] Error message:", error.message);
      console.error("[Home iOS] Error stack:", error.stack);
      console.error("[Home iOS] Full error object:", JSON.stringify(error, null, 2));
      
      // Rollback optimistic update
      setActivatedGoals(prevGoals => 
        prevGoals.map(g => {
          if (g.id === goalId) {
            const filteredEntries = (g.dailyEntries || []).filter(e => e.id !== newEntry.id);
            return {
              ...g,
              dailyEntries: filteredEntries,
              todaySuccessCount: Math.max(0, g.todaySuccessCount - 1),
            };
          }
          return g;
        })
      );
      
      showError(`Failed to record success: ${error.message || 'Unknown error'}`);
    }
  };

  const handleGoalStruggle = async (goalId: string) => {
    console.log("[Home iOS] ========== RECORDING STRUGGLE ==========");
    console.log("[Home iOS] Goal ID:", goalId);
    console.log("[Home iOS] Selected Date:", selectedDate.toISOString());
    
    // Find the goal to get its behavior categories and type
    const goal = activatedGoals.find(g => g.id === goalId);
    if (!goal) {
      console.error("[Home iOS] Goal not found for struggle quick entry:", goalId);
      showError("Goal not found for quick entry.");
      return;
    }
    
    // Create UTC timestamp for the selected date at current time in local timezone
    // This ensures the backend extracts the correct local date from the timestamp
    const localZone = getLocalTimezone();
    const now = DateTime.now().setZone(localZone);
    const selectedDt = DateTime.fromJSDate(selectedDate, { zone: localZone })
      .set({ hour: now.hour, minute: now.minute, second: now.second });
    const utcTimestamp = selectedDt.toUTC().toISO();
    console.log(`[Home iOS] Struggle timestamp: local=${selectedDt.toISO()} -> UTC=${utcTimestamp}`);
    
    const newEntry: DailyEntry = {
      id: `temp-${Date.now()}`,
      type: 'struggle',
      timestamp: utcTimestamp || new Date(selectedDate).toISOString(),
    };
    
    console.log("[Home iOS] Creating temp entry:", JSON.stringify(newEntry, null, 2));
    
    // Optimistic UI update
    setActivatedGoals(prevGoals => 
      prevGoals.map(g => {
        if (g.id === goalId) {
          const updatedEntries = [...(g.dailyEntries || []), newEntry];
          console.log("[Home iOS] Updated entries for goal:", updatedEntries.length);
          return {
            ...g,
            dailyEntries: updatedEntries,
            todayStruggleCount: g.todayStruggleCount + 1,
          };
        }
        return g;
      })
    );
    
    try {
      const timestamp = utcTimestamp || new Date(selectedDate).toISOString();
      // CRITICAL FIX: Send the local date string explicitly to avoid timezone issues
      // The backend will use this date field instead of extracting from the UTC timestamp
      const localDateString = formatDateLocal(selectedDate);
      
      // CRITICAL FIX: Extract behavior category and reflection type from the goal
      // This ensures the reflection is created with the correct category and type
      const reflectionCategory = goal.behaviorCategories && goal.behaviorCategories.length > 0
        ? goal.behaviorCategories[0]
        : null;
      
      // Map goal type to reflection type
      const reflectionType: 'Proactive' | 'Restraint' = 
        goal.type === 'PROACTIVE' ? 'Proactive' : 'Restraint';
      
      const apiEndpoint = `/api/goals/${goalId}/struggle`;
      const apiPayload = {
        timestamp,
        date: localDateString,
        category: reflectionCategory,
        type: reflectionType,
        linkedGoalId: goal.id,
      };
      
      console.log("[Home iOS] ========== MAKING API CALL ==========");
      console.log("[Home iOS] Endpoint:", apiEndpoint);
      console.log("[Home iOS] Payload:", JSON.stringify(apiPayload, null, 2));
      console.log("[Home iOS] Local date string:", localDateString);
      console.log("[Home iOS] Calling authenticatedPost...");
      
      const response: any = await authenticatedPost(apiEndpoint, apiPayload);
      
      console.log("[Home iOS] ========== API CALL SUCCESSFUL ==========");
      console.log("[Home iOS] Response:", JSON.stringify(response, null, 2));
      
      // Update with real entry ID from backend
      setActivatedGoals(prevGoals => 
        prevGoals.map(g => {
          if (g.id === goalId) {
            return {
              ...g,
              dailyEntries: g.dailyEntries?.map(e => 
                e.id === newEntry.id ? { ...e, id: response?.entryId || e.id } : e
              ),
              todayStruggleCount: response?.todayStruggleCount !== undefined ? response.todayStruggleCount : g.todayStruggleCount,
              struggleCount: response?.struggleCount !== undefined ? response.struggleCount : g.struggleCount,
              currentStreak: response?.currentStreak !== undefined ? response.currentStreak : g.currentStreak,
              bestStreak: response?.bestStreak !== undefined ? response.bestStreak : g.bestStreak,
            };
          }
          return g;
        })
      );
      
      console.log("[Home iOS] Struggle recorded successfully, entry ID:", response?.entryId);
      console.log("[Home iOS] ========== STRUGGLE COMPLETE ==========");
      
      // Reload data to ensure everything is in sync
      await loadData(true, true);
    } catch (error: any) {
      console.error("[Home iOS] ========== API CALL FAILED ==========");
      console.error("[Home iOS] Error:", error);
      console.error("[Home iOS] Error message:", error.message);
      console.error("[Home iOS] Error stack:", error.stack);
      console.error("[Home iOS] Full error object:", JSON.stringify(error, null, 2));
      
      // Rollback optimistic update
      setActivatedGoals(prevGoals => 
        prevGoals.map(g => {
          if (g.id === goalId) {
            const filteredEntries = (g.dailyEntries || []).filter(e => e.id !== newEntry.id);
            return {
              ...g,
              dailyEntries: filteredEntries,
              todayStruggleCount: Math.max(0, g.todayStruggleCount - 1),
            };
          }
          return g;
        })
      );
      
      showError(`Failed to record struggle: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDeleteEntry = async (goalId: string, entryId: string) => {
    console.log("[Home iOS] Deleting entry:", entryId, "for goal:", goalId);
    
    // Store the entry type before deletion for optimistic UI update
    const goal = activatedGoals.find(g => g.id === goalId);
    const entryToDelete = goal?.dailyEntries?.find(e => e.id === entryId);
    
    if (!entryToDelete) {
      console.error("[Home iOS] Entry not found in local state:", entryId);
      showError("Entry not found");
      return;
    }
    
    console.log("[Home iOS] Entry to delete:", entryToDelete.type, "timestamp:", entryToDelete.timestamp);
    
    // Optimistic UI update: remove entry from local state immediately
    setActivatedGoals(prevGoals => 
      prevGoals.map(g => {
        if (g.id === goalId) {
          const filteredEntries = (g.dailyEntries || []).filter(e => e.id !== entryId);
          return {
            ...g,
            dailyEntries: filteredEntries,
            todaySuccessCount: entryToDelete.type === 'success' ? Math.max(0, g.todaySuccessCount - 1) : g.todaySuccessCount,
            todayStruggleCount: entryToDelete.type === 'struggle' ? Math.max(0, g.todayStruggleCount - 1) : g.todayStruggleCount,
          };
        }
        return g;
      })
    );
    
    try {
      // Call the backend API to delete the entry
      console.log(`[Home iOS] [API] Deleting entry ${entryId} for goal ${goalId}`);
      const response: any = await authenticatedDelete(`/api/goals/${goalId}/entries/${entryId}`);
      console.log("[Home iOS] Entry deleted successfully via API, response:", response);
      
      // CRITICAL FIX: Update streak values from the backend response
      // The backend now recalculates streaks after deletion and returns the new values
      if (response && (response.currentStreak !== undefined || response.bestStreak !== undefined)) {
        console.log(`[Home iOS] [API] Updating streaks from backend: current=${response.currentStreak}, best=${response.bestStreak}`);
        setActivatedGoals(prevGoals => 
          prevGoals.map(g => {
            if (g.id === goalId) {
              return {
                ...g,
                currentStreak: response.currentStreak !== undefined ? response.currentStreak : g.currentStreak,
                bestStreak: response.bestStreak !== undefined ? response.bestStreak : g.bestStreak,
              };
            }
            return g;
          })
        );
      } else {
        // Fallback: reload data if backend doesn't return streak values
        console.log(`[Home iOS] [API] No streak values in response, reloading data`);
        await loadData(true, true);
      }
    } catch (error: any) {
      console.error("[Home iOS] Error deleting entry:", error);
      console.error("[Home iOS] Error details:", JSON.stringify(error, null, 2));
      
      // Show user-friendly error message
      const errorMsg = error.message || "Failed to delete entry";
      showError(errorMsg);
      
      // Revert optimistic update by reloading data
      await loadData(true, true);
    }
  };

  const handleEditGoal = (goalId: string) => {
    console.log("Opening goal editor for iOS:", goalId);
    router.push(`/create-goal?id=${goalId}`);
  };

  const handleCreateGoal = () => {
    console.log("Opening goal creation screen iOS");
    router.push('/create-goal');
  };

  const openAddReflectionModal = (goalId?: string) => {
    console.log("Opening Add Reflection modal from Home iOS", goalId ? `for goal: ${goalId}` : "");
    setPrefilledGoalId(goalId);
    setEditingReflection(null);
    
    if (goalId && currentView === 'express') {
      const goal = activatedGoals.find(g => g.id === goalId);
      if (goal) {
        console.log('[Home iOS] Pre-filling reflection modal with goal data:', {
          category: goal.behaviorCategories?.[0],
          type: goal.type === 'PROACTIVE' ? 'Proactive' : 'Restraint',
          description: goal.title,
        });
        
        const reflectionType: 'Restraint' | 'Proactive' = 
          goal.type === 'RESTRAINING' ? 'Restraint' : 'Proactive';
        
        const behaviorCategory = goal.behaviorCategories?.[0];
        
        setPrefilledGoalData({
          category: behaviorCategory,
          type: reflectionType,
          description: goal.title,
        });
      } else {
        setPrefilledGoalData(undefined);
      }
    } else {
      setPrefilledGoalData(undefined);
    }
    
    setShowAddReflectionModal(true);
  };

  const openEditReflectionModal = (reflection: Reflection) => {
    console.log('[Home iOS] Opening edit reflection modal with reflection:', {
      id: reflection.id,
      linkedGoalId: reflection.linkedGoalId,
      outcome: reflection.outcome,
      category: reflection.category,
      type: reflection.type,
    });
    setEditingReflection(reflection);
    setPrefilledGoalId(undefined);
    setPrefilledGoalData(undefined);
    setShowAddReflectionModal(true);
  };

  const handleReflectionSaved = async (reflection: Reflection) => {
    console.log('[Home iOS] Reflection saved, closing modal and reloading data');
    if (editingReflection) {
      setReflections(reflections.map(r => r.id === reflection.id ? reflection : r));
    } else {
      setReflections([...reflections, reflection]);
    }
    setShowAddReflectionModal(false);
    setPrefilledGoalId(undefined);
    setEditingReflection(null);
    setPrefilledGoalData(undefined);
    showSuccess('Reflection saved successfully');
    
    // CRITICAL FIX: Reload data in the background to update Reflect section
    // This ensures that when a success/struggle is recorded in Express, the Reflect section updates immediately
    await loadData(true, true); // isRefreshing=true, preserveView=true
    console.log('[Home iOS] Data reloaded after reflection saved, Reflect section updated');
  };

  const handleDeleteReflection = async (id: string) => {
    console.log('Deleting reflection iOS:', id);
    try {
      setLoading(true);
      await authenticatedDelete(`/api/reflections/${id}`);
      setReflections(reflections.filter(r => r.id !== id));
      showSuccess('Reflection deleted successfully');
    } catch (error) {
      console.error('Error deleting reflection iOS:', error);
      showError('Failed to delete reflection');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenJournalModal = () => {
    console.log('Opening journal modal iOS');
    setTempJournalContent(journalContent);
    setShowJournalModal(true);
  };

  const handleCloseJournalModal = () => {
    console.log('Closing journal modal without saving iOS');
    setShowJournalModal(false);
    setTempJournalContent('');
  };

  const handleSaveJournal = async () => {
    console.log('Saving journal entry iOS...');
    try {
      setLoading(true);
      const dateString = formatDateLocal(selectedDate);
      
      const response = await authenticatedPost('/api/journals/by-date', {
        date: dateString,
        content: tempJournalContent,
      });

      const savedEntry = response?.data || response;
      
      if (savedEntry && savedEntry.deleted) {
        console.log('Journal entry deleted (content was empty) iOS');
        setJournalEntry(null);
        setJournalContent('');
        showSuccess('Journal entry deleted');
      } else if (savedEntry) {
        console.log('Journal entry saved iOS');
        setJournalEntry(savedEntry);
        setJournalContent(tempJournalContent);
        showSuccess('Journal saved successfully');
      } else {
        console.log('No journal entry (content was empty and no existing entry) iOS');
        setJournalEntry(null);
        setJournalContent('');
      }
      
      setShowJournalModal(false);
      setTempJournalContent('');
    } catch (error) {
      console.error('Error saving journal iOS:', error);
      showError('Failed to save journal entry');
    } finally {
      setLoading(false);
    }
  };

  const toggleLifeArea = (areaId: string) => {
    setCollapsedAreas(prev => ({
      ...prev,
      [areaId]: !prev[areaId],
    }));
  };

  const toggleReflectionCategory = (category: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
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

  const handleDateChange = (event: any, date?: Date) => {
    // On iOS with inline display, keep the modal open until user taps Done
    if (date) {
      setSelectedDate(date);
      console.log('[Home iOS] Date selected:', date.toISOString());
    }
    // Don't close the modal here - let the Done button handle it
  };

  const handleTodayPress = () => {
    const today = new Date();
    setSelectedDate(today);
    setShowDatePicker(false);
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

  const calculateDailyCurrencyTallies = (goal: ActivatedGoal) => {
    const dailySuccessEntries = goal.dailyEntries?.filter(e => e.type === 'success') || [];
    const dailyStruggleEntries = goal.dailyEntries?.filter(e => e.type === 'struggle') || [];
    const successCount = dailySuccessEntries.length;
    const struggleCount = dailyStruggleEntries.length;

    const tallies: {
      tally: number;
      currencySymbol: string;
      currencyType: 'reward' | 'consequence';
      currencyId: string;
    }[] = [];

    if (goal.rewardCurrencyId && goal.rewardAmount && goal.rewardSuccesses) {
      const rewardCurrency = currencies.find(c => c.id === goal.rewardCurrencyId);
      if (rewardCurrency) {
        const completedRewardSets = Math.floor(successCount / goal.rewardSuccesses);
        if (completedRewardSets > 0) {
          const rewardAmount = completedRewardSets * goal.rewardAmount;
          let rewardTally = 0;
          
          if (rewardCurrency.onSuccess === 'ADD') {
            rewardTally = rewardAmount;
          } else if (rewardCurrency.onSuccess === 'SUBTRACT') {
            rewardTally = -rewardAmount;
          }
          
          if (rewardTally !== 0) {
            tallies.push({
              tally: rewardTally,
              currencySymbol: rewardCurrency.symbol || '',
              currencyType: rewardCurrency.type || 'reward',
              currencyId: rewardCurrency.id,
            });
          }
        }
      }
    }

    if (goal.consequenceCurrencyId && goal.consequenceAmount && goal.consequenceFailures) {
      const consequenceCurrency = currencies.find(c => c.id === goal.consequenceCurrencyId);
      if (consequenceCurrency) {
        const completedConsequenceSets = Math.floor(struggleCount / goal.consequenceFailures);
        if (completedConsequenceSets > 0) {
          const consequenceAmount = completedConsequenceSets * goal.consequenceAmount;
          let consequenceTally = 0;
          
          if (consequenceCurrency.onFailure === 'ADD') {
            consequenceTally = consequenceAmount;
          } else if (consequenceCurrency.onFailure === 'SUBTRACT') {
            consequenceTally = -consequenceAmount;
          }
          
          if (consequenceTally !== 0) {
            const existingTallyIndex = tallies.findIndex(t => t.currencyId === consequenceCurrency.id);
            if (existingTallyIndex !== -1) {
              tallies[existingTallyIndex].tally += consequenceTally;
            } else {
              tallies.push({
                tally: consequenceTally,
                currencySymbol: consequenceCurrency.symbol || '',
                currencyType: consequenceCurrency.type || 'consequence',
                currencyId: consequenceCurrency.id,
              });
            }
          }
        }
      }
    }
    
    return tallies.filter(t => t.tally !== 0);
  };

  const getCategoryIcon = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower === 'action') return { ios: 'figure.walk', android: 'directions-run' };
    if (categoryLower === 'speech') return { ios: 'bubble.left.fill', android: 'chat-bubble' };
    if (categoryLower === 'thought') return { ios: 'cloud.fill', android: 'cloud' };
    if (categoryLower === 'feeling') return { ios: 'heart.fill', android: 'favorite' };
    return { ios: 'sparkles', android: 'auto-awesome' };
  };

  const countTotalGoals = (area: LifeAreaNode): number => {
    let count = area.goals.length;
    for (const child of area.children) {
      count += countTotalGoals(child);
    }
    return count;
  };

  const hasActiveGoalsInHierarchy = (area: LifeAreaNode): boolean => {
    if (area.goals.length > 0) return true;
    
    for (const child of area.children) {
      if (hasActiveGoalsInHierarchy(child)) return true;
    }
    
    return false;
  };

  const getGoalsForArea = (areaId: string): ActivatedGoal[] => {
    return activatedGoals.filter(goal => goal.lifeArea?.id === areaId);
  };

  const handleScroll = (event: any) => {
    scrollPositionRef.current = event.nativeEvent.contentOffset.y;
  };

  const calculateLifetimeTotals = () => {
    const lifetimeSuccesses = activatedGoals.reduce((sum, goal) => sum + goal.successCount, 0);
    return lifetimeSuccesses;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Helper: check if selected date is today
  const isViewingToday = (): boolean => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const selectedStr = formatDateLocal(selectedDate);
    return todayStr === selectedStr;
  };

  // Helper: determine if streak should be faded (today's screen, no success yet)
  const shouldFadeStreakIOS = (goal: ActivatedGoal): boolean => {
    if (!isViewingToday()) return false;
    const todaySuccessCount = goal.dailyEntries?.filter(e => e.type === 'success').length || 0;
    return todaySuccessCount === 0;
  };

  // CRITICAL FIX: Helper to get the current streak value.
  // After the backend fix, GET /activated-today returns `currentStreak` calculated from
  // the day BEFORE the requested date (excludes today). The loadData normalization above
  // adjusts this value by +1 when viewing today with successes, so goal.currentStreak
  // already contains the correct display value:
  // - No success today: currentStreak = streak-before-today (shown faded)
  // - Has success today: currentStreak = streak-including-today (shown solid)
  const getStreakBeforeTodayIOS = (goal: ActivatedGoal): number => {
    return goal.currentStreak || 0;
  };

  const renderGoalCard = (goal: ActivatedGoal) => {
    const typeIcon = goal.type === 'RESTRAINING' ? 'cancel' : 'check-circle';
    const typeColor = goal.type === 'RESTRAINING' ? colors.error : colors.success;
    
    const dailySuccessEntries = goal.dailyEntries?.filter(e => e.type === 'success') || [];
    const dailyStruggleEntries = goal.dailyEntries?.filter(e => e.type === 'struggle') || [];
    const successCount = dailySuccessEntries.length;
    const struggleCount = dailyStruggleEntries.length;
    
    const hasDescription = goal.description && goal.description.trim().length > 0;
    
    const currencyTallies = calculateDailyCurrencyTallies(goal);
    const hasCurrencyTallies = currencyTallies.length > 0;

    // CRITICAL FIX: Streak display logic
    // - On today's screen: ONLY show if currentStreak > 0 OR if there's a success today
    // - If streak is broken (currentStreak = 0) and no success today, don't show anything
    // - On past/future dates: only show streak if > 0, never faded
    const currentStreak = getStreakBeforeTodayIOS(goal);
    const isFaded = shouldFadeStreakIOS(goal);
    const streakColor = isFaded ? colors.textSecondary : '#FF6B35';
    const streakOpacity = isFaded ? 0.5 : 1.0;
    
    // CRITICAL FIX: Determine if we should show the streak at all
    // On today's screen: ONLY show if currentStreak > 0 OR if there's a success today
    // If currentStreak = 0 and no success today, DON'T show the faded streak (it's broken)
    const todaySuccessCount = goal.dailyEntries?.filter(e => e.type === 'success').length || 0;
    const shouldShowStreakOnToday = currentStreak > 0 || todaySuccessCount > 0;
    
    return (
      <View key={goal.id} style={styles.goalCard}>
        <View style={styles.goalCardHeader}>
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
          
          {hasCurrencyTallies && (
            <View style={styles.currencyTalliesContainer}>
              {currencyTallies.map((tally, index) => {
                const tallyColor = tally.currencyType === 'reward' ? colors.success : colors.error;
                const displayTally = tally.tally < 0 ? `-${Math.abs(tally.tally)}` : `${tally.tally}`;
                const currencySymbolText = tally.currencySymbol;
                
                return (
                  <View key={index} style={styles.currencyTallyBadge}>
                    {currencySymbolText && (
                      <Text style={styles.currencySymbolText}>
                        {currencySymbolText}
                      </Text>
                    )}
                    <Text style={[styles.currencyTallyText, { color: tallyColor }]}>
                      {displayTally}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
        
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
          {isViewingToday() ? (
            // On today's screen: ONLY show streak if currentStreak > 0 OR if there's a success today
            // If streak is broken (currentStreak = 0) and no success today, don't show anything
            shouldShowStreakOnToday && (
              <View style={[styles.tallySection, { opacity: streakOpacity }]}>
                <IconSymbol
                  ios_icon_name="flame.fill"
                  android_material_icon_name="local-fire-department"
                  size={16}
                  color={streakColor}
                />
                <Text style={[styles.tallyCount, { color: streakColor }]}>{currentStreak}</Text>
              </View>
            )
          ) : (
            // On past/future dates: only show streak if > 0
            currentStreak > 0 && (
              <View style={styles.tallySection}>
                <IconSymbol
                  ios_icon_name="flame.fill"
                  android_material_icon_name="local-fire-department"
                  size={16}
                  color="#FF6B35"
                />
                <Text style={[styles.tallyCount, { color: '#FF6B35' }]}>{currentStreak}</Text>
              </View>
            )
          )}
          {goal.bestStreak !== undefined && goal.bestStreak > 0 && (
            <View style={styles.tallySection}>
              <IconSymbol
                ios_icon_name="star.fill"
                android_material_icon_name="star"
                size={16}
                color="#FFD700"
              />
              <Text style={[styles.tallyCount, { color: '#FFD700' }]}>{goal.bestStreak}</Text>
            </View>
          )}
        </View>
        
        {goal.dailyEntries && goal.dailyEntries.length > 0 && (
          <View style={styles.entriesContainer}>
            {goal.dailyEntries.map((entry) => {
              const isSuccess = entry.type === 'success';
              const entryColor = isSuccess ? colors.success : colors.error;
              const entryIcon = isSuccess ? 'check' : 'close';
              
              return (
                <View
                  key={entry.id}
                  style={[styles.entryBadge, { borderColor: entryColor }]}
                >
                  <TouchableOpacity
                    onPress={() => {
                      // CRITICAL FIX: When clicking on an entry badge, we need to find the corresponding reflection
                      // and open it for editing, NOT create a new reflection
                      console.log('[Home iOS] Entry badge clicked, looking for reflection with entryId:', entry.id);
                      
                      // Find the reflection that corresponds to this entry
                      const reflection = reflections.find(r => 
                        r.linkedGoalId === goal.id && 
                        r.outcome === (isSuccess ? 'success' : 'struggled') &&
                        // Match by timestamp (within same day)
                        r.entryDate === formatDateLocal(selectedDate)
                      );
                      
                      if (reflection) {
                        console.log('[Home iOS] Found reflection for entry, opening edit modal:', reflection.id);
                        openEditReflectionModal(reflection);
                      } else {
                        console.log('[Home iOS] No reflection found for entry, creating new one with goal:', goal.id);
                        openAddReflectionModal(goal.id);
                      }
                    }}
                    style={styles.entryEditSection}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <IconSymbol
                      ios_icon_name={isSuccess ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
                      android_material_icon_name={isSuccess ? 'check-circle' : 'cancel'}
                      size={24}
                      color={entryColor}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteEntryButton}
                    onPress={() => handleDeleteEntry(goal.id, entry.id)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    <IconSymbol
                      ios_icon_name="trash.fill"
                      android_material_icon_name="delete"
                      size={22}
                      color={colors.error}
                    />
                  </TouchableOpacity>
                </View>
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
              size={16}
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
              size={16}
              color="#FFFFFF"
            />
            <Text style={styles.actionButtonText}>Struggle</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.reflectionButton]}
            onPress={() => openAddReflectionModal(goal.id)}
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

  const renderConciseGoalCard = (goal: ActivatedGoal) => {
    const dailySuccessEntries = goal.dailyEntries?.filter(e => e.type === 'success') || [];
    const dailyStruggleEntries = goal.dailyEntries?.filter(e => e.type === 'struggle') || [];
    const successCount = dailySuccessEntries.length;
    const struggleCount = dailyStruggleEntries.length;
    
    const currencyTallies = calculateDailyCurrencyTallies(goal);

    // CRITICAL FIX: Streak display logic for concise view
    const currentStreak = getStreakBeforeTodayIOS(goal);
    const isFadedConcise = shouldFadeStreakIOS(goal);
    const streakColorConcise = isFadedConcise ? colors.textSecondary : '#FF6B35';
    const streakOpacityConcise = isFadedConcise ? 0.5 : 1.0;
    
    // CRITICAL FIX: Determine if we should show the streak at all
    // On today's screen: ONLY show if currentStreak > 0 OR if there's a success today
    // If currentStreak = 0 and no success today, DON'T show the faded streak (it's broken)
    const todaySuccessCountConcise = goal.dailyEntries?.filter(e => e.type === 'success').length || 0;
    const shouldShowStreakOnTodayConcise = currentStreak > 0 || todaySuccessCountConcise > 0;
    
    return (
      <TouchableOpacity 
        key={goal.id} 
        style={styles.conciseGoalCard}
        onPress={() => handleEditGoal(goal.id)}
        activeOpacity={0.7}
      >
        <Text style={styles.conciseGoalTitle} numberOfLines={1}>{goal.title}</Text>
        <View style={styles.conciseCounters}>
          <View style={styles.conciseCounter}>
            <Text style={[styles.conciseCounterText, { color: colors.success }]}>✓{successCount}</Text>
          </View>
          <View style={styles.conciseCounter}>
            <Text style={[styles.conciseCounterText, { color: colors.error }]}>✗{struggleCount}</Text>
          </View>
          {isViewingToday() ? (
            // On today's screen: ONLY show streak if currentStreak > 0 OR if there's a success today
            // If streak is broken (currentStreak = 0) and no success today, don't show anything
            shouldShowStreakOnTodayConcise && (
              <View style={[styles.conciseCounter, { opacity: streakOpacityConcise }]}>
                <Text style={[styles.conciseCounterText, { color: streakColorConcise }]}>🔥{currentStreak}</Text>
              </View>
            )
          ) : (
            // On past/future dates: only show streak if > 0
            currentStreak > 0 && (
              <View style={styles.conciseCounter}>
                <Text style={[styles.conciseCounterText, { color: '#FF6B35' }]}>🔥{currentStreak}</Text>
              </View>
            )
          )}
          {goal.bestStreak !== undefined && goal.bestStreak > 0 && (
            <View style={styles.conciseCounter}>
              <Text style={[styles.conciseCounterText, { color: '#FFD700' }]}>⭐{goal.bestStreak}</Text>
            </View>
          )}
          {currencyTallies.map((tally, index) => (
            <View key={index} style={styles.conciseCounter}>
              <Text style={[styles.conciseCounterText, { color: tally.currencyType === 'reward' ? colors.success : colors.error }]}>
                {tally.currencySymbol}{Math.abs(tally.tally)}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.conciseActions}>
          <TouchableOpacity
            style={styles.conciseCheckButton}
            onPress={(e) => {
              e.stopPropagation();
              handleGoalSuccess(goal.id);
            }}
          >
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={20}
              color={colors.success}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.conciseStruggleButton}
            onPress={(e) => {
              e.stopPropagation();
              handleGoalStruggle(goal.id);
            }}
          >
            <IconSymbol
              ios_icon_name="xmark.circle.fill"
              android_material_icon_name="cancel"
              size={20}
              color={colors.error}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLifeAreaNode = (area: LifeAreaNode, depth: number = 0): React.ReactNode => {
    // CRITICAL FIX: Check if this area or any of its children have goals scheduled for today
    // If not, don't render anything (not even the header)
    if (!hasActiveGoalsInHierarchy(area)) {
      console.log(`[Home iOS] Skipping life area "${area.name}" - no active goals in hierarchy`);
      return null;
    }
    
    const isCollapsed = collapsedAreas[area.id];
    const goalsForThisArea = getGoalsForArea(area.id);
    const hasGoals = goalsForThisArea.length > 0;
    
    // Filter children to only include those with active goals
    const childrenWithGoals = area.children.filter(child => hasActiveGoalsInHierarchy(child));
    const hasChildren = childrenWithGoals.length > 0;
    
    // CRITICAL FIX: If this area has no direct goals AND no children with goals, don't render it
    // This prevents empty life area headers from showing
    if (!hasGoals && !hasChildren) {
      console.log(`[Home iOS] Skipping life area "${area.name}" - no direct goals and no children with goals`);
      return null;
    }
    
    const areaIconName = area.icon;
    const areaColor = area.color || colors.primary;
    
    return (
      <View key={area.id} style={styles.lifeAreaSection}>
        <TouchableOpacity 
          style={[styles.lifeAreaHeader, { marginLeft: depth * 12 }]}
          onPress={() => toggleLifeArea(area.id)}
        >
          <View style={styles.lifeAreaTitleRow}>
            <IconSymbol
              ios_icon_name={isCollapsed ? 'chevron.right' : 'chevron.down'}
              android_material_icon_name={isCollapsed ? 'arrow-forward' : 'arrow-downward'}
              size={16}
              color={colors.text}
            />
            {areaIconName && (
              <Text style={[styles.lifeAreaIcon, { color: areaColor }]}>
                {areaIconName}
              </Text>
            )}
            <Text style={styles.lifeAreaTitle}>{area.name}</Text>
          </View>
        </TouchableOpacity>
        
        {!isCollapsed && (
          <>
            {hasGoals && goalsForThisArea.map(goal => 
              expressViewMode === 'detailed' ? renderGoalCard(goal) : renderConciseGoalCard(goal)
            )}
            
            {hasChildren && childrenWithGoals.map(child => renderLifeAreaNode(child, depth + 1))}
          </>
        )}
      </View>
    );
  };

  const dateDisplay = formatDateDisplay(selectedDate);

  const goalsForModal = activatedGoals.map(g => ({
    id: g.id,
    title: g.title,
    behaviorCategories: g.behaviorCategories,
    rewardCurrencyId: g.rewardCurrencyId,
    rewardAmount: g.rewardAmount,
    rewardSuccesses: g.rewardSuccesses,
    consequenceCurrencyId: g.consequenceCurrencyId,
    consequenceAmount: g.consequenceAmount,
    consequenceFailures: g.consequenceFailures,
    successCount: g.successCount,
    struggleCount: g.struggleCount,
  }));

  const categoriesEnabled = userPreferences.reflectionCategoriesEnabled !== false;
  const availableCategories = userPreferences.reflectionCategories || ['Action', 'Speech', 'Thought'];

  // CRITICAL FIX: When grouping reflections by category, we need to use the GOAL's behaviorCategory
  // NOT the reflection's category field (which may be undefined for quick entries from Express screen)
  const groupedReflections: Record<string, Reflection[]> = {};
  if (categoriesEnabled) {
    availableCategories.forEach(cat => {
      groupedReflections[cat] = reflections.filter(r => {
        // If reflection has a category field, use it
        if (r.category) {
          return r.category === cat;
        }
        // Otherwise, look up the goal's behaviorCategories
        if (r.linkedGoalId) {
          const goal = activatedGoals.find(g => g.id === r.linkedGoalId);
          if (goal && goal.behaviorCategories && goal.behaviorCategories.length > 0) {
            // Use the FIRST behavior category from the goal
            return goal.behaviorCategories[0] === cat;
          }
        }
        return false;
      });
    });
    groupedReflections['Other'] = reflections.filter(r => {
      if (r.category && availableCategories.includes(r.category)) {
        return false;
      }
      if (r.linkedGoalId) {
        const goal = activatedGoals.find(g => g.id === r.linkedGoalId);
        if (goal && goal.behaviorCategories && goal.behaviorCategories.length > 0) {
          return !availableCategories.includes(goal.behaviorCategories[0]);
        }
      }
      return true;
    });
  } else {
    groupedReflections['All'] = reflections;
  }

  const hasJournalContent = journalContent && journalContent.trim().length > 0;
  const journalPreview = hasJournalContent ? journalContent.substring(0, 100) + (journalContent.length > 100 ? '...' : '') : '';

  const uncategorizedGoals = activatedGoals.filter(goal => !goal.lifeArea);

  const lifetimeSuccessCount = calculateLifetimeTotals();

  const alternativeCalendarDate = userPreferences.alternativeCalendar && userPreferences.alternativeCalendar !== 'gregorian' 
    ? formatAlternativeDate(selectedDate, userPreferences.alternativeCalendar) 
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        minimumZoomScale={1.0}
        maximumZoomScale={1.5}
        bouncesZoom={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/Chesbon_app_Logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Cheshbon</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.actionButtonLarge, currentView === 'reflect' && styles.actionButtonLargeActive]}
            onPress={() => {
              console.log("Switching to Reflect view iOS");
              setCurrentView('reflect');
            }}
          >
            <IconSymbol
              ios_icon_name="square.and.pencil"
              android_material_icon_name="edit"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.actionButtonLargeText}>Reflect</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButtonLarge, currentView === 'express' && styles.actionButtonLargeActive]}
            onPress={() => {
              console.log("Switching to Express view iOS");
              setCurrentView('express');
            }}
          >
            <IconSymbol
              ios_icon_name="bolt.fill"
              android_material_icon_name="flash-on"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.actionButtonLargeText}>Express</Text>
          </TouchableOpacity>
        </View>

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
          
          <TouchableOpacity onPress={() => {
            console.log("Opening date picker iOS");
            setShowDatePicker(true);
          }}>
            <Text style={styles.dateDisplay}>{dateDisplay}</Text>
            {alternativeCalendarDate && (
              <Text style={styles.alternativeCalendarDateSmall}>
                {alternativeCalendarDate}
              </Text>
            )}
          </TouchableOpacity>
          
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
          
          <View style={styles.lifetimeCounterContainer}>
            <IconSymbol
              ios_icon_name="checkmark"
              android_material_icon_name="check"
              size={10}
              color={colors.success}
            />
            <Text style={styles.lifetimeCounterText}>{lifetimeSuccessCount}</Text>
          </View>
        </View>

        {showDatePicker && (
          <Modal
            visible={showDatePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContainer}>
                <View style={styles.datePickerHeader}>
                  <Text style={styles.datePickerTitle}>Select Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.datePickerDone}>Done</Text>
                  </TouchableOpacity>
                </View>
                
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="inline"
                  onChange={handleDateChange}
                  style={{ backgroundColor: colors.background }}
                />
                
                <View style={styles.todayButtonContainer}>
                  <TouchableOpacity style={styles.todayButton} onPress={handleTodayPress}>
                    <IconSymbol
                      ios_icon_name="calendar"
                      android_material_icon_name="today"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.todayButtonText}>Today</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        <View style={styles.content}>
          {currentView === 'reflect' ? (
            <>
              <TouchableOpacity 
                style={styles.journalCard}
                onPress={handleOpenJournalModal}
                activeOpacity={0.7}
              >
                <View style={styles.journalCardHeader}>
                  <View style={styles.journalCardTitleRow}>
                    <Image 
                      source={require('@/assets/images/Chesbon_app_Logo.png')} 
                      style={styles.journalAppIcon}
                    />
                    <Text style={styles.journalCardTitle}>Daily Journal</Text>
                  </View>
                </View>
                
                {!hasJournalContent ? (
                  <View style={styles.journalPlaceholder}>
                    <Image 
                      source={require('@/assets/images/Chesbon_app_Logo.png')} 
                      style={styles.journalPlaceholderIcon}
                    />
                    <Text style={styles.journalPlaceholderText}>Tap to write about your day…</Text>
                  </View>
                ) : (
                  <View style={styles.journalPreviewContainer}>
                    <Text style={styles.journalPreviewText} numberOfLines={3}>
                      {journalPreview}
                    </Text>
                    {journalEntry && (
                      <Text style={styles.journalTimestamp}>
                        Last saved: {new Date(journalEntry.updatedAt).toLocaleString()}
                      </Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderRow}>
                    <IconSymbol
                      ios_icon_name="sparkles"
                      android_material_icon_name="auto-awesome"
                      size={22}
                      color="#9B59B6"
                    />
                    <Text style={styles.sectionTitle}>Reflections</Text>
                  </View>
                  <TouchableOpacity onPress={() => openAddReflectionModal()} style={styles.addButton}>
                    <IconSymbol
                      ios_icon_name="plus.circle.fill"
                      android_material_icon_name="add-circle"
                      size={28}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                </View>

                {reflections.length === 0 ? (
                  <View style={styles.emptyState}>
                    <IconSymbol
                      ios_icon_name="sparkles"
                      android_material_icon_name="auto-awesome"
                      size={48}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.emptyStateText}>
                      No reflections for this day. Tap + to add one.
                    </Text>
                  </View>
                ) : (
                  Object.entries(groupedReflections).map(([category, categoryReflections], catIndex) => {
                    if (categoryReflections.length === 0) return null;
                    
                    const categoryIcon = getCategoryIcon(category);
                    const isCollapsed = collapsedCategories[category];
                    
                    return (
                      <React.Fragment key={catIndex}>
                        {categoriesEnabled && category !== 'All' && (
                          <TouchableOpacity 
                            style={styles.reflectionCategoryHeader}
                            onPress={() => toggleReflectionCategory(category)}
                          >
                            <IconSymbol
                              ios_icon_name={isCollapsed ? 'chevron.right' : 'chevron.down'}
                              android_material_icon_name={isCollapsed ? 'arrow-forward' : 'arrow-downward'}
                              size={20}
                              color={colors.text}
                            />
                            <IconSymbol
                              ios_icon_name={categoryIcon.ios}
                              android_material_icon_name={categoryIcon.android}
                              size={20}
                              color={colors.primary}
                            />
                            <Text style={styles.reflectionCategoryTitle}>{category}</Text>
                            <View style={styles.reflectionCategoryBadge}>
                              <Text style={styles.reflectionCategoryBadgeText}>{categoryReflections.length}</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                        
                        {!isCollapsed && categoryReflections.map((reflection, index) => {
                          const typeText = reflection.type;
                          const outcomeText = reflection.outcome ? 
                            (reflection.outcome === 'success' ? 'Success' : 'Struggled') : 
                            null;
                          
                          return (
                            <React.Fragment key={index}>
                              <View style={styles.reflectionCard}>
                                <View style={styles.reflectionHeader}>
                                  <View style={styles.reflectionBadges}>
                                    <View style={[styles.badge, reflection.type === 'Proactive' ? styles.badgeProactive : styles.badgeRestraint]}>
                                      <Text style={styles.badgeText}>{typeText}</Text>
                                    </View>
                                    {reflection.outcome && (
                                      <View style={[styles.badge, reflection.outcome === 'success' ? styles.badgeSuccess : styles.badgeStruggle]}>
                                        <Text style={styles.badgeText}>{outcomeText}</Text>
                                      </View>
                                    )}
                                  </View>
                                  <View style={styles.reflectionActions}>
                                    <TouchableOpacity
                                      onPress={() => openEditReflectionModal(reflection)}
                                      style={styles.iconButton}
                                    >
                                      <IconSymbol
                                        ios_icon_name="pencil"
                                        android_material_icon_name="edit"
                                        size={20}
                                        color={colors.primary}
                                      />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      onPress={() => handleDeleteReflection(reflection.id)}
                                      style={styles.iconButton}
                                    >
                                      <IconSymbol
                                        ios_icon_name="trash"
                                        android_material_icon_name="delete"
                                        size={20}
                                        color={colors.error}
                                      />
                                    </TouchableOpacity>
                                  </View>
                                </View>

                                <Text style={styles.reflectionDescription}>{reflection.description}</Text>

                                {reflection.linkedGoalId && (
                                  <View style={styles.linkedGoalSection}>
                                    <View style={styles.linkedGoalHeader}>
                                      <IconSymbol
                                        ios_icon_name="target"
                                        android_material_icon_name="flag"
                                        size={16}
                                        color={colors.primary}
                                      />
                                      <Text style={styles.linkedGoalLabel}>Linked Goal</Text>
                                    </View>
                                    <Text style={styles.linkedGoalTitle}>
                                      {reflection.linkedGoalTitle || goalsForModal.find(g => g.id === reflection.linkedGoalId)?.title || 'Unknown Goal'}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </View>
            </>
          ) : (
            <>
              <View style={styles.expressHeader}>
                <TouchableOpacity
                  style={styles.viewModeToggle}
                  onPress={() => {
                    console.log("Toggling Express view mode iOS");
                    setExpressViewMode(prev => prev === 'detailed' ? 'concise' : 'detailed');
                  }}
                >
                  <IconSymbol
                    ios_icon_name={expressViewMode === 'detailed' ? 'list.bullet' : 'square.grid.2x2'}
                    android_material_icon_name={expressViewMode === 'detailed' ? 'view-list' : 'view-module'}
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.viewModeToggleText}>
                    {expressViewMode === 'detailed' ? 'Concise' : 'Detailed'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addGoalButton}
                  onPress={handleCreateGoal}
                >
                  <IconSymbol
                    ios_icon_name="plus.circle.fill"
                    android_material_icon_name="add-circle"
                    size={32}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>

              {lifeAreaHierarchy.length === 0 && uncategorizedGoals.length === 0 ? (
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
                <>
                  {lifeAreaHierarchy.map(area => renderLifeAreaNode(area))}
                  
                  {uncategorizedGoals.length > 0 && lifeAreaHierarchy.length > 0 && (
                    <View style={styles.lifeAreaSection}>
                      <View style={styles.lifeAreaHeader}>
                        <View style={styles.lifeAreaTitleRow}>
                          <Text style={styles.lifeAreaTitle}>Uncategorized</Text>
                        </View>
                      </View>
                      {uncategorizedGoals.map(goal => 
                        expressViewMode === 'detailed' ? renderGoalCard(goal) : renderConciseGoalCard(goal)
                      )}
                    </View>
                  )}
                  
                  {uncategorizedGoals.length > 0 && lifeAreaHierarchy.length === 0 && (
                    <>
                      {uncategorizedGoals.map(goal => 
                        expressViewMode === 'detailed' ? renderGoalCard(goal) : renderConciseGoalCard(goal)
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showJournalModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseJournalModal}
      >
        <SafeAreaView style={styles.journalModalContainer} edges={['top', 'bottom']}>
          <KeyboardAvoidingView 
            style={styles.journalModalContent}
            behavior="padding"
          >
            <View style={styles.journalModalHeader}>
              <View style={styles.journalModalTitleRow}>
                <Image 
                  source={require('@/assets/images/Chesbon_app_Logo.png')} 
                  style={styles.journalModalIcon}
                />
                <Text style={styles.journalModalTitle}>Daily Journal</Text>
              </View>
              <TouchableOpacity onPress={handleCloseJournalModal} style={styles.closeButton}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={28}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.journalModalInput}
              value={tempJournalContent}
              onChangeText={setTempJournalContent}
              placeholder="Write your thoughts for today..."
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
              autoFocus
            />

            <TouchableOpacity
              style={styles.saveJournalButton}
              onPress={handleSaveJournal}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <React.Fragment>
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check-circle"
                    size={24}
                    color={colors.background}
                  />
                  <Text style={styles.saveJournalButtonText}>Save & Close</Text>
                </React.Fragment>
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {showAddReflectionModal && (
        <AddReflectionModal
          visible={showAddReflectionModal}
          onClose={() => {
            console.log('[Home iOS] Closing AddReflectionModal without saving');
            setShowAddReflectionModal(false);
            setPrefilledGoalId(undefined);
            setEditingReflection(null);
            setPrefilledGoalData(undefined);
          }}
          onSave={handleReflectionSaved}
          selectedDate={selectedDate}
          goals={goalsForModal}
          currencies={currencies}
          userPreferences={userPreferences}
          editingReflection={editingReflection}
          gainsLosses={gainsLosses}
          strategies={strategies}
          motivations={motivations}
          prefilledGoalId={prefilledGoalId}
          sourceScreen={currentView}
          prefilledGoalData={prefilledGoalData}
        />
      )}

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
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    gap: 12,
  },
  actionButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
    gap: 8,
    opacity: 0.6,
  },
  actionButtonLargeActive: {
    opacity: 1,
  },
  actionButtonLargeText: {
    fontSize: 16,
    fontWeight: '600',
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
  alternativeCalendarDateSmall: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    fontStyle: 'italic',
  },
  lifetimeCounterContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  lifetimeCounterText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.success,
  },
  content: {
    paddingHorizontal: 20,
  },
  expressHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addGoalButton: {
    padding: 4,
  },
  viewModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewModeToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  journalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  journalCardHeader: {
    marginBottom: 12,
  },
  journalCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  journalAppIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  journalCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  journalPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  journalPlaceholderIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    opacity: 0.5,
  },
  journalPlaceholderText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  journalPreviewContainer: {
    gap: 8,
  },
  journalPreviewText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  journalTimestamp: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  addButton: {
    padding: 4,
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
  reflectionCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 12,
  },
  reflectionCategoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  reflectionCategoryBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reflectionCategoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.background,
  },
  reflectionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reflectionBadges: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeProactive: {
    backgroundColor: colors.primary + '20',
  },
  badgeRestraint: {
    backgroundColor: colors.secondary + '20',
  },
  badgeSuccess: {
    backgroundColor: colors.success + '20',
  },
  badgeStruggle: {
    backgroundColor: colors.error + '20',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  reflectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  reflectionDescription: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
    lineHeight: 22,
  },
  linkedGoalSection: {
    backgroundColor: colors.primary + '10',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  linkedGoalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  linkedGoalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  linkedGoalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  lifeAreaSection: {
    marginBottom: 6,
  },
  lifeAreaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.card,
    borderRadius: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  lifeAreaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  lifeAreaIcon: {
    fontSize: 14,
  },
  lifeAreaTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  goalCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  goalCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
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
  currencyTalliesContainer: {
    flexDirection: 'column',
    gap: 4,
  },
  currencyTallyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencySymbolText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  currencyTallyText: {
    fontSize: 14,
    fontWeight: 'bold',
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
  entriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  entryBadge: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: colors.backgroundAlt,
    overflow: 'hidden',
    minWidth: 110,
    minHeight: 52,
  },
  entryEditSection: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  deleteEntryButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
    minHeight: 52,
    borderLeftWidth: 1,
    borderLeftColor: colors.error + '40',
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
    gap: 4,
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
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  conciseGoalCard: {
    backgroundColor: colors.card,
    borderRadius: 6,
    padding: 6,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  conciseGoalTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
  },
  conciseCounters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  conciseCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  conciseCounterText: {
    fontSize: 10,
    fontWeight: '600',
  },
  conciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  conciseCheckButton: {
    padding: 2,
  },
  conciseStruggleButton: {
    padding: 2,
  },
  journalModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  journalModalContent: {
    flex: 1,
    padding: 20,
  },
  journalModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  journalModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  journalModalIcon: {
    width: 24,
    height: 24,
    borderRadius: 5,
  },
  journalModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  journalModalInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  saveJournalButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveJournalButtonText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerContainer: {
    backgroundColor: colors.background,
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 400,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  datePickerDone: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  todayButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  todayButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
});
