
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as supabaseApi from "@/utils/supabaseApi";
import React, { useState, useEffect, useCallback } from "react";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ReflectionListModal } from "@/components/ReflectionListModal";

interface CurrencyBalance {
  currencyId: string;
  currencyName: string;
  symbol: string;
  totalBalance: number;
  goalBreakdown?: { goalId: string; goalTitle: string; balance: number }[];
}

interface WinsVsLosses {
  wins: number;
  losses: number;
  totalReflections: number;
}

interface SuccessVsStruggles {
  successes: number;
  struggles: number;
  total: number;
}

interface ReflectionStats {
  totalReflections: number;
  totalRestraints: number;
  totalProactive: number;
  worthItPercentage: number;
}

interface JournalCount {
  count: number;
}

interface GainsLossesSummary {
  totalGains: number;
  totalLosses: number;
  byCategory: { category: string; gains: number; losses: number }[];
  topGains: { id: string; name: string; count: number }[];
  topLosses: { id: string; name: string; count: number }[];
}

interface TermDistributionItem {
  count: number;
  percentage: number;
}

interface CategoryDistributionItem {
  category: string;
  count: number;
  percentage: number;
}

interface GainsLossesDistribution {
  totalGains: number;
  totalLosses: number;
  termDistribution: {
    gains: {
      short: TermDistributionItem;
      medium: TermDistributionItem;
      long: TermDistributionItem;
    };
    losses: {
      short: TermDistributionItem;
      medium: TermDistributionItem;
      long: TermDistributionItem;
    };
  };
  categoryDistribution: {
    gains: CategoryDistributionItem[];
    losses: CategoryDistributionItem[];
  };
  topCategories: {
    gains: CategoryDistributionItem[];
    losses: CategoryDistributionItem[];
  };
}

interface BehaviorCounts {
  actionEntries: number;
  speechEntries: number;
  thoughtEntries: number;
}

interface GoalProgress {
  goalId: string;
  goalTitle: string;
  progress: number;
  successCount: number;
  struggleCount: number;
  currentStreak?: number;
  bestStreak?: number;
  rewardCurrencyBalance?: number;
  rewardCurrencySymbol?: string;
  consequenceCurrencyBalance?: number;
  consequenceCurrencySymbol?: string;
}

interface MotivationCount {
  motivationId: string;
  motivationName: string;
  count: number;
}

interface TopMotivationsByType {
  proactive: MotivationCount[];
  restraint: MotivationCount[];
}

interface TopMotivationsByOutcome {
  success: MotivationCount[];
  struggle: MotivationCount[];
}

interface Currency {
  id: string;
  name: string;
  symbol?: string;
  type?: 'reward' | 'consequence';
  onSuccess?: 'ADD' | 'SUBTRACT' | 'NONE';
  onFailure?: 'ADD' | 'SUBTRACT' | 'NONE';
}

type TimeFilter = 'week' | 'month' | '6months' | 'year' | 'all';

export default function ReportsScreen() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [currencyBalances, setCurrencyBalances] = useState<CurrencyBalance[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [winsVsLosses, setWinsVsLosses] = useState<WinsVsLosses | null>(null);
  const [successVsStruggles, setSuccessVsStruggles] = useState<SuccessVsStruggles | null>(null);
  const [reflectionStats, setReflectionStats] = useState<ReflectionStats | null>(null);
  const [journalCount, setJournalCount] = useState<JournalCount | null>(null);
  const [gainsLossesSummary, setGainsLossesSummary] = useState<GainsLossesSummary | null>(null);
  const [gainsLossesDistribution, setGainsLossesDistribution] = useState<GainsLossesDistribution | null>(null);
  const [behaviorCounts, setBehaviorCounts] = useState<BehaviorCounts | null>(null);
  const [goalProgress, setGoalProgress] = useState<GoalProgress[]>([]);
  const [topMotivationsByType, setTopMotivationsByType] = useState<TopMotivationsByType | null>(null);
  const [topMotivationsByOutcome, setTopMotivationsByOutcome] = useState<TopMotivationsByOutcome | null>(null);
  
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [currencyModalType, setCurrencyModalType] = useState<'claim' | 'pay'>('claim');
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>('');
  const [selectedCurrencyName, setSelectedCurrencyName] = useState<string>('');
  const [selectedCurrencySymbol, setSelectedCurrencySymbol] = useState<string>('');
  const [currencyModalAmount, setCurrencyModalAmount] = useState<string>('');
  const [currencyModalMaxAmount, setCurrencyModalMaxAmount] = useState<number>(0);
  const [currencyModalLoading, setCurrencyModalLoading] = useState(false);
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');

  // Reflection list modal state
  const [showReflectionListModal, setShowReflectionListModal] = useState(false);
  const [reflectionListTitle, setReflectionListTitle] = useState('');
  const [reflectionListFilterType, setReflectionListFilterType] = useState<'wins' | 'losses' | 'successes' | 'struggles' | 'all' | 'behavior' | 'goal'>('all');
  const [reflectionListFilterValue, setReflectionListFilterValue] = useState<string | undefined>(undefined);
  const [reflectionListGoalId, setReflectionListGoalId] = useState<string | undefined>(undefined);

  const getDateRangeForModal = useCallback(() => {
    if (timeFilter === 'all') {
      return {};
    }
    
    const now = new Date();
    let startDate: Date | null = null;
    
    switch (timeFilter) {
      case 'week':
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      case 'month':
        startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        break;
      case '6months':
        startDate = new Date(now.getTime() - (180 * 24 * 60 * 60 * 1000));
        break;
      case 'year':
        startDate = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
        break;
    }
    
    if (startDate) {
      const startDateISO = startDate.toISOString();
      const endDateISO = now.toISOString();
      console.log('[Reports] Date range for modal:', timeFilter, 'Start:', startDateISO, 'End:', endDateISO);
      return {
        startDate: startDateISO,
        endDate: endDateISO,
      };
    }
    
    return {};
  }, [timeFilter]);

  const loadReportsData = useCallback(async (refreshing: boolean = false) => {
    console.log("Loading reports data with time filter:", timeFilter, refreshing ? "(refreshing)" : "");
    if (!refreshing) {
      setLoading(true);
    }
    try {
      // Load currency balances
      const balancesData = await supabaseApi.getCurrencyBalances();
      console.log('[Reports] Currency balances loaded:', balancesData);
      setCurrencyBalances(balancesData);

      // Load currencies
      const currenciesData = await supabaseApi.getCurrencies();
      console.log('[Reports] Currencies loaded:', currenciesData);
      setCurrencies(currenciesData);

      // Load reports data with time filter
      const reportsData = await supabaseApi.getReportsData(timeFilter);
      console.log('[Reports] Reports data loaded:', reportsData);

      setReflectionStats(reportsData.reflectionStats);
      setWinsVsLosses(reportsData.winsVsLosses);
      setJournalCount(reportsData.journalCount);
      setGoalProgress(reportsData.goalProgress);

      console.log('[Reports] Success vs Struggles:', reportsData.winsVsLosses);
      console.log('[Reports] Wins vs Losses:', reportsData.winsVsLosses);
      console.log("Reports data loaded successfully");
    } catch (error: any) {
      console.error("Error loading reports data:", error);
      showError(error.message || "Failed to load reports");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [timeFilter]);

  useEffect(() => {
    console.log("ReportsScreen mounted or timeFilter changed");
    loadReportsData();
  }, [loadReportsData]);

  const handleRefresh = useCallback(async () => {
    console.log("User initiated pull-to-refresh on Reports screen");
    setIsRefreshing(true);
    await loadReportsData(true);
  }, [loadReportsData]);

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const showSuccess = (message: string) => {
    setSuccessModalMessage(message);
    setShowSuccessModal(true);
    setTimeout(() => {
      setShowSuccessModal(false);
    }, 2000);
  };

  const isRewardCurrency = (currency: Currency): boolean => {
    return currency.onSuccess === 'ADD';
  };

  const openCurrencyModal = (currencyId: string, currencyName: string, currencySymbol: string, balance: number, type: 'claim' | 'pay') => {
    console.log("Opening currency modal:", type, currencyName, balance);
    setSelectedCurrencyId(currencyId);
    setSelectedCurrencyName(currencyName);
    setSelectedCurrencySymbol(currencySymbol);
    setCurrencyModalType(type);
    setCurrencyModalMaxAmount(Math.abs(balance));
    setCurrencyModalAmount(Math.abs(balance).toString());
    setShowCurrencyModal(true);
  };

  const handleCurrencyAction = async () => {
    console.log("Handling currency action:", currencyModalType, selectedCurrencyName, currencyModalAmount);
    
    const amount = parseFloat(currencyModalAmount);
    if (isNaN(amount) || amount <= 0) {
      showError('Please enter a valid amount');
      return;
    }
    
    if (amount > currencyModalMaxAmount) {
      showError(`Amount cannot exceed ${currencyModalMaxAmount}`);
      return;
    }
    
    setCurrencyModalLoading(true);
    try {
      // Create a currency transaction
      const transaction = {
        currency_id: selectedCurrencyId,
        amount: amount,
        operation: currencyModalType === 'claim' ? 'subtract' : 'add',
        type: currencyModalType,
        description: `${currencyModalType === 'claim' ? 'Claimed' : 'Paid'} ${amount} ${selectedCurrencySymbol}`,
        entry_date: new Date().toISOString().split('T')[0],
      };

      await supabaseApi.createCurrencyTransaction(transaction);
      
      setShowCurrencyModal(false);
      setCurrencyModalAmount('');
      
      const actionText = currencyModalType === 'claim' ? 'claimed' : 'paid';
      showSuccess(`Successfully ${actionText} ${amount} ${selectedCurrencySymbol}`);
      
      await loadReportsData();
    } catch (error: any) {
      console.error("Error processing currency action:", error);
      showError(error.message || `Failed to ${currencyModalType} currency`);
    } finally {
      setCurrencyModalLoading(false);
    }
  };

  const openReflectionListModal = (title: string, filterType: 'wins' | 'losses' | 'successes' | 'struggles' | 'all' | 'behavior' | 'goal', filterValue?: string, goalId?: string) => {
    console.log('[Reports] Opening reflection list modal:', title, filterType, filterValue, goalId);
    setReflectionListTitle(title);
    setReflectionListFilterType(filterType);
    setReflectionListFilterValue(filterValue);
    setReflectionListGoalId(goalId);
    setShowReflectionListModal(true);
  };

  const getTimeFilterLabel = (filter: TimeFilter): string => {
    switch (filter) {
      case 'week':
        return 'Week';
      case 'month':
        return 'Month';
      case '6months':
        return '6 Months';
      case 'year':
        return 'Year';
      case 'all':
      default:
        return 'All Time';
    }
  };

  const handleTimeFilterChange = (filter: TimeFilter) => {
    console.log('[Reports] Changing time filter to:', filter);
    setTimeFilter(filter);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const roundedWorthItPercentage = reflectionStats ? Math.round(reflectionStats.worthItPercentage) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Reports</Text>
          <TouchableOpacity
            style={styles.otherReportsSmallButton}
            onPress={() => router.push('/other-reports')}
          >
            <Text style={styles.otherReportsSmallButtonText}>Other</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={16}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* 1. Currency Balances - Not filterable */}
        {currencyBalances.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Total Currency Balances</Text>
            {currencyBalances.map((balance, index) => {
              const symbolText = balance.symbol || '';
              const totalBalanceText = `${balance.totalBalance}`;
              const totalBalanceColor = balance.totalBalance >= 0 ? colors.success : colors.error;
              const currency = currencies.find(c => c.id === balance.currencyId);
              
              let buttonType: 'claim' | 'pay' = 'claim';
              if (balance.totalBalance > 0) {
                buttonType = (currency && isRewardCurrency(currency)) ? 'claim' : 'pay';
              } else if (balance.totalBalance < 0) {
                buttonType = (currency && isRewardCurrency(currency)) ? 'pay' : 'claim';
              }
              
              const buttonText = buttonType === 'claim' ? 'Claim' : 'Pay';
              const buttonIcon = buttonType === 'claim' ? 'download' : 'upload';
              const buttonIosIcon = buttonType === 'claim' ? 'arrow.down.circle.fill' : 'arrow.up.circle.fill';
              
              return (
                <View key={index} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <Text style={styles.reportTitle}>{balance.currencyName}</Text>
                    {symbolText && <Text style={styles.reportSymbol}>{symbolText}</Text>}
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Total Balance:</Text>
                    <Text style={[styles.reportValue, { color: totalBalanceColor }]}>
                      {totalBalanceText}
                    </Text>
                  </View>
                  
                  {balance.totalBalance !== 0 && (
                    <TouchableOpacity
                      style={[styles.currencyActionButton, buttonType === 'claim' ? styles.claimButton : styles.payButton]}
                      onPress={() => openCurrencyModal(balance.currencyId, balance.currencyName, symbolText, balance.totalBalance, buttonType)}
                    >
                      <IconSymbol
                        ios_icon_name={buttonIosIcon}
                        android_material_icon_name={buttonIcon}
                        size={18}
                        color={colors.background}
                      />
                      <Text style={styles.currencyActionButtonText}>{buttonText}</Text>
                    </TouchableOpacity>
                  )}
                  
                  {balance.goalBreakdown && balance.goalBreakdown.length > 0 && (
                    <View style={styles.goalBreakdownSection}>
                      <Text style={styles.goalBreakdownTitle}>Per Goal:</Text>
                      {balance.goalBreakdown.map((goalBalance, idx) => {
                        const goalBalanceText = `${goalBalance.balance}`;
                        const goalBalanceColor = goalBalance.balance >= 0 ? colors.success : colors.error;
                        
                        return (
                          <View key={idx} style={styles.goalBreakdownRow}>
                            <Text style={styles.goalBreakdownGoal}>{goalBalance.goalTitle}</Text>
                            <Text style={[styles.goalBreakdownBalance, { color: goalBalanceColor }]}>
                              {symbolText}{goalBalanceText}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* 2. Goal Progress - Not filterable */}
        {goalProgress.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Goal Progress</Text>
            {goalProgress.map((goal, index) => {
              const totalAttempts = goal.successCount + goal.struggleCount;
              const calculatedProgress = totalAttempts > 0 
                ? Math.round((goal.successCount / totalAttempts) * 100)
                : 0;
              const progressText = `${calculatedProgress}%`;
              
              const hasRewardCurrency = goal.rewardCurrencySymbol !== undefined && goal.rewardCurrencySymbol !== null && goal.rewardCurrencySymbol !== '';
              const hasConsequenceCurrency = goal.consequenceCurrencySymbol !== undefined && goal.consequenceCurrencySymbol !== null && goal.consequenceCurrencySymbol !== '';
              
              const hasRewardBalance = hasRewardCurrency && goal.rewardCurrencyBalance !== undefined && goal.rewardCurrencyBalance !== null;
              const hasConsequenceBalance = hasConsequenceCurrency && goal.consequenceCurrencyBalance !== undefined && goal.consequenceCurrencyBalance !== null;
              
              return (
                <TouchableOpacity 
                  key={index} 
                  style={styles.reportCard}
                  onPress={() => openReflectionListModal(`${goal.goalTitle} - Reflections`, 'goal', undefined, goal.goalId)}
                >
                  <Text style={styles.goalTitle}>{goal.goalTitle}</Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: progressText }]} />
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Progress:</Text>
                    <Text style={styles.reportValue}>{progressText}</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Successes:</Text>
                    <Text style={[styles.reportValue, { color: colors.success }]}>
                      {goal.successCount}
                    </Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Struggles:</Text>
                    <Text style={[styles.reportValue, { color: colors.error }]}>
                      {goal.struggleCount}
                    </Text>
                  </View>
                  
                  {goal.currentStreak !== undefined && goal.currentStreak > 0 && (
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>🔥 Current Streak:</Text>
                      <Text style={[styles.reportValue, { color: '#FF6B35' }]}>
                        {goal.currentStreak} day{goal.currentStreak !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                  
                  {goal.bestStreak !== undefined && goal.bestStreak > 0 && (
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>⭐ Best Streak:</Text>
                      <Text style={[styles.reportValue, { color: '#FFD700' }]}>
                        {goal.bestStreak} day{goal.bestStreak !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                  
                  {(hasRewardBalance || hasConsequenceBalance) && (
                    <View style={styles.currencySection}>
                      {hasRewardBalance && (
                        <View style={styles.reportRow}>
                          <Text style={styles.reportLabel}>Reward Balance:</Text>
                          <Text style={[styles.reportValue, { color: colors.success }]}>
                            {goal.rewardCurrencyBalance} {goal.rewardCurrencySymbol || ''}
                          </Text>
                        </View>
                      )}
                      {hasConsequenceBalance && (
                        <View style={styles.reportRow}>
                          <Text style={styles.reportLabel}>Consequence Balance:</Text>
                          <Text style={[styles.reportValue, { color: colors.error }]}>
                            {goal.consequenceCurrencyBalance} {goal.consequenceCurrencySymbol || ''}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {currencyBalances.length === 0 && goalProgress.length === 0 && (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="chart.bar"
              android_material_icon_name="assessment"
              size={64}
              color={colors.muted}
            />
            <Text style={styles.emptyStateTitle}>No data yet</Text>
            <Text style={styles.emptyStateText}>
              Start tracking your goals and reflections to see reports here
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Currency Claim/Pay Modal - Fixed with KeyboardAvoidingView */}
      <Modal
        visible={showCurrencyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.currencyModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{currencyModalType === 'claim' ? 'Claim' : 'Pay'} {selectedCurrencyName}</Text>
              <View style={{ width: 24 }} />
            </View>
            
            <View style={styles.currencyModalContent}>
              <Text style={styles.currencyModalLabel}>Amount {selectedCurrencySymbol && `(${selectedCurrencySymbol})`}</Text>
              <TextInput
                style={styles.currencyModalInput}
                value={currencyModalAmount}
                onChangeText={setCurrencyModalAmount}
                placeholder="Enter amount"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                returnKeyType="done"
              />
              <Text style={styles.currencyModalHelper}>
                Maximum: {currencyModalMaxAmount} {selectedCurrencySymbol}
              </Text>
              
              <View style={styles.quickAmountButtons}>
                <TouchableOpacity
                  style={styles.quickAmountButton}
                  onPress={() => setCurrencyModalAmount((currencyModalMaxAmount / 4).toFixed(2))}
                >
                  <Text style={styles.quickAmountButtonText}>25%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAmountButton}
                  onPress={() => setCurrencyModalAmount((currencyModalMaxAmount / 2).toFixed(2))}
                >
                  <Text style={styles.quickAmountButtonText}>50%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAmountButton}
                  onPress={() => setCurrencyModalAmount((currencyModalMaxAmount * 0.75).toFixed(2))}
                >
                  <Text style={styles.quickAmountButtonText}>75%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAmountButton}
                  onPress={() => setCurrencyModalAmount(currencyModalMaxAmount.toString())}
                >
                  <Text style={styles.quickAmountButtonText}>100%</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowCurrencyModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleCurrencyAction}
                disabled={currencyModalLoading}
              >
                {currencyModalLoading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>
                    {currencyModalType === 'claim' ? 'Claim' : 'Pay'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

      {/* Reflection List Modal */}
      <ReflectionListModal
        visible={showReflectionListModal}
        onClose={() => setShowReflectionListModal(false)}
        title={reflectionListTitle}
        filterType={reflectionListFilterType}
        filterValue={reflectionListFilterValue}
        goalId={reflectionListGoalId}
        startDate={getDateRangeForModal().startDate}
        endDate={getDateRangeForModal().endDate}
      />
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
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 12,
  },
  reportCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  reportSymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  reportValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  reportSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.cardBorder,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  goalBreakdownSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  goalBreakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  goalBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  goalBreakdownGoal: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  goalBreakdownBalance: {
    fontSize: 14,
    fontWeight: '600',
  },
  currencyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  claimButton: {
    backgroundColor: colors.success,
  },
  payButton: {
    backgroundColor: colors.error,
  },
  currencyActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  currencyModal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  currencyModalContent: {
    padding: 20,
  },
  currencyModalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  currencyModalInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  currencyModalHelper: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  quickAmountButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickAmountButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  quickAmountButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
  currencySection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  termHeader: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  distributionValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  percentageText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterSection: {
    marginBottom: 24,
    marginTop: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  otherReportsSmallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  otherReportsSmallButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
