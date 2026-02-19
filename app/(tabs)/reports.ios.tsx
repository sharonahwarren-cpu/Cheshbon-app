
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { authenticatedGet, authenticatedPost } from "@/utils/api";
import React, { useState, useEffect } from "react";
import { colors } from "@/styles/commonStyles";
import { useAuth } from "@/contexts/AuthContext";
import { IconSymbol } from "@/components/IconSymbol";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

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

export default function ReportsScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [currencyBalances, setCurrencyBalances] = useState<CurrencyBalance[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [winsVsLosses, setWinsVsLosses] = useState<WinsVsLosses | null>(null);
  const [successVsStruggles, setSuccessVsStruggles] = useState<SuccessVsStruggles | null>(null);
  const [reflectionStats, setReflectionStats] = useState<ReflectionStats | null>(null);
  const [journalCount, setJournalCount] = useState<JournalCount | null>(null);
  const [gainsLossesSummary, setGainsLossesSummary] = useState<GainsLossesSummary | null>(null);
  const [behaviorCounts, setBehaviorCounts] = useState<BehaviorCounts | null>(null);
  const [goalProgress, setGoalProgress] = useState<GoalProgress[]>([]);
  
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
    console.log("ReportsScreen iOS mounted");
    loadReportsData();
  }, []);

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
    console.log("Loading reports data iOS");
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

      console.log("Reports data loaded successfully iOS");
    } catch (error: any) {
      console.error("Error loading reports data iOS:", error);
      showError(error.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const isRewardCurrency = (currency: Currency): boolean => {
    return currency.onSuccess === 'ADD';
  };

  const openCurrencyModal = (currencyId: string, currencyName: string, currencySymbol: string, balance: number, type: 'claim' | 'pay') => {
    console.log("Opening currency modal iOS:", type, currencyName, balance);
    setSelectedCurrencyId(currencyId);
    setSelectedCurrencyName(currencyName);
    setSelectedCurrencySymbol(currencySymbol);
    setCurrencyModalType(type);
    setCurrencyModalMaxAmount(Math.abs(balance));
    setCurrencyModalAmount(Math.abs(balance).toString());
    setShowCurrencyModal(true);
  };

  const handleCurrencyAction = async () => {
    console.log("Handling currency action iOS:", currencyModalType, selectedCurrencyName, currencyModalAmount);
    
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
      console.error("Error processing currency action iOS:", error);
      showError(error.message || `Failed to ${currencyModalType} currency`);
    } finally {
      setCurrencyModalLoading(false);
    }
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
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.headerTitle}>Reports</Text>

        {currencyBalances.length === 0 && !winsVsLosses && !successVsStruggles ? (
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
        ) : (
          <Text style={styles.placeholderText}>
            View detailed reports in Settings
          </Text>
        )}
      </ScrollView>

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
    paddingTop: 20,
    paddingBottom: 100,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 24,
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
  placeholderText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
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
