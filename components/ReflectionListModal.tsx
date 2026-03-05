
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
import { authenticatedGet } from '@/utils/api';
import { AddReflectionModal } from '@/components/AddReflectionModal';

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
}: ReflectionListModalProps) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [selectedReflection, setSelectedReflection] = useState<Reflection | null>(null);
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  
  // Data for AddReflectionModal
  const [goals, setGoals] = useState<Goal[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [gainsLosses, setGainsLosses] = useState<GainLoss[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [motivations, setMotivations] = useState<Motivation[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({});

  const loadReflections = useCallback(async () => {
    if (!visible || !filterType) return;
    
    console.log('[ReflectionListModal] Loading reflections with filter:', filterType, filterValue);
    setLoading(true);
    setErrorMessage('');
    
    try {
      const params = new URLSearchParams();
      
      if (goalId) {
        params.append('goalId', goalId);
      }
      
      if (filterType === 'wins') {
        params.append('wasWorthIt', 'true');
      } else if (filterType === 'losses') {
        params.append('wasWorthIt', 'false');
      } else if (filterType === 'successes') {
        params.append('outcome', 'success');
      } else if (filterType === 'struggles') {
        params.append('outcome', 'struggled');
      } else if (filterType === 'behavior' && filterValue) {
        params.append('category', filterValue);
      }
      
      if (startDate) {
        params.append('startDate', startDate);
      }
      
      if (endDate) {
        params.append('endDate', endDate);
      }
      
      // Add ordering parameters for chronological order (newest first)
      params.append('orderBy', 'entryDate');
      params.append('orderDirection', 'desc');
      
      // CRITICAL: Exclude pure currency transactions from all report pop-ups
      // Pure currency transactions are identified by the backend flag, not by keywords
      params.append('isPureCurrencyTransaction', 'false');
      
      const endpoint = `/api/reflections?${params.toString()}`;
      console.log('[ReflectionListModal] Fetching from endpoint:', endpoint);
      
      const response = await authenticatedGet(endpoint);
      let reflectionsData = Array.isArray(response) ? response : (response?.data || []);
      
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
  }, [visible, filterType, filterValue, goalId, startDate, endDate]);

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
        authenticatedGet('/api/goals'),
        authenticatedGet('/api/currencies'),
        authenticatedGet('/api/gains-losses'),
        authenticatedGet('/api/strategies'),
        authenticatedGet('/api/reflection-motivations'),
        authenticatedGet('/api/preferences'),
      ]);

      if (goalsResult.status === 'fulfilled') {
        const goalsRes = goalsResult.value;
        setGoals(Array.isArray(goalsRes) ? goalsRes : (goalsRes?.data || []));
      } else {
        console.warn('[ReflectionListModal] Failed to load goals:', goalsResult.reason);
        setGoals([]);
      }

      if (currenciesResult.status === 'fulfilled') {
        const currenciesRes = currenciesResult.value;
        setCurrencies(Array.isArray(currenciesRes) ? currenciesRes : (currenciesRes?.data || []));
      } else {
        console.warn('[ReflectionListModal] Failed to load currencies:', currenciesResult.reason);
        setCurrencies([]);
      }

      if (gainsLossesResult.status === 'fulfilled') {
        const gainsLossesRes = gainsLossesResult.value;
        setGainsLosses(Array.isArray(gainsLossesRes) ? gainsLossesRes : (gainsLossesRes?.data || []));
      } else {
        console.warn('[ReflectionListModal] Failed to load gains/losses:', gainsLossesResult.reason);
        setGainsLosses([]);
      }

      if (strategiesResult.status === 'fulfilled') {
        const strategiesRes = strategiesResult.value;
        setStrategies(Array.isArray(strategiesRes) ? strategiesRes : (strategiesRes?.data || []));
      } else {
        console.warn('[ReflectionListModal] Failed to load strategies:', strategiesResult.reason);
        setStrategies([]);
      }

      if (motivationsResult.status === 'fulfilled') {
        const motivationsRes = motivationsResult.value;
        setMotivations(Array.isArray(motivationsRes) ? motivationsRes : (motivationsRes?.data || []));
      } else {
        console.warn('[ReflectionListModal] Failed to load motivations:', motivationsResult.reason);
        setMotivations([]);
      }

      if (preferencesResult.status === 'fulfilled') {
        const preferencesRes = preferencesResult.value;
        setUserPreferences(preferencesRes?.data || preferencesRes || {});
        console.log('[ReflectionListModal] Preferences loaded successfully');
      } else {
        console.log('[ReflectionListModal] Preferences endpoint not available, using defaults:', preferencesResult.reason?.message);
        setUserPreferences({});
      }

      console.log('[ReflectionListModal] Supporting data loaded');
    } catch (error) {
      console.error('[ReflectionListModal] Error loading supporting data:', error);
    }
  };

  const handleViewReflection = (reflection: Reflection) => {
    console.log('[ReflectionListModal] Opening reflection:', reflection.id);
    setSelectedReflection(reflection);
    setShowReflectionModal(true);
  };

  const handleReflectionSaved = (updatedReflection: Reflection) => {
    console.log('[ReflectionListModal] Reflection saved, updating list');
    setReflections(prevReflections =>
      prevReflections.map(r => r.id === updatedReflection.id ? updatedReflection : r)
    );
    setShowReflectionModal(false);
    setSelectedReflection(null);
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
                    <TouchableOpacity
                      style={styles.reflectionCard}
                      onPress={() => handleViewReflection(reflection)}
                    >
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

                      <View style={styles.reflectionFooter}>
                        <Text style={styles.viewButtonText}>View Details</Text>
                        <IconSymbol
                          ios_icon_name="arrow.right"
                          android_material_icon_name="arrow-forward"
                          size={16}
                          color={colors.primary}
                        />
                      </View>
                    </TouchableOpacity>
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
  reflectionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
