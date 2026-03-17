
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { AddReflectionModal } from '@/components/AddReflectionModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import * as supabaseApi from '@/utils/supabaseApi';
import { supabase } from '@/lib/supabase';

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
  motivationIds?: string[];
  strategyEffectiveness?: {
    strategyId: string;
    worked: boolean;
  }[];
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

interface Motivation {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface UserPreferences {
  reflectionCategoriesEnabled?: boolean;
  reflectionCategories?: string[];
}

interface ReflectionListModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  filterType: 'wins' | 'losses' | 'successes' | 'struggles' | 'all' | 'behavior' | 'goal' | 'gainslosses';
  filterValue?: string;
  goalId?: string;
  startDate?: string;
  endDate?: string;
  showAllReflections?: boolean; // If true, ignore date filters (for cumulative counts)
}

export function ReflectionListModal({
  visible,
  onClose,
  title,
  filterType,
  filterValue,
  goalId,
  startDate,
  endDate,
  showAllReflections = false,
}: ReflectionListModalProps) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [selectedReflection, setSelectedReflection] = useState<Reflection | null>(null);
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reflectionToDelete, setReflectionToDelete] = useState<Reflection | null>(null);
  
  // Data for AddReflectionModal
  const [goals, setGoals] = useState<Goal[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [gainsLosses, setGainsLosses] = useState<GainLoss[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [motivations, setMotivations] = useState<Motivation[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({});

  const loadReflections = useCallback(async () => {
    if (!visible || !filterType) return;
    
    console.log('[ReflectionListModal] Loading reflections with filter:', filterType, filterValue, 'goalId:', goalId, 'startDate:', startDate, 'endDate:', endDate);
    setLoading(true);
    setErrorMessage('');
    
    try {
      const userId = await supabaseApi.getCurrentUserId();
      
      // Build Supabase query
      let query = supabase
        .from('reflections')
        .select(`
          *,
          goal:goals(id, title)
        `)
        .eq('user_id', userId);
      
      // Apply goal filter if provided
      if (goalId) {
        query = query.eq('linked_goal_id', goalId);
      }
      
      // Apply outcome filter
      if (filterType === 'wins') {
        query = query.eq('was_worth_it', true);
      } else if (filterType === 'losses') {
        query = query.eq('was_worth_it', false);
      } else if (filterType === 'successes') {
        query = query.eq('outcome', 'success');
      } else if (filterType === 'struggles') {
        query = query.eq('outcome', 'struggled');
      } else if (filterType === 'behavior' && filterValue) {
        query = query.eq('category', filterValue);
      }
      
      // CRITICAL FIX: Only apply date filters if showAllReflections is false
      // For cumulative counts (like "once per day" goals), we want ALL reflections
      // For daily views (tally goals), we filter by date
      if (!showAllReflections && startDate && endDate) {
        // Single day view - apply date filter
        console.log('[ReflectionListModal] Filtering by date range:', startDate, 'to', endDate);
        query = query.gte('entry_date', startDate);
        query = query.lte('entry_date', endDate);
      } else {
        // Cumulative view - show ALL reflections for this goal
        console.log('[ReflectionListModal] Showing all reflections (cumulative view)');
      }
      
      // Order by date (newest first)
      query = query.order('entry_date', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) {
        console.error('[ReflectionListModal] Supabase error:', error);
        throw new Error(error.message);
      }
      
      let reflectionsData = data || [];
      
      // Map snake_case to camelCase for frontend
      reflectionsData = reflectionsData.map((r: any) => ({
        id: r.id,
        entryDate: r.entry_date,
        category: r.category,
        type: r.type,
        description: r.description,
        linkedGoalId: r.linked_goal_id,
        linkedGoalTitle: r.goal?.title,
        outcome: r.outcome,
        currencyChange: r.currency_change,
        gainedIds: r.gained_ids || [],
        lostIds: r.lost_ids || [],
        motivationIds: r.motivation_ids || [],
        wasWorthIt: r.was_worth_it,
        additionalThoughts: r.additional_thoughts,
        strategyEffectiveness: r.strategy_effectiveness || [],
        createdAt: r.created_at,
      }));
      
      // Additional filtering for specific report types
      if (filterType === 'gainslosses') {
        // For gains/losses, only show reflections that have gains or losses recorded
        reflectionsData = reflectionsData.filter((reflection: Reflection) => {
          const hasGains = reflection.gainedIds && reflection.gainedIds.length > 0;
          const hasLosses = reflection.lostIds && reflection.lostIds.length > 0;
          
          // Only include if it has gains or losses
          if (!hasGains && !hasLosses) {
            console.log('[ReflectionListModal] Filtering out reflection without gains/losses:', reflection.id);
            return false;
          }
          
          return true;
        });
      }
      
      console.log('[ReflectionListModal] Loaded reflections after filtering:', reflectionsData.length);
      setReflections(reflectionsData);
    } catch (error: any) {
      console.error('[ReflectionListModal] Error loading reflections:', error);
      setErrorMessage(error.message || 'Failed to load reflections');
      setReflections([]);
    } finally {
      setLoading(false);
    }
  }, [visible, filterType, filterValue, goalId, startDate, endDate, showAllReflections]);

  useEffect(() => {
    if (visible) {
      console.log('[ReflectionListModal] Modal opened, loading reflections with filter:', filterType, filterValue, goalId, startDate, endDate);
      loadReflections();
      loadSupportingData();
    }
  }, [visible, loadReflections]);

  const loadSupportingData = async () => {
    console.log('[ReflectionListModal] Loading supporting data for AddReflectionModal');
    try {
      // Use Promise.allSettled so individual failures don't block the rest
      const [goalsResult, currenciesResult, gainsLossesResult, strategiesResult, motivationsResult, preferencesResult] = await Promise.allSettled([
        supabaseApi.getGoals(),
        supabaseApi.getCurrencies(),
        supabaseApi.getGainsLosses(),
        supabaseApi.getStrategies(),
        supabaseApi.getReflectionMotivations(),
        supabaseApi.getUserPreferences(),
      ]);

      if (goalsResult.status === 'fulfilled') {
        const mappedGoals = (goalsResult.value || []).map((g: any) => ({
          id: g.id,
          title: g.title,
          behaviorCategories: g.behavior_categories,
          rewardCurrencyId: g.reward_currency_id,
          rewardAmount: g.reward_amount,
          rewardSuccesses: g.reward_successes,
          consequenceCurrencyId: g.consequence_currency_id,
          consequenceAmount: g.consequence_amount,
          consequenceFailures: g.consequence_failures,
          successCount: g.success_count,
          struggleCount: g.struggle_count,
        }));
        console.log('[ReflectionListModal] Goals mapped to camelCase, count:', mappedGoals.length);
        setGoals(mappedGoals);
      } else {
        console.warn('[ReflectionListModal] Failed to load goals:', goalsResult.reason);
        setGoals([]);
      }

      if (currenciesResult.status === 'fulfilled') {
        setCurrencies(currenciesResult.value || []);
      } else {
        console.warn('[ReflectionListModal] Failed to load currencies:', currenciesResult.reason);
        setCurrencies([]);
      }

      if (gainsLossesResult.status === 'fulfilled') {
        setGainsLosses(gainsLossesResult.value || []);
      } else {
        console.warn('[ReflectionListModal] Failed to load gains/losses:', gainsLossesResult.reason);
        setGainsLosses([]);
      }

      if (strategiesResult.status === 'fulfilled') {
        setStrategies(strategiesResult.value || []);
      } else {
        console.warn('[ReflectionListModal] Failed to load strategies:', strategiesResult.reason);
        setStrategies([]);
      }

      if (motivationsResult.status === 'fulfilled') {
        setMotivations(motivationsResult.value || []);
      } else {
        console.warn('[ReflectionListModal] Failed to load motivations:', motivationsResult.reason);
        setMotivations([]);
      }

      if (preferencesResult.status === 'fulfilled') {
        setUserPreferences(preferencesResult.value || {});
        console.log('[ReflectionListModal] Preferences loaded successfully');
      } else {
        console.log('[ReflectionListModal] Preferences not available, using defaults');
        setUserPreferences({});
      }

      console.log('[ReflectionListModal] Supporting data loaded');
    } catch (error) {
      console.error('[ReflectionListModal] Error loading supporting data:', error);
    }
  };

  const handleEditReflection = (reflection: Reflection) => {
    console.log('[ReflectionListModal] Opening reflection for editing:', reflection.id);
    setSelectedReflection(reflection);
    setShowReflectionModal(true);
  };

  const handleDeleteReflection = (reflection: Reflection) => {
    console.log('[ReflectionListModal] Confirming delete for reflection:', reflection.id);
    setReflectionToDelete(reflection);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteReflection = async () => {
    if (!reflectionToDelete) return;
    
    try {
      console.log('[ReflectionListModal] Deleting reflection:', reflectionToDelete.id);
      
      // CRITICAL FIX: Delete corresponding daily_entry BEFORE deleting reflection
      // This ensures data stays in sync and icon counts update correctly
      if (reflectionToDelete.linkedGoalId) {
        console.log('[ReflectionListModal] Finding and deleting corresponding daily_entry');
        
        // Get all daily entries for this goal on this date
        const userId = await supabaseApi.getCurrentUserId();
        const { data: dailyEntries, error: entriesError } = await supabase
          .from('daily_entries')
          .select('*')
          .eq('user_id', userId)
          .eq('goal_id', reflectionToDelete.linkedGoalId)
          .eq('entry_date', reflectionToDelete.entryDate);
        
        if (entriesError) {
          console.error('[ReflectionListModal] Error fetching daily entries:', entriesError);
        } else if (dailyEntries && dailyEntries.length > 0) {
          // Find the entry that matches this reflection's outcome
          const matchingEntry = dailyEntries.find(e => e.type === reflectionToDelete.outcome);
          
          if (matchingEntry) {
            console.log('[ReflectionListModal] Deleting daily_entry:', matchingEntry.id);
            await supabaseApi.deleteDailyEntry(matchingEntry.id);
          } else {
            console.warn('[ReflectionListModal] No matching daily_entry found for reflection');
          }
        }
      }
      
      // Delete the reflection
      await supabaseApi.deleteReflection(reflectionToDelete.id);
      
      // If reflection was linked to a goal, recalculate goal stats
      if (reflectionToDelete.linkedGoalId) {
        console.log('[ReflectionListModal] Recalculating stats for goal:', reflectionToDelete.linkedGoalId);
        
        // Get all remaining reflections for this goal
        const allReflections = await supabaseApi.getReflections();
        const goalReflections = allReflections.filter((r: any) => r.linked_goal_id === reflectionToDelete.linkedGoalId);
        
        // Recalculate success and struggle counts
        const successCount = goalReflections.filter((r: any) => r.outcome === 'success').length;
        const struggleCount = goalReflections.filter((r: any) => r.outcome === 'struggled').length;
        
        // Recalculate streaks
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
        
        // Update the goal with recalculated stats
        await supabaseApi.updateGoal(reflectionToDelete.linkedGoalId, {
          success_count: successCount,
          struggle_count: struggleCount,
          current_streak: currentStreak,
          best_streak: bestStreak,
        });
      }
      
      // Remove from local state
      setReflections(prevReflections =>
        prevReflections.filter(r => r.id !== reflectionToDelete.id)
      );
      
      setShowDeleteConfirm(false);
      setReflectionToDelete(null);
      
      console.log('[ReflectionListModal] Reflection deleted successfully');
    } catch (error: any) {
      console.error('[ReflectionListModal] Error deleting reflection:', error);
      setErrorMessage(error.message || 'Failed to delete reflection');
      setShowDeleteConfirm(false);
      setReflectionToDelete(null);
    }
  };

  const handleReflectionSaved = (updatedReflection: Reflection) => {
    console.log('[ReflectionListModal] Reflection saved, reloading list');
    setShowReflectionModal(false);
    setSelectedReflection(null);
    // Reload reflections to get updated data
    loadReflections();
  };

  const handleCloseReflectionModal = () => {
    console.log('[ReflectionListModal] Closing reflection modal');
    setShowReflectionModal(false);
    setSelectedReflection(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  const getOutcomeIcon = (outcome?: 'success' | 'struggled') => {
    if (outcome === 'success') {
      return { ios: 'checkmark.circle.fill', android: 'check-circle', color: colors.success };
    } else if (outcome === 'struggled') {
      return { ios: 'xmark.circle.fill', android: 'cancel', color: colors.error };
    }
    return null;
  };

  const getTypeIcon = (type: 'Restraint' | 'Proactive') => {
    if (type === 'Proactive') {
      return { ios: 'arrow.up.right.circle.fill', android: 'trending-up', color: colors.primary };
    } else {
      return { ios: 'hand.raised.fill', android: 'back-hand', color: colors.secondary || colors.primary };
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={onClose}
            >
              <IconSymbol
                ios_icon_name="xmark"
                android_material_icon_name="close"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              <IconSymbol
                ios_icon_name="list.bullet"
                android_material_icon_name="list"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.headerTitle}>{title}</Text>
            </View>
            
            <View style={styles.headerButton} />
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : reflections.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="doc.text"
                android_material_icon_name="description"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyStateTitle}>No Reflections Found</Text>
              <Text style={styles.emptyStateText}>
                No reflections match this filter
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.contentContainer}
            >
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsCount}>
                  {reflections.length} {reflections.length === 1 ? 'reflection' : 'reflections'} found
                </Text>
              </View>

              {reflections.map((reflection, index) => {
                const formattedDate = formatDate(reflection.entryDate);
                const outcomeIcon = getOutcomeIcon(reflection.outcome);
                const typeIcon = getTypeIcon(reflection.type);
                
                return (
                  <React.Fragment key={index}>
                    <View style={styles.reflectionCard}>
                      <View style={styles.reflectionHeader}>
                        <View style={styles.reflectionHeaderLeft}>
                          <IconSymbol
                            ios_icon_name="calendar"
                            android_material_icon_name="calendar-today"
                            size={16}
                            color={colors.primary}
                          />
                          <Text style={styles.reflectionDate}>{formattedDate}</Text>
                        </View>
                        <View style={styles.reflectionActions}>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleEditReflection(reflection)}
                          >
                            <IconSymbol
                              ios_icon_name="pencil"
                              android_material_icon_name="edit"
                              size={20}
                              color={colors.primary}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleDeleteReflection(reflection)}
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

                      <View style={styles.reflectionBadges}>
                        {typeIcon && (
                          <View style={styles.badge}>
                            <IconSymbol
                              ios_icon_name={typeIcon.ios}
                              android_material_icon_name={typeIcon.android}
                              size={14}
                              color={typeIcon.color}
                            />
                            <Text style={[styles.badgeText, { color: typeIcon.color }]}>
                              {reflection.type}
                            </Text>
                          </View>
                        )}
                        {outcomeIcon && (
                          <View style={styles.badge}>
                            <IconSymbol
                              ios_icon_name={outcomeIcon.ios}
                              android_material_icon_name={outcomeIcon.android}
                              size={14}
                              color={outcomeIcon.color}
                            />
                          </View>
                        )}
                      </View>

                      {reflection.linkedGoalTitle && (
                        <View style={styles.reflectionGoal}>
                          <IconSymbol
                            ios_icon_name="target"
                            android_material_icon_name="flag"
                            size={14}
                            color={colors.textSecondary}
                          />
                          <Text style={styles.reflectionGoalText}>
                            {reflection.linkedGoalTitle}
                          </Text>
                        </View>
                      )}

                      <Text style={styles.reflectionDescription} numberOfLines={3}>
                        {reflection.description}
                      </Text>
                    </View>
                  </React.Fragment>
                );
              })}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>

      {/* AddReflectionModal for viewing/editing */}
      {selectedReflection && (
        <AddReflectionModal
          visible={showReflectionModal}
          onClose={handleCloseReflectionModal}
          onSave={handleReflectionSaved}
          selectedDate={new Date(selectedReflection.entryDate)}
          goals={goals}
          currencies={currencies}
          userPreferences={userPreferences}
          editingReflection={selectedReflection}
          gainsLosses={gainsLosses}
          strategies={strategies}
          motivations={motivations}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        visible={showDeleteConfirm}
        title="Delete Reflection"
        message={`Are you sure you want to delete this reflection? This will also update the goal's statistics.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteReflection}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setReflectionToDelete(null);
        }}
        confirmColor={colors.error}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? 48 : 0,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  resultsHeader: {
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  reflectionCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reflectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reflectionDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  reflectionBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reflectionGoal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  reflectionGoalText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  reflectionDescription: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  reflectionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
});
