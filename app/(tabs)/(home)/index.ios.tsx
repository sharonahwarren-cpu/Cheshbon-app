
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
} from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { AddReflectionModal } from "@/components/AddReflectionModal";
import { useRouter, useLocalSearchParams } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/styles/commonStyles";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedGet, authenticatedPost, authenticatedDelete } from "@/utils/api";
import DateTimePicker from '@react-native-community/datetimepicker';

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

interface Currency {
  id: string;
  name: string;
  symbol?: string;
  type?: 'reward' | 'consequence';
  onSuccess?: 'ADD' | 'SUBTRACT' | 'NONE';
  onFailure?: 'ADD' | 'SUBTRACT' | 'NONE';
}

interface CategoryGroup {
  name: string;
  id: string;
  level: number;
  subCategories: Record<string, CategoryGroup>;
  goals: ActivatedGoal[];
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

export default function HomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'reflect' | 'express'>('reflect');
  
  const [activatedGoals, setActivatedGoals] = useState<ActivatedGoal[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<Record<string, CategoryGroup>>({});
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');
  
  const [showAddReflectionModal, setShowAddReflectionModal] = useState(false);
  const [prefilledGoalId, setPrefilledGoalId] = useState<string | undefined>(undefined);
  const [gainsLosses, setGainsLosses] = useState<GainLoss[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({});

  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);
  const [journalContent, setJournalContent] = useState('');
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [tempJournalContent, setTempJournalContent] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingReflection, setEditingReflection] = useState<Reflection | null>(null);

  useEffect(() => {
    console.log("HomeScreen iOS mounted");
    loadData();
  }, []);

  useEffect(() => {
    console.log("Selected date changed iOS, reloading data:", selectedDate);
    loadData();
  }, [selectedDate]);

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

  const loadData = async () => {
    console.log("Loading home screen data iOS");
    setLoading(true);
    try {
      const dateString = formatDateLocal(selectedDate);
      const [goalsRes, currenciesRes, gainsLossesRes, strategiesRes, prefsRes, journalRes, reflectionsRes] = await Promise.all([
        authenticatedGet(`/api/goals/activated-today?date=${dateString}`),
        authenticatedGet('/api/currencies'),
        authenticatedGet('/api/gains-losses'),
        authenticatedGet('/api/strategies'),
        authenticatedGet('/api/user-preferences'),
        authenticatedGet(`/api/journals/by-date?date=${dateString}`),
        authenticatedGet(`/api/reflections/by-date?date=${dateString}`),
      ]);
      
      const goalsData = Array.isArray(goalsRes) ? goalsRes : (goalsRes?.data || []);
      const currenciesData = Array.isArray(currenciesRes) ? currenciesRes : (currenciesRes?.data || []);
      const gainsLossesData = Array.isArray(gainsLossesRes) ? gainsLossesRes : (gainsLossesRes?.data || []);
      const strategiesData = Array.isArray(strategiesRes) ? strategiesRes : (strategiesRes?.data || []);
      const prefsData = prefsRes?.data || prefsRes || {};
      const journalData = journalRes?.data || journalRes || null;
      const reflectionsData = Array.isArray(reflectionsRes) ? reflectionsRes : (reflectionsRes?.data || []);
      
      console.log('[Home iOS] Loaded currencies for modal:', currenciesData.length, 'currencies');
      
      setActivatedGoals(goalsData);
      setCurrencies(currenciesData);
      setGainsLosses(gainsLossesData);
      setStrategies(strategiesData);
      setUserPreferences(prefsData);
      setJournalEntry(journalData);
      setJournalContent(journalData?.content || '');
      setReflections(reflectionsData);
      
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
      console.log("Home data loaded successfully iOS");
    } catch (error: any) {
      console.error("Error loading home data iOS:", error);
      showError(error.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleGoalSuccess = async (goalId: string) => {
    console.log("Recording success for goal iOS:", goalId);
    try {
      const timestamp = new Date(selectedDate).toISOString();
      await authenticatedPost(`/api/goals/${goalId}/success`, { timestamp });
      await loadData();
    } catch (error: any) {
      console.error("Error recording success iOS:", error);
      showError(error.message || "Failed to record success");
    }
  };

  const handleGoalStruggle = async (goalId: string) => {
    console.log("Recording struggle for goal iOS:", goalId);
    try {
      const timestamp = new Date(selectedDate).toISOString();
      await authenticatedPost(`/api/goals/${goalId}/struggle`, { timestamp });
      await loadData();
    } catch (error: any) {
      console.error("Error recording struggle iOS:", error);
      showError(error.message || "Failed to record struggle");
    }
  };

  const handleDeleteEntry = async (goalId: string, entryId: string) => {
    console.log("Deleting entry iOS:", entryId, "for goal:", goalId);
    try {
      await authenticatedDelete(`/api/goals/${goalId}/entries/${entryId}`);
      await loadData();
    } catch (error: any) {
      console.error("Error deleting entry iOS:", error);
      showError(error.message || "Failed to delete entry");
    }
  };

  const handleEditGoal = (goalId: string) => {
    console.log("Opening goal editor for iOS:", goalId);
    router.push(`/create-goal?id=${goalId}`);
  };

  const openAddReflectionModal = (goalId?: string) => {
    console.log("Opening Add Reflection modal from Home iOS", goalId ? `for goal: ${goalId}` : "");
    setPrefilledGoalId(goalId);
    setEditingReflection(null);
    setShowAddReflectionModal(true);
  };

  const openEditReflectionModal = (reflection: Reflection) => {
    setEditingReflection(reflection);
    setPrefilledGoalId(undefined);
    setShowAddReflectionModal(true);
  };

  const handleReflectionSaved = (reflection: Reflection) => {
    console.log('[Home iOS] Reflection saved, closing modal and reloading data');
    if (editingReflection) {
      setReflections(reflections.map(r => r.id === reflection.id ? reflection : r));
    } else {
      setReflections([...reflections, reflection]);
    }
    setShowAddReflectionModal(false);
    setPrefilledGoalId(undefined);
    setEditingReflection(null);
    showSuccess('Reflection saved successfully');
    loadData();
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

  const toggleCategory = (categoryKey: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey],
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
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
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

    const tallies: Array<{ 
      tally: number; 
      currencySymbol: string; 
      currencyType: 'reward' | 'consequence';
      currencyId: string;
    }> = [];

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
    
    const currencyTallies = calculateDailyCurrencyTallies(goal);
    const hasCurrencyTallies = currencyTallies.length > 0;
    
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
        </View>
        
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
                  onPress={() => openAddReflectionModal(goal.id)}
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

  const groupedReflections: Record<string, Reflection[]> = {};
  if (categoriesEnabled) {
    availableCategories.forEach(cat => {
      groupedReflections[cat] = reflections.filter(r => r.category === cat);
    });
    groupedReflections['Other'] = reflections.filter(r => !r.category || !availableCategories.includes(r.category));
  } else {
    groupedReflections['All'] = reflections;
  }

  const hasJournalContent = journalContent && journalContent.trim().length > 0;
  const journalPreview = hasJournalContent ? journalContent.substring(0, 100) + (journalContent.length > 100 ? '...' : '') : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
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
          
          <TouchableOpacity onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateDisplay}>{dateDisplay}</Text>
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
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="inline"
            onChange={handleDateChange}
          />
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
          }}
          onSave={handleReflectionSaved}
          selectedDate={selectedDate}
          goals={goalsForModal}
          currencies={currencies}
          userPreferences={userPreferences}
          editingReflection={editingReflection}
          gainsLosses={gainsLosses}
          strategies={strategies}
          prefilledGoalId={prefilledGoalId}
          sourceScreen={currentView}
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
  content: {
    paddingHorizontal: 20,
  },
  journalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
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
    marginBottom: 16,
  },
  journalCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  journalAppIcon: {
    width: 42,
    height: 42,
    borderRadius: 9,
  },
  journalCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  journalPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  journalPlaceholderIcon: {
    width: 72,
    height: 72,
    borderRadius: 15,
    opacity: 0.6,
  },
  journalPlaceholderText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
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
});
