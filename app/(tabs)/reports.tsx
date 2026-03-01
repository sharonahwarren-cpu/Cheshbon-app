
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
  Dimensions,
} from "react-native";
import { authenticatedGet, authenticatedPost } from "@/utils/api";
import React, { useState, useEffect } from "react";
import { colors } from "@/styles/commonStyles";
import { useAuth } from "@/contexts/AuthContext";
import { IconSymbol } from "@/components/IconSymbol";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { VictoryPie, VictoryChart, VictoryLine, VictoryAxis, VictoryTheme, VictoryLabel } from "victory-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";

interface CurrencyBalance {
  currencyId: string;
  currencyName: string;
  symbol: string;
  totalBalance: number;
  goalBreakdown?: Array<{ goalId: string; goalTitle: string; balance: number }>;
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
  byCategory: Array<{ category: string; gains: number; losses: number }>;
  topGains: Array<{ id: string; name: string; count: number }>;
  topLosses: Array<{ id: string; name: string; count: number }>;
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
  rewardCurrencyBalance?: number;
  rewardCurrencySymbol?: string;
  consequenceCurrencyBalance?: number;
  consequenceCurrencySymbol?: string;
}

interface Currency {
  id: string;
  name: string;
  symbol?: string;
  type?: 'reward' | 'consequence';
  onSuccess?: 'ADD' | 'SUBTRACT' | 'NONE';
  onFailure?: 'ADD' | 'SUBTRACT' | 'NONE';
}

interface Strategy {
  id: string;
  name: string;
  successCount: number;
  failureCount: number;
  timesUsed: number;
  successRate: number;
}

type TimeRange = 'week' | 'month' | '60days' | '90days' | 'year' | 'all' | 'custom';

const { width: screenWidth } = Dimensions.get('window');

export default function ReportsScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'reports' | 'charts'>('reports');
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('week');
  
  const [currencyBalances, setCurrencyBalances] = useState<CurrencyBalance[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [winsVsLosses, setWinsVsLosses] = useState<WinsVsLosses | null>(null);
  const [successVsStruggles, setSuccessVsStruggles] = useState<SuccessVsStruggles | null>(null);
  const [reflectionStats, setReflectionStats] = useState<ReflectionStats | null>(null);
  const [journalCount, setJournalCount] = useState<JournalCount | null>(null);
  const [gainsLossesSummary, setGainsLossesSummary] = useState<GainsLossesSummary | null>(null);
  const [behaviorCounts, setBehaviorCounts] = useState<BehaviorCounts | null>(null);
  const [goalProgress, setGoalProgress] = useState<GoalProgress[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  
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

  useEffect(() => {
    console.log("ReportsScreen mounted");
    loadReportsData();
  }, []);

  useEffect(() => {
    if (currentView === 'charts') {
      console.log("Loading chart data for time range:", selectedTimeRange);
      loadChartData();
    }
  }, [currentView, selectedTimeRange]);

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
        behaviorCountsRes,
        goalProgressRes,
      ] = await Promise.all([
        authenticatedGet('/api/reports/currency-balances'),
        authenticatedGet('/api/currencies'),
        authenticatedGet('/api/reports/wins-vs-losses'),
        authenticatedGet('/api/reports/success-vs-struggles'),
        authenticatedGet('/api/reports/reflection-stats'),
        authenticatedGet('/api/reports/journal-count'),
        authenticatedGet('/api/reports/gains-losses-summary'),
        authenticatedGet('/api/reports/behavior-counts'),
        authenticatedGet('/api/reports/goal-progress'),
      ]);

      const currencyData = Array.isArray(currencyRes) ? currencyRes : (currencyRes?.data || []);
      const currenciesData = Array.isArray(currenciesRes) ? currenciesRes : (currenciesRes?.data || []);
      const winsLossesData = winsLossesRes?.data || winsLossesRes || null;
      const successStrugglesData = successStrugglesRes?.data || successStrugglesRes || null;
      const reflectionStatsData = reflectionStatsRes?.data || reflectionStatsRes || null;
      const journalCountData = journalCountRes?.data || journalCountRes || null;
      const gainsLossesData = gainsLossesRes?.data || gainsLossesRes || null;
      const behaviorCountsData = behaviorCountsRes?.data || behaviorCountsRes || null;
      const goalProgressData = Array.isArray(goalProgressRes) ? goalProgressRes : (goalProgressRes?.data || []);

      setCurrencyBalances(currencyData);
      setCurrencies(currenciesData);
      setWinsVsLosses(winsLossesData);
      setSuccessVsStruggles(successStrugglesData);
      setReflectionStats(reflectionStatsData);
      setJournalCount(journalCountData);
      setGainsLossesSummary(gainsLossesData);
      setBehaviorCounts(behaviorCountsData);
      setGoalProgress(goalProgressData);

      console.log("Reports data loaded successfully");
    } catch (error: any) {
      console.error("Error loading reports data:", error);
      showError(error.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const loadChartData = async () => {
    console.log("Loading chart data for time range:", selectedTimeRange);
    try {
      const strategiesRes = await authenticatedGet('/api/strategies');
      const strategiesData = Array.isArray(strategiesRes) ? strategiesRes : (strategiesRes?.data || []);
      setStrategies(strategiesData);
    } catch (error: any) {
      console.error("Error loading chart data:", error);
      showError(error.message || "Failed to load chart data");
    }
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

  const renderGaugeChart = (value: number, total: number, label: string, color: string) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const angle = (percentage / 100) * 180;
    const radius = 80;
    const centerX = 100;
    const centerY = 100;
    
    const percentageText = `${Math.round(percentage)}%`;
    const valueText = `${value}`;
    const totalText = `${total}`;
    
    return (
      <View style={styles.gaugeContainer}>
        <Text style={styles.gaugeLabel}>{label}</Text>
        <Svg width={200} height={140} viewBox="0 0 200 140">
          <Circle
            cx={centerX}
            cy={centerY}
            r={radius}
            stroke={colors.cardBorder}
            strokeWidth={20}
            fill="none"
            strokeDasharray={`${Math.PI * radius} ${Math.PI * radius}`}
            strokeDashoffset={0}
            rotation="-180"
            origin={`${centerX}, ${centerY}`}
          />
          <Circle
            cx={centerX}
            cy={centerY}
            r={radius}
            stroke={color}
            strokeWidth={20}
            fill="none"
            strokeDasharray={`${Math.PI * radius} ${Math.PI * radius}`}
            strokeDashoffset={Math.PI * radius * (1 - percentage / 100)}
            rotation="-180"
            origin={`${centerX}, ${centerY}`}
            strokeLinecap="round"
          />
          <SvgText
            x={centerX}
            y={centerY - 10}
            fontSize="32"
            fontWeight="bold"
            fill={colors.text}
            textAnchor="middle"
          >
            {percentageText}
          </SvgText>
          <SvgText
            x={centerX}
            y={centerY + 20}
            fontSize="16"
            fill={colors.textSecondary}
            textAnchor="middle"
          >
            {valueText} / {totalText}
          </SvgText>
        </Svg>
      </View>
    );
  };

  const renderStrategyLineChart = () => {
    if (strategies.length === 0) {
      return (
        <View style={styles.emptyChartState}>
          <Text style={styles.emptyChartText}>No strategy data available</Text>
        </View>
      );
    }

    const chartData = strategies.slice(0, 5).map((strategy, index) => ({
      x: index + 1,
      y: strategy.successRate,
      label: strategy.name,
    }));

    return (
      <View style={styles.lineChartContainer}>
        <Text style={styles.chartTitle}>Strategy Effectiveness Over Time</Text>
        <VictoryChart
          width={screenWidth - 40}
          height={300}
          theme={VictoryTheme.material}
          padding={{ top: 20, bottom: 60, left: 60, right: 20 }}
        >
          <VictoryAxis
            style={{
              axis: { stroke: colors.border },
              tickLabels: { fill: colors.textSecondary, fontSize: 10 },
              grid: { stroke: colors.cardBorder, strokeDasharray: '4,4' },
            }}
            tickFormat={(t) => {
              const strategy = strategies[t - 1];
              const strategyName = strategy ? strategy.name : '';
              const shortName = strategyName.length > 10 ? strategyName.substring(0, 10) + '...' : strategyName;
              return shortName;
            }}
          />
          <VictoryAxis
            dependentAxis
            style={{
              axis: { stroke: colors.border },
              tickLabels: { fill: colors.textSecondary, fontSize: 12 },
              grid: { stroke: colors.cardBorder, strokeDasharray: '4,4' },
            }}
            tickFormat={(t) => `${t}%`}
          />
          <VictoryLine
            data={chartData}
            style={{
              data: { stroke: colors.primary, strokeWidth: 3 },
              parent: { border: "1px solid #ccc" }
            }}
            animate={{
              duration: 1000,
              onLoad: { duration: 500 }
            }}
          />
        </VictoryChart>
        <View style={styles.strategyLegend}>
          {strategies.slice(0, 5).map((strategy, index) => {
            const strategyName = strategy.name;
            const successRateText = `${strategy.successRate}%`;
            const timesUsedText = `${strategy.timesUsed}x`;
            
            return (
              <View key={index} style={styles.strategyLegendItem}>
                <View style={[styles.strategyLegendDot, { backgroundColor: colors.primary }]} />
                <View style={styles.strategyLegendTextContainer}>
                  <Text style={styles.strategyLegendName}>{strategyName}</Text>
                  <Text style={styles.strategyLegendStats}>
                    {successRateText} success • {timesUsedText} used
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderTimeRangeSelector = () => {
    const timeRanges: { value: TimeRange; label: string }[] = [
      { value: 'week', label: 'Week' },
      { value: 'month', label: 'Month' },
      { value: '60days', label: '60 Days' },
      { value: '90days', label: '90 Days' },
      { value: 'year', label: 'Year' },
      { value: 'all', label: 'All' },
      { value: 'custom', label: 'Custom' },
    ];

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.timeRangeSelector}
        contentContainerStyle={styles.timeRangeSelectorContent}
      >
        {timeRanges.map((range) => {
          const isSelected = selectedTimeRange === range.value;
          
          return (
            <TouchableOpacity
              key={range.value}
              style={[
                styles.timeRangeButton,
                isSelected && styles.timeRangeButtonActive,
              ]}
              onPress={() => setSelectedTimeRange(range.value)}
            >
              <Text
                style={[
                  styles.timeRangeButtonText,
                  isSelected && styles.timeRangeButtonTextActive,
                ]}
              >
                {range.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderChartsView = () => {
    const winsTotal = winsVsLosses ? winsVsLosses.wins + winsVsLosses.losses : 0;
    const winsValue = winsVsLosses ? winsVsLosses.wins : 0;
    const lossesValue = winsVsLosses ? winsVsLosses.losses : 0;

    return (
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.viewToggleContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setCurrentView('reports')}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
            <Text style={styles.backButtonText}>Back to Reports</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.headerTitle}>Charts</Text>

        {renderTimeRangeSelector()}

        <Text style={styles.sectionTitle}>Wins vs Losses</Text>
        <View style={styles.gaugeRow}>
          {renderGaugeChart(winsValue, winsTotal, 'Wins', colors.success)}
          {renderGaugeChart(lossesValue, winsTotal, 'Losses', colors.error)}
        </View>

        <Text style={styles.sectionTitle}>Strategy Effectiveness</Text>
        {renderStrategyLineChart()}
      </ScrollView>
    );
  };

  const renderReportsView = () => {
    return (
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.viewToggleContainer}>
          <Text style={styles.headerTitle}>Reports</Text>
          <TouchableOpacity
            style={styles.chartsButton}
            onPress={() => setCurrentView('charts')}
          >
            <IconSymbol
              ios_icon_name="chart.bar"
              android_material_icon_name="assessment"
              size={20}
              color={colors.background}
            />
            <Text style={styles.chartsButtonText}>View Charts</Text>
          </TouchableOpacity>
        </View>

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
                  
                  <TouchableOpacity 
                    style={styles.drillDownHint}
                    onPress={() => {
                      console.log("Navigating to currency reflections for:", balance.currencyId);
                      router.push(`/currency-reflections?currencyId=${balance.currencyId}`);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="arrow-forward"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.drillDownText}>Tap to view related reflections</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}

        {winsVsLosses && (
          <>
            <Text style={styles.sectionTitle}>Wins vs Losses</Text>
            <TouchableOpacity 
              style={styles.reportCard}
              onPress={() => {
                console.log("Navigating to reflections");
                router.push('/(tabs)/reflect');
              }}
            >
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Wins:</Text>
                <Text style={[styles.reportValue, { color: colors.success }]}>
                  {winsVsLosses.wins}
                </Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Losses:</Text>
                <Text style={[styles.reportValue, { color: colors.error }]}>
                  {winsVsLosses.losses}
                </Text>
              </View>
              <View style={styles.drillDownHint}>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.drillDownText}>Tap to view reflections</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {successVsStruggles && (
          <>
            <Text style={styles.sectionTitle}>Success vs Struggles</Text>
            <TouchableOpacity 
              style={styles.reportCard}
              onPress={() => {
                console.log("Navigating to reflections");
                router.push('/(tabs)/reflect');
              }}
            >
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Successes:</Text>
                <Text style={[styles.reportValue, { color: colors.success }]}>
                  {successVsStruggles.successes}
                </Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Struggles:</Text>
                <Text style={[styles.reportValue, { color: colors.error }]}>
                  {successVsStruggles.struggles}
                </Text>
              </View>
              <View style={styles.drillDownHint}>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.drillDownText}>Tap to view reflections</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {reflectionStats && (
          <>
            <Text style={styles.sectionTitle}>Reflection Statistics</Text>
            <TouchableOpacity 
              style={styles.reportCard}
              onPress={() => {
                console.log("Navigating to reflections");
                router.push('/(tabs)/reflect');
              }}
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
                  {reflectionStats.worthItPercentage}%
                </Text>
              </View>
              <View style={styles.drillDownHint}>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.drillDownText}>Tap to view reflections</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

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

        {gainsLossesSummary && (
          <>
            <Text style={styles.sectionTitle}>Gains and Losses</Text>
            <TouchableOpacity 
              style={styles.reportCard}
              onPress={() => {
                console.log("Navigating to reflections");
                router.push('/(tabs)/reflect');
              }}
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
              <View style={styles.drillDownHint}>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.drillDownText}>Tap to view reflections</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {behaviorCounts && (
          <>
            <Text style={styles.sectionTitle}>Behavior Entries</Text>
            <TouchableOpacity 
              style={styles.reportCard}
              onPress={() => {
                console.log("Navigating to reflections");
                router.push('/(tabs)/reflect');
              }}
            >
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Action Entries:</Text>
                <Text style={styles.reportValue}>{behaviorCounts.actionEntries}</Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Speech Entries:</Text>
                <Text style={styles.reportValue}>{behaviorCounts.speechEntries}</Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Thought Entries:</Text>
                <Text style={styles.reportValue}>{behaviorCounts.thoughtEntries}</Text>
              </View>
              <View style={styles.drillDownHint}>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.drillDownText}>Tap to view reflections</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {goalProgress.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Goal Progress</Text>
            {goalProgress.map((goal, index) => {
              const progressText = `${goal.progress || 0}%`;
              
              const hasRewardBalance = goal.rewardCurrencyBalance !== undefined && goal.rewardCurrencyBalance !== null;
              const hasConsequenceBalance = goal.consequenceCurrencyBalance !== undefined && goal.consequenceCurrencyBalance !== null;
              
              return (
                <TouchableOpacity 
                  key={index} 
                  style={styles.reportCard}
                  onPress={() => {
                    console.log("Navigating to reflections for goal:", goal.goalId);
                    router.push({
                      pathname: '/(tabs)/reflect',
                      params: { goalId: goal.goalId },
                    });
                  }}
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
                  
                  <View style={styles.drillDownHint}>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="arrow-forward"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.drillDownText}>Tap to view reflections</Text>
                  </View>
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
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {currentView === 'reports' ? renderReportsView() : renderChartsView()}

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
    paddingTop: Platform.OS === 'android' ? 48 : 20,
    paddingBottom: 100,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
  },
  chartsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  chartsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  timeRangeSelector: {
    marginBottom: 20,
  },
  timeRangeSelectorContent: {
    gap: 8,
  },
  timeRangeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeRangeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeRangeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  timeRangeButtonTextActive: {
    color: colors.background,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 12,
  },
  gaugeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  gaugeContainer: {
    alignItems: 'center',
  },
  gaugeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  lineChartContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  strategyLegend: {
    marginTop: 16,
    gap: 12,
  },
  strategyLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  strategyLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  strategyLegendTextContainer: {
    flex: 1,
  },
  strategyLegendName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  strategyLegendStats: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyChartState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartText: {
    fontSize: 14,
    color: colors.textSecondary,
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
  drillDownHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  drillDownText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencyModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
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
});
