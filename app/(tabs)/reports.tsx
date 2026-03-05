
import { IconSymbol } from "@/components/IconSymbol";
import React, { useState, useEffect } from "react";
import { authenticatedGet, authenticatedPost } from "@/utils/api";
import { useRouter } from "expo-router";
import { colors } from "@/styles/commonStyles";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from "react-native";
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

export default function ReportsScreen() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
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

  const loadReportsData = async () => {
    console.log("Loading reports data");
    setLoading(true);
    try {
      const [
        currencyRes,
        currenciesRes,
        winsLossesRes,
        successStrugglesRes,
        reflectionStatsRes,
        journalCountRes,
        gainsLossesRes,
        gainsLossesDistRes,
        behaviorCountsRes,
        goalProgressRes,
        topMotivationsByTypeRes,
        topMotivationsByOutcomeRes,
      ] = await Promise.all([
        authenticatedGet('/api/reports/currency-balances'),
        authenticatedGet('/api/currencies'),
        authenticatedGet('/api/reports/wins-vs-losses'),
        authenticatedGet('/api/reports/success-vs-struggles'),
        authenticatedGet('/api/reports/reflection-stats'),
        authenticatedGet('/api/reports/journal-count'),
        authenticatedGet('/api/reports/gains-losses-summary'),
        authenticatedGet('/api/reports/gains-losses-distribution'),
        authenticatedGet('/api/reports/behavior-counts'),
        authenticatedGet('/api/reports/goal-progress'),
        authenticatedGet('/api/reports/top-motivations-by-type'),
        authenticatedGet('/api/reports/top-motivations-by-outcome'),
      ]);

      const currencyData = Array.isArray(currencyRes) ? currencyRes : (currencyRes?.data || []);
      const currenciesData = Array.isArray(currenciesRes) ? currenciesRes : (currenciesRes?.data || []);
      const winsLossesData = winsLossesRes?.data || winsLossesRes || null;
      const successStrugglesData = successStrugglesRes?.data || successStrugglesRes || null;
      const reflectionStatsData = reflectionStatsRes?.data || reflectionStatsRes || null;
      const journalCountData = journalCountRes?.data || journalCountRes || null;
      const gainsLossesData = gainsLossesRes?.data || gainsLossesRes || null;
      const gainsLossesDistData = gainsLossesDistRes?.data || gainsLossesDistRes || null;
      const behaviorCountsData = behaviorCountsRes?.data || behaviorCountsRes || null;
      const goalProgressData = Array.isArray(goalProgressRes) ? goalProgressRes : (goalProgressRes?.data || []);
      const topMotivationsByTypeData = topMotivationsByTypeRes?.data || topMotivationsByTypeRes || null;
      const topMotivationsByOutcomeData = topMotivationsByOutcomeRes?.data || topMotivationsByOutcomeRes || null;

      setCurrencyBalances(currencyData);
      setCurrencies(currenciesData);
      setWinsVsLosses(winsLossesData);
      setSuccessVsStruggles(successStrugglesData);
      setReflectionStats(reflectionStatsData);
      setJournalCount(journalCountData);
      setGainsLossesSummary(gainsLossesData);
      setGainsLossesDistribution(gainsLossesDistData);
      setBehaviorCounts(behaviorCountsData);
      setGoalProgress(goalProgressData);
      setTopMotivationsByType(topMotivationsByTypeData);
      setTopMotivationsByOutcome(topMotivationsByOutcomeData);
      console.log('[Reports] Top motivations by type:', topMotivationsByTypeData);
      console.log('[Reports] Top motivations by outcome:', topMotivationsByOutcomeData);

      console.log("Reports data loaded successfully");
    } catch (error: any) {
      console.error("Error loading reports data:", error);
      showError(error.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("ReportsScreen mounted");
    loadReportsData();
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
      const endpoint = currencyModalType === 'claim' 
        ? `/api/currencies/${selectedCurrencyId}/claim`
        : `/api/currencies/${selectedCurrencyId}/pay`;
      
      const response = await authenticatedPost(endpoint, { amount });
      
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
      >
        <Text style={styles.headerTitle}>Reports</Text>

        {/* TOP MOTIVATIONS BY TYPE REPORT */}
        {topMotivationsByType && (
          (topMotivationsByType.proactive?.length > 0 || topMotivationsByType.restraint?.length > 0) && (
            <>
              <Text style={styles.sectionTitle}>Top Motivations by Reflection Type</Text>
              <View style={styles.reportCard}>
                {topMotivationsByType.proactive?.length > 0 && (
                  <>
                    <Text style={styles.reportSubtitle}>Proactive Reflections</Text>
                    {topMotivationsByType.proactive.map((item, idx) => (
                      <View key={idx} style={styles.reportRow}>
                        <Text style={styles.reportLabel}>{item.motivationName}</Text>
                        <Text style={[styles.reportValue, { color: colors.primary }]}>{item.count}x</Text>
                      </View>
                    ))}
                  </>
                )}
                {topMotivationsByType.restraint?.length > 0 && (
                  <>
                    <Text style={[styles.reportSubtitle, topMotivationsByType.proactive?.length > 0 ? { marginTop: 12 } : {}]}>Restraint Reflections</Text>
                    {topMotivationsByType.restraint.map((item, idx) => (
                      <View key={idx} style={styles.reportRow}>
                        <Text style={styles.reportLabel}>{item.motivationName}</Text>
                        <Text style={[styles.reportValue, { color: colors.secondary || colors.primary }]}>{item.count}x</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </>
          )
        )}

        {/* TOP MOTIVATIONS BY OUTCOME REPORT */}
        {topMotivationsByOutcome && (
          (topMotivationsByOutcome.success?.length > 0 || topMotivationsByOutcome.struggle?.length > 0) && (
            <>
              <Text style={styles.sectionTitle}>Top Motivations by Goal Outcome</Text>
              <View style={styles.reportCard}>
                {topMotivationsByOutcome.success?.length > 0 && (
                  <>
                    <Text style={styles.reportSubtitle}>Success Reflections</Text>
                    {topMotivationsByOutcome.success.map((item, idx) => (
                      <View key={idx} style={styles.reportRow}>
                        <Text style={styles.reportLabel}>{item.motivationName}</Text>
                        <Text style={[styles.reportValue, { color: colors.success }]}>{item.count}x</Text>
                      </View>
                    ))}
                  </>
                )}
                {topMotivationsByOutcome.struggle?.length > 0 && (
                  <>
                    <Text style={[styles.reportSubtitle, topMotivationsByOutcome.success?.length > 0 ? { marginTop: 12 } : {}]}>Struggle Reflections</Text>
                    {topMotivationsByOutcome.struggle.map((item, idx) => (
                      <View key={idx} style={styles.reportRow}>
                        <Text style={styles.reportLabel}>{item.motivationName}</Text>
                        <Text style={[styles.reportValue, { color: colors.error }]}>{item.count}x</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </>
          )
        )}

        {/* Currency Balances - Same as iOS */}
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

        {/* Wins vs Losses - With popup */}
        {winsVsLosses && (
          <>
            <Text style={styles.sectionTitle}>Wins vs Losses</Text>
            <TouchableOpacity 
              style={styles.reportCard}
              onPress={() => openReflectionListModal('Wins vs Losses', 'all')}
            >
              <TouchableOpacity 
                style={styles.reportRow}
                onPress={() => openReflectionListModal('Wins', 'wins')}
              >
                <Text style={styles.reportLabel}>Wins:</Text>
                <Text style={[styles.reportValue, { color: colors.success }]}>
                  {winsVsLosses.wins}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.reportRow}
                onPress={() => openReflectionListModal('Losses', 'losses')}
              >
                <Text style={styles.reportLabel}>Losses:</Text>
                <Text style={[styles.reportValue, { color: colors.error }]}>
                  {winsVsLosses.losses}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </>
        )}

        {/* Success vs Struggles - With popup */}
        {successVsStruggles && (
          <>
            <Text style={styles.sectionTitle}>Success vs Struggles</Text>
            <TouchableOpacity 
              style={styles.reportCard}
              onPress={() => openReflectionListModal('Success vs Struggles', 'all')}
            >
              <TouchableOpacity 
                style={styles.reportRow}
                onPress={() => openReflectionListModal('Successes', 'successes')}
              >
                <Text style={styles.reportLabel}>Successes:</Text>
                <Text style={[styles.reportValue, { color: colors.success }]}>
                  {successVsStruggles.successes}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.reportRow}
                onPress={() => openReflectionListModal('Struggles', 'struggles')}
              >
                <Text style={styles.reportLabel}>Struggles:</Text>
                <Text style={[styles.reportValue, { color: colors.error }]}>
                  {successVsStruggles.struggles}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </>
        )}

        {/* Reflection Statistics - With popup */}
        {reflectionStats && (
          <>
            <Text style={styles.sectionTitle}>Reflection Statistics</Text>
            <TouchableOpacity 
              style={styles.reportCard}
              onPress={() => openReflectionListModal('All Reflections', 'all')}
            >
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Total Reflections:</Text>
                <Text style={styles.reportValue}>{reflectionStats.totalReflections}</Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Restraints:</Text>
                <Text style={styles.reportValue}>{reflectionStats.totalRestraints}</Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Proactive:</Text>
                <Text style={styles.reportValue}>{reflectionStats.totalProactive}</Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Worth It %:</Text>
                <Text style={[styles.reportValue, { color: colors.primary }]}>
                  {roundedWorthItPercentage}%
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Journal Count - No popup needed */}
        {journalCount && (
          <>
            <Text style={styles.sectionTitle}>Journal Entries</Text>
            <View style={styles.reportCard}>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Total Entries:</Text>
                <Text style={styles.reportValue}>{journalCount.count}</Text>
              </View>
            </View>
          </>
        )}

        {/* Gains and Losses - With popup */}
        {gainsLossesSummary && (
          <>
            <Text style={styles.sectionTitle}>Gains and Losses</Text>
            <TouchableOpacity 
              style={styles.reportCard}
              onPress={() => openReflectionListModal('Gains and Losses', 'all')}
            >
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Total Gains:</Text>
                <Text style={[styles.reportValue, { color: colors.success }]}>
                  {gainsLossesSummary.totalGains}
                </Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Total Losses:</Text>
                <Text style={[styles.reportValue, { color: colors.error }]}>
                  {gainsLossesSummary.totalLosses}
                </Text>
              </View>
              
              {gainsLossesSummary.topGains.length > 0 && (
                <>
                  <Text style={styles.reportSubtitle}>Top 3 Gains:</Text>
                  {gainsLossesSummary.topGains.map((gain, idx) => {
                    const countText = `${gain.count}x`;
                    
                    return (
                      <View key={idx} style={styles.reportRow}>
                        <Text style={styles.reportLabel}>{gain.name}:</Text>
                        <Text style={styles.reportValue}>{countText}</Text>
                      </View>
                    );
                  })}
                </>
              )}
              
              {gainsLossesSummary.topLosses.length > 0 && (
                <>
                  <Text style={styles.reportSubtitle}>Top 3 Losses:</Text>
                  {gainsLossesSummary.topLosses.map((loss, idx) => {
                    const countText = `${loss.count}x`;
                    
                    return (
                      <View key={idx} style={styles.reportRow}>
                        <Text style={styles.reportLabel}>{loss.name}:</Text>
                        <Text style={styles.reportValue}>{countText}</Text>
                      </View>
                    );
                  })}
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Gains & Losses Distribution - No popup needed (detailed breakdown) */}
        {gainsLossesDistribution && (
          <>
            <Text style={styles.sectionTitle}>Gains & Losses Distribution</Text>
            <View style={styles.reportCard}>
              <Text style={styles.reportSubtitle}>By Term</Text>
              
              <Text style={styles.termHeader}>Gains:</Text>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Short Term:</Text>
                <View style={styles.distributionValue}>
                  <Text style={[styles.reportValue, { color: colors.success }]}>
                    {gainsLossesDistribution.termDistribution.gains.short.count}
                  </Text>
                  <Text style={styles.percentageText}>
                    ({gainsLossesDistribution.termDistribution.gains.short.percentage}%)
                  </Text>
                </View>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Medium Term:</Text>
                <View style={styles.distributionValue}>
                  <Text style={[styles.reportValue, { color: colors.success }]}>
                    {gainsLossesDistribution.termDistribution.gains.medium.count}
                  </Text>
                  <Text style={styles.percentageText}>
                    ({gainsLossesDistribution.termDistribution.gains.medium.percentage}%)
                  </Text>
                </View>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Long Term:</Text>
                <View style={styles.distributionValue}>
                  <Text style={[styles.reportValue, { color: colors.success }]}>
                    {gainsLossesDistribution.termDistribution.gains.long.count}
                  </Text>
                  <Text style={styles.percentageText}>
                    ({gainsLossesDistribution.termDistribution.gains.long.percentage}%)
                  </Text>
                </View>
              </View>
              
              <Text style={[styles.termHeader, { marginTop: 12 }]}>Losses:</Text>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Short Term:</Text>
                <View style={styles.distributionValue}>
                  <Text style={[styles.reportValue, { color: colors.error }]}>
                    {gainsLossesDistribution.termDistribution.losses.short.count}
                  </Text>
                  <Text style={styles.percentageText}>
                    ({gainsLossesDistribution.termDistribution.losses.short.percentage}%)
                  </Text>
                </View>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Medium Term:</Text>
                <View style={styles.distributionValue}>
                  <Text style={[styles.reportValue, { color: colors.error }]}>
                    {gainsLossesDistribution.termDistribution.losses.medium.count}
                  </Text>
                  <Text style={styles.percentageText}>
                    ({gainsLossesDistribution.termDistribution.losses.medium.percentage}%)
                  </Text>
                </View>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Long Term:</Text>
                <View style={styles.distributionValue}>
                  <Text style={[styles.reportValue, { color: colors.error }]}>
                    {gainsLossesDistribution.termDistribution.losses.long.count}
                  </Text>
                  <Text style={styles.percentageText}>
                    ({gainsLossesDistribution.termDistribution.losses.long.percentage}%)
                  </Text>
                </View>
              </View>
              
              {gainsLossesDistribution.topCategories.gains.length > 0 && (
                <>
                  <Text style={[styles.reportSubtitle, { marginTop: 16 }]}>Top Gain Categories</Text>
                  {gainsLossesDistribution.topCategories.gains.map((item, idx) => {
                    const categoryName = item.category || 'Uncategorized';
                    
                    return (
                      <View key={idx} style={styles.reportRow}>
                        <Text style={styles.reportLabel}>{categoryName}:</Text>
                        <View style={styles.distributionValue}>
                          <Text style={[styles.reportValue, { color: colors.success }]}>
                            {item.count}
                          </Text>
                          <Text style={styles.percentageText}>
                            ({item.percentage}%)
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
              
              {gainsLossesDistribution.topCategories.losses.length > 0 && (
                <>
                  <Text style={[styles.reportSubtitle, { marginTop: 16 }]}>Top Loss Categories</Text>
                  {gainsLossesDistribution.topCategories.losses.map((item, idx) => {
                    const categoryName = item.category || 'Uncategorized';
                    
                    return (
                      <View key={idx} style={styles.reportRow}>
                        <Text style={styles.reportLabel}>{categoryName}:</Text>
                        <View style={styles.distributionValue}>
                          <Text style={[styles.reportValue, { color: colors.error }]}>
                            {item.count}
                          </Text>
                          <Text style={styles.percentageText}>
                            ({item.percentage}%)
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
            </View>
          </>
        )}

        {/* Behavior Entries - With popup */}
        {behaviorCounts && (
          <>
            <Text style={styles.sectionTitle}>Behavior Entries</Text>
            <View style={styles.reportCard}>
              <TouchableOpacity 
                style={styles.reportRow}
                onPress={() => openReflectionListModal('Action Entries', 'behavior', 'Action')}
              >
                <Text style={styles.reportLabel}>Action Entries:</Text>
                <Text style={styles.reportValue}>{behaviorCounts.actionEntries}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.reportRow}
                onPress={() => openReflectionListModal('Speech Entries', 'behavior', 'Speech')}
              >
                <Text style={styles.reportLabel}>Speech Entries:</Text>
                <Text style={styles.reportValue}>{behaviorCounts.speechEntries}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.reportRow}
                onPress={() => openReflectionListModal('Thought Entries', 'behavior', 'Thought')}
              >
                <Text style={styles.reportLabel}>Thought Entries:</Text>
                <Text style={styles.reportValue}>{behaviorCounts.thoughtEntries}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Goal Progress - With popup */}
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

        {currencyBalances.length === 0 && !winsVsLosses && !successVsStruggles && (
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

      {/* Currency Modal - Same as iOS but without KeyboardAvoidingView wrapper */}
      <Modal
        visible={showCurrencyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <View style={styles.modalOverlay}>
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
        </View>
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
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? 48 : 0,
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
});
