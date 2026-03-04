
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { AddReflectionModal } from '@/components/AddReflectionModal';
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '@/utils/api';
import DateTimePicker from '@react-native-community/datetimepicker';

interface JournalEntry {
  id: string;
  content: string;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
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
  motivationIds?: string[];
  wasWorthIt?: boolean;
  additionalThoughts?: string;
  strategyEffectiveness?: Array<{
    strategyId: string;
    worked: boolean;
  }>;
  createdAt: string;
}

interface Goal {
  id: string;
  title: string;
  behaviorCategories?: string[];
  rewardCurrencyId?: string;
  rewardAmount?: number;
  rewardSuccesses?: number;
  consequenceCurrencyId?: string;
  consequenceAmount?: number;
  consequenceFailures?: number;
  successCount?: number;
  struggleCount?: number;
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
}

// Helper function to format date as YYYY-MM-DD in local timezone
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ReflectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; reflectionId?: string; openModal?: string; goalId?: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const journalInputRef = useRef<TextInput>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);
  const [journalContent, setJournalContent] = useState('');
  const [reflections, setReflections] = useState<Reflection[]>([]);

  const [showAddReflectionModal, setShowAddReflectionModal] = useState(false);
  const [editingReflection, setEditingReflection] = useState<Reflection | null>(null);
  const [prefilledGoalId, setPrefilledGoalId] = useState<string | undefined>(undefined);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({});
  const [gainsLosses, setGainsLosses] = useState<GainLoss[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [motivations, setMotivations] = useState<{ id: string; name: string; createdAt: string; updatedAt: string }[]>([]);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [tempJournalContent, setTempJournalContent] = useState('');

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
      console.log('[Reflect] openModal parameter detected, opening AddReflectionModal');
      if (params.goalId) {
        console.log('[Reflect] Pre-filling with goalId:', params.goalId);
        setPrefilledGoalId(params.goalId);
      }
      setTimeout(() => {
        setShowAddReflectionModal(true);
      }, 500);
    }
  }, [params.openModal, params.goalId]);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  useEffect(() => {
    if (params.reflectionId && reflections.length > 0) {
      const reflection = reflections.find(r => r.id === params.reflectionId);
      if (reflection) {
        console.log('Opening reflection from history:', reflection.id);
        openEditReflectionModal(reflection);
      }
    }
  }, [params.reflectionId, reflections]);

  useEffect(() => {
    if (showSuccessModal) {
      const timer = setTimeout(() => {
        setShowSuccessModal(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessModal]);

  const loadData = async () => {
    const dateString = formatDateLocal(selectedDate);
    console.log('Loading reflect data for date (local):', dateString);
    setLoading(true);
    try {
      const [journalRes, reflectionsRes, goalsRes, currenciesRes, prefsRes, gainsLossesRes, strategiesRes, motivationsRes] = await Promise.all([
        authenticatedGet(`/api/journals/by-date?date=${dateString}`),
        authenticatedGet(`/api/reflections/by-date?date=${dateString}`),
        authenticatedGet('/api/goals'),
        authenticatedGet('/api/currencies'),
        authenticatedGet('/api/user-preferences'),
        authenticatedGet('/api/gains-losses'),
        authenticatedGet('/api/strategies'),
        authenticatedGet('/api/reflection-motivations'),
      ]);

      const journalData = journalRes?.data || journalRes || null;
      const reflectionsData = Array.isArray(reflectionsRes) ? reflectionsRes : (reflectionsRes?.data || []);
      const goalsData = Array.isArray(goalsRes) ? goalsRes : (goalsRes?.data || []);
      const currenciesData = Array.isArray(currenciesRes) ? currenciesRes : (currenciesRes?.data || []);
      const prefsData = prefsRes?.data || prefsRes || {};
      const gainsLossesData = Array.isArray(gainsLossesRes) ? gainsLossesRes : (gainsLossesRes?.data || []);
      const strategiesData = Array.isArray(strategiesRes) ? strategiesRes : (strategiesRes?.data || []);
      const motivationsData = Array.isArray(motivationsRes) ? motivationsRes : (motivationsRes?.data || []);

      setJournalEntry(journalData);
      setJournalContent(journalData?.content || '');
      setReflections(reflectionsData);
      setGoals(goalsData);
      setCurrencies(currenciesData);
      setUserPreferences(prefsData);
      setGainsLosses(gainsLossesData);
      setStrategies(strategiesData);
      setMotivations(motivationsData);
      console.log('[Reflect iOS] Motivations loaded:', motivationsData.length);

      console.log('Reflect data loaded successfully');
    } catch (error) {
      console.error('Error loading reflect data:', error);
      showError('Failed to load reflect data');
    } finally {
      setLoading(false);
    }
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessModal(true);
  };

  const handleOpenJournalModal = () => {
    console.log('Opening journal modal');
    setTempJournalContent(journalContent);
    setShowJournalModal(true);
  };

  const handleCloseJournalModal = () => {
    console.log('Closing journal modal without saving');
    setShowJournalModal(false);
    setTempJournalContent('');
  };

  const handleSaveJournal = async () => {
    console.log('Saving journal entry...');
    try {
      setLoading(true);
      const dateString = formatDateLocal(selectedDate);
      
      const response = await authenticatedPost('/api/journals/by-date', {
        date: dateString,
        content: tempJournalContent,
      });

      const savedEntry = response?.data || response;
      
      if (savedEntry && savedEntry.deleted) {
        console.log('Journal entry deleted (content was empty)');
        setJournalEntry(null);
        setJournalContent('');
        showSuccess('Journal entry deleted');
      } else if (savedEntry) {
        console.log('Journal entry saved');
        setJournalEntry(savedEntry);
        setJournalContent(tempJournalContent);
        showSuccess('Journal saved successfully');
      } else {
        console.log('No journal entry (content was empty and no existing entry)');
        setJournalEntry(null);
        setJournalContent('');
      }
      
      setShowJournalModal(false);
      setTempJournalContent('');
    } catch (error) {
      console.error('Error saving journal:', error);
      showError('Failed to save journal entry');
    } finally {
      setLoading(false);
    }
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

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    };
    return date.toLocaleDateString('en-US', options);
  };

  const handleDeleteReflection = async (id: string) => {
    console.log('Deleting reflection:', id);
    try {
      setLoading(true);
      await authenticatedDelete(`/api/reflections/${id}`);
      setReflections(reflections.filter(r => r.id !== id));
      showSuccess('Reflection deleted successfully');
    } catch (error) {
      console.error('Error deleting reflection:', error);
      showError('Failed to delete reflection');
    } finally {
      setLoading(false);
    }
  };

  const openAddReflectionModal = () => {
    setEditingReflection(null);
    setPrefilledGoalId(undefined);
    setShowAddReflectionModal(true);
  };

  const openEditReflectionModal = (reflection: Reflection) => {
    setEditingReflection(reflection);
    setPrefilledGoalId(undefined);
    setShowAddReflectionModal(true);
  };

  const handleReflectionSaved = (reflection: Reflection) => {
    if (editingReflection) {
      setReflections(reflections.map(r => r.id === reflection.id ? reflection : r));
    } else {
      setReflections([...reflections, reflection]);
    }
    setShowAddReflectionModal(false);
    showSuccess('Reflection saved successfully');
    loadData();
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const getCategoryIcon = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower === 'action') return { ios: 'figure.walk', android: 'directions-run' };
    if (categoryLower === 'speech') return { ios: 'bubble.left.fill', android: 'chat-bubble' };
    if (categoryLower === 'thought') return { ios: 'cloud.fill', android: 'cloud' };
    if (categoryLower === 'feeling') return { ios: 'heart.fill', android: 'favorite' };
    return { ios: 'sparkles', android: 'auto-awesome' };
  };

  const dateDisplay = formatDate(selectedDate);

  const categoriesEnabled = userPreferences.reflectionCategoriesEnabled !== false;
  const availableCategories = userPreferences.reflectionCategories || ['Action', 'Speech', 'Thought'];

  // Helper function to get the display category for a reflection
  // Falls back to the linked goal's behaviorCategories if reflection.category is not set
  const getReflectionDisplayCategory = (reflection: Reflection): string => {
    if (reflection.category) {
      return reflection.category;
    }
    
    // Fall back to linked goal's behavior category
    if (reflection.linkedGoalId) {
      const linkedGoal = goals.find(g => g.id === reflection.linkedGoalId);
      if (linkedGoal && linkedGoal.behaviorCategories && linkedGoal.behaviorCategories.length > 0) {
        return linkedGoal.behaviorCategories[0];
      }
    }
    
    return 'Other';
  };

  const groupedReflections: Record<string, Reflection[]> = {};
  if (categoriesEnabled) {
    availableCategories.forEach(cat => {
      groupedReflections[cat] = reflections.filter(r => {
        const displayCategory = getReflectionDisplayCategory(r);
        return displayCategory === cat;
      });
    });
    groupedReflections['Other'] = reflections.filter(r => {
      const displayCategory = getReflectionDisplayCategory(r);
      return !availableCategories.includes(displayCategory);
    });
  } else {
    groupedReflections['All'] = reflections;
  }

  const hasJournalContent = journalContent && journalContent.trim().length > 0;
  const journalPreview = hasJournalContent ? journalContent.substring(0, 100) + (journalContent.length > 100 ? '...' : '') : '';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reflect</Text>
          <TouchableOpacity onPress={() => router.push('/search-journals')}>
            <IconSymbol
              ios_icon_name="magnifyingglass"
              android_material_icon_name="search"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
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
            <Text style={styles.dateText}>{dateDisplay}</Text>
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
          keyboardShouldPersistTaps="handled"
        >
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
              <TouchableOpacity onPress={openAddReflectionModal} style={styles.addButton}>
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
                        style={styles.categoryHeader}
                        onPress={() => toggleCategory(category)}
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
                        <Text style={styles.categoryTitle}>{category}</Text>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeText}>{categoryReflections.length}</Text>
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
                                  {reflection.linkedGoalTitle || goals.find(g => g.id === reflection.linkedGoalId)?.title || 'Unknown Goal'}
                                </Text>
                              </View>
                            )}

                            {reflection.currencyChange && (
                              <View style={styles.currencyChange}>
                                <Text style={styles.currencyChangeText}>
                                  {reflection.currencyChange.operation === 'add' ? '+' : '-'}
                                  {reflection.currencyChange.amount} {reflection.currencyChange.currencySymbol || ''}
                                </Text>
                              </View>
                            )}

                            {(reflection.gainedIds && reflection.gainedIds.length > 0) && (
                              <View style={styles.gainsLossesSection}>
                                <View style={styles.gainsLossesHeader}>
                                  <IconSymbol
                                    ios_icon_name="arrow.up.circle.fill"
                                    android_material_icon_name="trending-up"
                                    size={16}
                                    color={colors.success}
                                  />
                                  <Text style={styles.gainsLossesTitle}>Gained</Text>
                                </View>
                                <View style={styles.gainsLossesList}>
                                  {reflection.gainedIds.map((gainId, idx) => {
                                    const gain = gainsLosses.find(gl => gl.id === gainId);
                                    const gainName = gain?.name || 'Unknown';
                                    return gain ? (
                                      <View key={idx} style={styles.gainLossBadge}>
                                        <Text style={styles.gainLossBadgeText}>{gainName}</Text>
                                      </View>
                                    ) : null;
                                  })}
                                </View>
                              </View>
                            )}

                            {(reflection.lostIds && reflection.lostIds.length > 0) && (
                              <View style={styles.gainsLossesSection}>
                                <View style={styles.gainsLossesHeader}>
                                  <IconSymbol
                                    ios_icon_name="arrow.down.circle.fill"
                                    android_material_icon_name="trending-down"
                                    size={16}
                                    color={colors.error}
                                  />
                                  <Text style={styles.gainsLossesTitle}>Lost</Text>
                                </View>
                                <View style={styles.gainsLossesList}>
                                  {reflection.lostIds.map((lossId, idx) => {
                                    const loss = gainsLosses.find(gl => gl.id === lossId);
                                    const lossName = loss?.name || 'Unknown';
                                    return loss ? (
                                      <View key={idx} style={[styles.gainLossBadge, styles.lossBadge]}>
                                        <Text style={styles.gainLossBadgeText}>{lossName}</Text>
                                      </View>
                                    ) : null;
                                  })}
                                </View>
                              </View>
                            )}

                            {reflection.wasWorthIt !== undefined && (
                              <View style={styles.worthItSection}>
                                <IconSymbol
                                  ios_icon_name={reflection.wasWorthIt ? "checkmark.circle.fill" : "xmark.circle.fill"}
                                  android_material_icon_name={reflection.wasWorthIt ? "check-circle" : "cancel"}
                                  size={16}
                                  color={reflection.wasWorthIt ? colors.success : colors.error}
                                />
                                <Text style={[styles.worthItValue, reflection.wasWorthIt ? styles.worthItYes : styles.worthItNo]}>
                                  {reflection.wasWorthIt ? 'Worth it' : 'Not worth it'}
                                </Text>
                              </View>
                            )}

                            {reflection.additionalThoughts && (
                              <View style={styles.additionalThoughtsSection}>
                                <Text style={styles.additionalThoughtsLabel}>Notes on weighing up gains and losses</Text>
                                <Text style={styles.additionalThoughtsText}>{reflection.additionalThoughts}</Text>
                              </View>
                            )}

                            {(reflection.strategyEffectiveness && reflection.strategyEffectiveness.length > 0) && (
                              <View style={styles.strategiesSection}>
                                <View style={styles.strategiesHeader}>
                                  <IconSymbol
                                    ios_icon_name="lightbulb.fill"
                                    android_material_icon_name="lightbulb"
                                    size={16}
                                    color={colors.primary}
                                  />
                                  <Text style={styles.strategiesTitle}>Strategies</Text>
                                </View>
                                <View style={styles.strategiesList}>
                                  {reflection.strategyEffectiveness.map((se, idx) => {
                                    const strategy = strategies.find(s => s.id === se.strategyId);
                                    const strategyName = strategy?.name || 'Unknown Strategy';
                                    
                                    return (
                                      <View key={idx} style={styles.strategyBadge}>
                                        <Text style={styles.strategyBadgeText}>{strategyName}</Text>
                                        <View style={[styles.strategyStatusDot, se.worked ? styles.strategyWorkedDot : styles.strategyDidntWorkDot]} />
                                      </View>
                                    );
                                  })}
                                </View>
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
        </ScrollView>
      </View>

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
            setShowAddReflectionModal(false);
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
          motivations={motivations}
          prefilledGoalId={prefilledGoalId}
          sourceScreen="reflect"
        />
      )}

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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.card,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  dateNavButton: {
    padding: 8,
  },
  dateDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
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
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
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
  currencyChange: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  currencyChangeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.success,
  },
  gainsLossesSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  gainsLossesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  gainsLossesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  gainsLossesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  gainLossBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lossBadge: {
    backgroundColor: colors.error + '20',
  },
  gainLossBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  worthItSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  worthItValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  worthItYes: {
    color: colors.success,
  },
  worthItNo: {
    color: colors.error,
  },
  additionalThoughtsSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  additionalThoughtsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  additionalThoughtsText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  strategiesSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  strategiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  strategiesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  strategiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  strategyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary + '10',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  strategyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  strategyStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  strategyWorkedDot: {
    backgroundColor: colors.success,
  },
  strategyDidntWorkDot: {
    backgroundColor: colors.error,
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
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    margin: 20,
    minWidth: 280,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  alertMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  alertButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  alertButtonText: {
    color: colors.background,
    fontSize: 16,
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
