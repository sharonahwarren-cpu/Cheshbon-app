
import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedGet, authenticatedPost, authenticatedDelete } from "@/utils/api";
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from "@/styles/commonStyles";
import { AddReflectionModal } from "@/components/AddReflectionModal";
import { IconSymbol } from "@/components/IconSymbol";

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
  alternativeCalendar?: 'gregorian' | 'hebrew' | 'chinese' | 'islamic';
}

interface JournalEntry {
  id: string;
  content: string;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
}

// Helper function to format date as YYYY-MM-DD in local timezone
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to format alternative calendar date
function formatAlternativeDate(date: Date, calendarType: string): string {
  if (!calendarType || calendarType === 'gregorian') return '';
  
  try {
    if (calendarType === 'hebrew') {
      const hebrewDate = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
      return hebrewDate;
    } else if (calendarType === 'islamic') {
      const islamicDate = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
      return islamicDate;
    } else if (calendarType === 'chinese') {
      const chineseDate = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
      return chineseDate;
    }
  } catch (error) {
    console.error('Error formatting alternative calendar date:', error);
  }
  
  return '';
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ date?: string; openModal?: string; goalId?: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lifeAreas, setLifeAreas] = useState<LifeAreaNode[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [gainsLosses, setGainsLosses] = useState<GainLoss[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({});
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [expandedLifeAreas, setExpandedLifeAreas] = useState<Record<string, boolean>>({});

  const [showAddReflectionModal, setShowAddReflectionModal] = useState(false);
  const [editingReflection, setEditingReflection] = useState<Reflection | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [alternativeCalendar, setAlternativeCalendar] = useState<string>('gregorian');

  const [lifetimeTotals, setLifetimeTotals] = useState({ successes: 0, struggles: 0 });

  useEffect(() => {
    if (params.date) {
      const dateFromParam = new Date(params.date);
      if (!isNaN(dateFromParam.getTime())) {
        setSelectedDate(dateFromParam);
      }
    }
  }, [params.date]);

  useEffect(() => {
    if (params.openModal === 'true') {
      openAddReflectionModal();
    }
  }, [params.openModal, params.goalId]);

  useEffect(() => {
    loadData(false);
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
    setShowErrorModal(true);
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessModal(true);
  };

  const loadData = async (isRefreshing: boolean) => {
    const dateString = formatDateLocal(selectedDate);
    console.log('Loading home data for date (local):', dateString);
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [
        lifeAreasRes,
        currenciesRes,
        gainsLossesRes,
        strategiesRes,
        prefsRes,
        reflectionsRes,
        journalRes,
      ] = await Promise.all([
        authenticatedGet(`/api/goals/activated?date=${dateString}`),
        authenticatedGet('/api/currencies'),
        authenticatedGet('/api/gains-losses'),
        authenticatedGet('/api/strategies'),
        authenticatedGet('/api/user-preferences'),
        authenticatedGet(`/api/reflections/by-date?date=${dateString}`),
        authenticatedGet(`/api/journals/by-date?date=${dateString}`),
      ]);

      const lifeAreasData = Array.isArray(lifeAreasRes) ? lifeAreasRes : (lifeAreasRes?.data || []);
      const currenciesData = Array.isArray(currenciesRes) ? currenciesRes : (currenciesRes?.data || []);
      const gainsLossesData = Array.isArray(gainsLossesRes) ? gainsLossesRes : (gainsLossesRes?.data || []);
      const strategiesData = Array.isArray(strategiesRes) ? strategiesRes : (strategiesRes?.data || []);
      const prefsData = prefsRes?.data || prefsRes || {};
      const reflectionsData = Array.isArray(reflectionsRes) ? reflectionsRes : (reflectionsRes?.data || []);
      const journalData = journalRes?.data || journalRes || null;

      setLifeAreas(lifeAreasData);
      setCurrencies(currenciesData);
      setGainsLosses(gainsLossesData);
      setStrategies(strategiesData);
      setUserPreferences(prefsData);
      setReflections(reflectionsData);
      setJournalEntry(journalData);
      setAlternativeCalendar(prefsData.alternativeCalendar || 'gregorian');

      calculateLifetimeTotals();

      console.log('Home data loaded successfully');
    } catch (error) {
      console.error('Error loading home data:', error);
      showError('Failed to load home data');
    } finally {
      if (isRefreshing) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleRefresh = () => {
    loadData(true);
  };

  const handleGoalSuccess = async (goalId: string) => {
    console.log('Recording success for goal:', goalId);
    try {
      const dateString = formatDateLocal(selectedDate);
      await authenticatedPost(`/api/goals/${goalId}/success`, { date: dateString });
      showSuccess('Success recorded!');
      await loadData(false);
    } catch (error) {
      console.error('Error recording success:', error);
      showError('Failed to record success');
    }
  };

  const handleGoalStruggle = async (goalId: string) => {
    console.log('Recording struggle for goal:', goalId);
    try {
      const dateString = formatDateLocal(selectedDate);
      await authenticatedPost(`/api/goals/${goalId}/struggle`, { date: dateString });
      showSuccess('Struggle recorded');
      await loadData(false);
    } catch (error) {
      console.error('Error recording struggle:', error);
      showError('Failed to record struggle');
    }
  };

  const handleDeleteEntry = async (goalId: string, entryId: string) => {
    console.log('Deleting entry:', entryId, 'for goal:', goalId);
    try {
      await authenticatedDelete(`/api/goals/${goalId}/entries/${entryId}`);
      showSuccess('Entry deleted');
      await loadData(false);
    } catch (error) {
      console.error('Error deleting entry:', error);
      showError('Failed to delete entry');
    }
  };

  const handleEditGoal = (goalId: string) => {
    console.log('Navigating to edit goal:', goalId);
    router.push(`/create-goal?id=${goalId}`);
  };

  const handleCreateGoal = () => {
    console.log('Navigating to create goal');
    router.push('/create-goal');
  };

  const openAddReflectionModal = () => {
    const prefilledGoalId = params.goalId as string | undefined;
    setEditingReflection(null);
    setShowAddReflectionModal(true);
  };

  const openEditReflectionModal = (reflection: Reflection) => {
    setEditingReflection(reflection);
    setShowAddReflectionModal(true);
  };

  const handleReflectionSaved = (reflection: Reflection) => {
    console.log('Reflection saved, updating list');
    if (editingReflection) {
      setReflections(reflections.map(r => r.id === reflection.id ? reflection : r));
    } else {
      setReflections([...reflections, reflection]);
    }
    setShowAddReflectionModal(false);
    setEditingReflection(null);
    showSuccess('Reflection saved successfully');
  };

  const handleDeleteReflection = async (id: string) => {
    console.log('Deleting reflection:', id);
    try {
      await authenticatedDelete(`/api/reflections/${id}`);
      setReflections(reflections.filter(r => r.id !== id));
      showSuccess('Reflection deleted successfully');
    } catch (error) {
      console.error('Error deleting reflection:', error);
      showError('Failed to delete reflection');
    }
  };

  const toggleLifeArea = (areaId: string) => {
    setExpandedLifeAreas(prev => ({
      ...prev,
      [areaId]: !prev[areaId],
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

  const handleTodayPress = () => {
    setSelectedDate(new Date());
  };

  const formatDateDisplay = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    };
    return date.toLocaleDateString('en-US', options);
  };

  const calculateDailyCurrencyTallies = (goal: ActivatedGoal) => {
    const rewardTally = goal.todaySuccessCount || 0;
    const consequenceTally = goal.todayStruggleCount || 0;
    return { rewardTally, consequenceTally };
  };

  const getCategoryIcon = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower === 'action') return { ios: 'figure.walk', android: 'directions-run' };
    if (categoryLower === 'speech') return { ios: 'bubble.left.fill', android: 'chat-bubble' };
    if (categoryLower === 'thought') return { ios: 'brain.head.profile', android: 'psychology' };
    if (categoryLower === 'feeling') return { ios: 'heart.fill', android: 'favorite' };
    return { ios: 'sparkles', android: 'auto-awesome' };
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
    const findGoals = (areas: LifeAreaNode[]): ActivatedGoal[] => {
      for (const area of areas) {
        if (area.id === areaId) {
          return area.goals;
        }
        const childGoals = findGoals(area.children);
        if (childGoals.length > 0) return childGoals;
      }
      return [];
    };
    return findGoals(lifeAreas);
  };

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    console.log('Scroll offset:', offsetY);
  };

  const calculateLifetimeTotals = async () => {
    try {
      const response = await authenticatedGet('/api/goals/lifetime-totals');
      const data = response?.data || response || { successes: 0, struggles: 0 };
      setLifetimeTotals(data);
    } catch (error) {
      console.error('Error loading lifetime totals:', error);
    }
  };

  const renderConciseGoalCard = (goal: ActivatedGoal) => {
    return (
      <View key={goal.id} style={styles.conciseGoalCard}>
        <View style={styles.conciseGoalHeader}>
          <Text style={styles.conciseGoalTitle} numberOfLines={1}>{goal.title}</Text>
          <TouchableOpacity onPress={() => handleEditGoal(goal.id)} style={styles.editButton}>
            <IconSymbol
              ios_icon_name="pencil"
              android_material_icon_name="edit"
              size={16}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.conciseGoalActions}>
          <TouchableOpacity
            style={styles.conciseActionButton}
            onPress={() => handleGoalSuccess(goal.id)}
          >
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={20}
              color={colors.success}
            />
          </TouchableOpacity>
          <Text style={styles.conciseGoalStats}>
            {goal.todaySuccessCount || 0} / {goal.todayStruggleCount || 0}
          </Text>
          <TouchableOpacity
            style={styles.conciseActionButton}
            onPress={() => handleGoalStruggle(goal.id)}
          >
            <IconSymbol
              ios_icon_name="xmark.circle.fill"
              android_material_icon_name="cancel"
              size={20}
              color={colors.error}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderLifeAreaNode = (area: LifeAreaNode, depth: number) => {
    const isExpanded = expandedLifeAreas[area.id];
    const hasGoals = area.goals.length > 0;
    const hasChildren = area.children.length > 0;
    const totalGoals = countTotalGoals(area);
    const hasAnyGoals = hasActiveGoalsInHierarchy(area);

    if (!hasAnyGoals) return null;

    const areaIconName = area.icon || 'folder';
    const areaColor = area.color || colors.primary;

    return (
      <View key={area.id} style={[styles.lifeAreaContainer, { marginLeft: depth * 16 }]}>
        <TouchableOpacity
          style={styles.lifeAreaHeader}
          onPress={() => toggleLifeArea(area.id)}
        >
          <View style={styles.lifeAreaTitleRow}>
            <IconSymbol
              ios_icon_name={isExpanded ? 'chevron.down' : 'chevron.right'}
              android_material_icon_name={isExpanded ? 'arrow-downward' : 'arrow-forward'}
              size={20}
              color={colors.text}
            />
            <View style={[styles.lifeAreaIconContainer, { backgroundColor: areaColor + '20' }]}>
              <Text style={styles.lifeAreaIconText}>{areaIconName}</Text>
            </View>
            <Text style={styles.lifeAreaName}>{area.name}</Text>
          </View>
          <View style={styles.lifeAreaBadge}>
            <Text style={styles.lifeAreaBadgeText}>{totalGoals}</Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.lifeAreaContent}>
            {hasGoals && area.goals.map(goal => renderConciseGoalCard(goal))}
            {hasChildren && area.children.map(child => renderLifeAreaNode(child, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  const dateDisplay = formatDateDisplay(selectedDate);
  const alternativeDateDisplay = formatAlternativeDate(selectedDate, alternativeCalendar);
  const isToday = formatDateLocal(selectedDate) === formatDateLocal(new Date());

  const allGoals = lifeAreas.flatMap(area => {
    const collectGoals = (node: LifeAreaNode): ActivatedGoal[] => {
      return [...node.goals, ...node.children.flatMap(collectGoals)];
    };
    return collectGoal(area);
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Image 
              source={require('@/assets/images/Chesbon_app_Logo.png')} 
              style={styles.appLogo}
            />
            <Text style={styles.appName}>Cheshbon</Text>
          </View>
          
          <View style={styles.quickActionsRow}>
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => router.push('/reflect')}
            >
              <IconSymbol
                ios_icon_name="pencil"
                android_material_icon_name="edit"
                size={20}
                color={colors.background}
              />
              <Text style={styles.quickActionText}>Reflect</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={openAddReflectionModal}
            >
              <IconSymbol
                ios_icon_name="bolt.fill"
                android_material_icon_name="flash-on"
                size={20}
                color={colors.background}
              />
              <Text style={styles.quickActionText}>Express</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.dateNavigator}>
          <TouchableOpacity onPress={handlePreviousDay} style={styles.dateNavButton}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={20}
              color={colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateDisplay}>
            <View style={styles.dateTextContainer}>
              <Text style={styles.dateText}>{dateDisplay}</Text>
              {alternativeDateDisplay && (
                <Text style={styles.alternativeDateText}>{alternativeDateDisplay}</Text>
              )}
            </View>
            {isToday && (
              <View style={styles.todayBadge}>
                <IconSymbol
                  ios_icon_name="checkmark"
                  android_material_icon_name="check"
                  size={12}
                  color={colors.background}
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleNextDay} style={styles.dateNavButton}>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={colors.text}
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

        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
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
          <View style={styles.conciseSection}>
            <View style={styles.conciseSectionHeader}>
              <IconSymbol
                ios_icon_name="list.bullet"
                android_material_icon_name="list"
                size={20}
                color={colors.text}
              />
              <Text style={styles.conciseSectionTitle}>Concise</Text>
              <TouchableOpacity onPress={handleCreateGoal} style={styles.addGoalButton}>
                <IconSymbol
                  ios_icon_name="plus.circle.fill"
                  android_material_icon_name="add-circle"
                  size={24}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
            
            {allGoals.length === 0 ? (
              <View style={styles.emptyGoalsState}>
                <IconSymbol
                  ios_icon_name="target"
                  android_material_icon_name="flag"
                  size={64}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyGoalsTitle}>No active goals today</Text>
                <Text style={styles.emptyGoalsText}>
                  Create goals in Settings to track them here
                </Text>
              </View>
            ) : (
              <>
                {lifeAreas.map(area => renderLifeAreaNode(area, 0))}
              </>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Add Reflection Modal */}
      {showAddReflectionModal && (
        <AddReflectionModal
          visible={showAddReflectionModal}
          onClose={() => {
            setShowAddReflectionModal(false);
            setEditingReflection(null);
          }}
          onSave={handleReflectionSaved}
          selectedDate={selectedDate}
          goals={allGoals}
          currencies={currencies}
          userPreferences={userPreferences}
          editingReflection={editingReflection}
          gainsLosses={gainsLosses}
          strategies={strategies}
          prefilledGoalId={params.goalId as string | undefined}
          sourceScreen="express"
        />
      )}

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModal}>
            <Text style={styles.alertTitle}>Error</Text>
            <Text style={styles.alertMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successFlashModal}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={48}
              color={colors.success}
            />
            <Text style={styles.successFlashTitle}>{successMessage}</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Styles (same as base file)
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  appLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  dateNavButton: {
    padding: 8,
  },
  dateDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  dateTextContainer: {
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  alternativeDateText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  todayBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  conciseSection: {
    marginBottom: 24,
  },
  conciseSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  conciseSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  addGoalButton: {
    padding: 4,
  },
  emptyGoalsState: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    marginTop: 20,
  },
  emptyGoalsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyGoalsText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  lifeAreaContainer: {
    marginBottom: 12,
  },
  lifeAreaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 12,
  },
  lifeAreaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  lifeAreaIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifeAreaIconText: {
    fontSize: 16,
  },
  lifeAreaName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  lifeAreaBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lifeAreaBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.background,
  },
  lifeAreaContent: {
    marginTop: 8,
    gap: 8,
  },
  conciseGoalCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  conciseGoalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  conciseGoalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  editButton: {
    padding: 4,
  },
  conciseGoalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conciseActionButton: {
    padding: 4,
  },
  conciseGoalStats: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginHorizontal: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    margin: 20,
    minWidth: 280,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  alertMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  alertButton: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  alertButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '600',
  },
  successFlashModal: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 32,
    margin: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  successFlashTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
});
