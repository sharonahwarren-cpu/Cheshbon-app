
import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { authenticatedGet, authenticatedPost } from "@/utils/api";

interface CurrencyBalance {
  currencyId: string;
  currencyName: string;
  symbol: string;
  earned: number;
  lost: number;
  debtAdded: number;
  debtReduced: number;
  netBalance: number;
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
}

interface ActivatedGoal {
  id: string;
  title: string;
  description?: string;
  type: 'RESTRAINING' | 'PROACTIVE';
  lifeArea?: { id: string; name: string };
  behaviorCategories: string[];
  todaySuccessCount: number;
  todayStruggleCount: number;
}

export default function HomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'reports' | 'express'>('reports');
  const [loading, setLoading] = useState(true);
  
  const [currencyBalances, setCurrencyBalances] = useState<CurrencyBalance[]>([]);
  const [winsVsLosses, setWinsVsLosses] = useState<WinsVsLosses | null>(null);
  const [successVsStruggles, setSuccessVsStruggles] = useState<SuccessVsStruggles | null>(null);
  const [reflectionStats, setReflectionStats] = useState<ReflectionStats | null>(null);
  const [journalCount, setJournalCount] = useState<JournalCount | null>(null);
  const [gainsLossesSummary, setGainsLossesSummary] = useState<GainsLossesSummary | null>(null);
  const [behaviorCounts, setBehaviorCounts] = useState<BehaviorCounts | null>(null);
  const [goalProgress, setGoalProgress] = useState<GoalProgress[]>([]);
  
  const [activatedGoals, setActivatedGoals] = useState<ActivatedGoal[]>([]);
  const [categorizedGoals, setCategorizedGoals] = useState<Record<string, ActivatedGoal[]>>({});
  
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    console.log("HomeScreen mounted");
    loadData();
  }, []);

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setSuccessModalVisible(true);
  };

  const loadData = async () => {
    console.log("Loading home screen data");
    setLoading(true);
    try {
      if (activeTab === 'reports') {
        await loadReportsData();
      } else {
        await loadExpressData();
      }
    } catch (error: any) {
      console.error("Error loading data:", error);
      showError(error.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadReportsData = async () => {
    console.log("Loading reports data");
    try {
      const [
        currencyRes,
        winsLossesRes,
        successStrugglesRes,
        reflectionStatsRes,
        journalCountRes,
        gainsLossesRes,
        behaviorCountsRes,
        goalProgressRes,
      ] = await Promise.all([
        authenticatedGet('/api/reports/currency-balances'),
        authenticatedGet('/api/reports/wins-vs-losses'),
        authenticatedGet('/api/reports/success-vs-struggles'),
        authenticatedGet('/api/reports/reflection-stats'),
        authenticatedGet('/api/reports/journal-count'),
        authenticatedGet('/api/reports/gains-losses-summary'),
        authenticatedGet('/api/reports/behavior-counts'),
        authenticatedGet('/api/reports/goal-progress'),
      ]);

      const currencyData = Array.isArray(currencyRes) ? currencyRes : (currencyRes?.data || []);
      const winsLossesData = winsLossesRes?.data || winsLossesRes || null;
      const successStrugglesData = successStrugglesRes?.data || successStrugglesRes || null;
      const reflectionStatsData = reflectionStatsRes?.data || reflectionStatsRes || null;
      const journalCountData = journalCountRes?.data || journalCountRes || null;
      const gainsLossesData = gainsLossesRes?.data || gainsLossesRes || null;
      const behaviorCountsData = behaviorCountsRes?.data || behaviorCountsRes || null;
      const goalProgressData = Array.isArray(goalProgressRes) ? goalProgressRes : (goalProgressRes?.data || []);

      setCurrencyBalances(currencyData);
      setWinsVsLosses(winsLossesData);
      setSuccessVsStruggles(successStrugglesData);
      setReflectionStats(reflectionStatsData);
      setJournalCount(journalCountData);
      setGainsLossesSummary(gainsLossesData);
      setBehaviorCounts(behaviorCountsData);
      setGoalProgress(goalProgressData);

      console.log("Reports data loaded successfully");
    } catch (error) {
      console.error("Error loading reports data:", error);
      throw error;
    }
  };

  const loadExpressData = async () => {
    console.log("Loading express data (activated goals)");
    try {
      const goalsRes = await authenticatedGet('/api/goals/activated-today');
      const goalsData = Array.isArray(goalsRes) ? goalsRes : (goalsRes?.data || []);
      
      setActivatedGoals(goalsData);
      
      const categorized = goalsData.reduce((acc: Record<string, ActivatedGoal[]>, goal: ActivatedGoal) => {
        const category = goal.lifeArea?.name || 'Uncategorized';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(goal);
        return acc;
      }, {});
      
      setCategorizedGoals(categorized);
      console.log("Express data loaded successfully");
    } catch (error) {
      console.error("Error loading express data:", error);
      throw error;
    }
  };

  const handleGoalSuccess = async (goalId: string) => {
    console.log("Recording success for goal:", goalId);
    try {
      const timestamp = new Date().toISOString();
      await authenticatedPost(`/api/goals/${goalId}/success`, { timestamp });
      showSuccess("Success recorded!");
      await loadExpressData();
    } catch (error: any) {
      console.error("Error recording success:", error);
      showError(error.message || "Failed to record success");
    }
  };

  const handleGoalStruggle = async (goalId: string) => {
    console.log("Recording struggle for goal:", goalId);
    try {
      const timestamp = new Date().toISOString();
      await authenticatedPost(`/api/goals/${goalId}/struggle`, { timestamp });
      showSuccess("Struggle recorded!");
      await loadExpressData();
    } catch (error: any) {
      console.error("Error recording struggle:", error);
      showError(error.message || "Failed to record struggle");
    }
  };

  const handleReflection = (goalId?: string) => {
    console.log("Opening reflection screen", goalId ? `for goal: ${goalId}` : "");
    router.push({
      pathname: '/reflect',
      params: goalId ? { goalId } : {},
    });
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const tabLabel = activeTab === 'reports' ? 'Reports' : 'Express';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cheshbon</Text>
        <Text style={styles.headerSubtitle}>Your personal growth companion</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.tabActive]}
          onPress={() => {
            console.log("Switching to reports tab");
            setActiveTab('reports');
          }}
        >
          <IconSymbol
            ios_icon_name="chart.bar.fill"
            android_material_icon_name="assessment"
            size={20}
            color={activeTab === 'reports' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>
            Reports
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'express' && styles.tabActive]}
          onPress={() => {
            console.log("Switching to express tab");
            setActiveTab('express');
          }}
        >
          <IconSymbol
            ios_icon_name="bolt.fill"
            android_material_icon_name="flash-on"
            size={20}
            color={activeTab === 'express' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'express' && styles.tabTextActive]}>
            Express
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeTab === 'reports' ? (
          <>
            {currencyBalances.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Currencies Owing</Text>
                {currencyBalances.map((balance, index) => {
                  const symbolText = balance.symbol || '';
                  const netBalanceText = `${balance.netBalance}`;
                  const netBalanceColor = balance.netBalance >= 0 ? colors.success : colors.error;
                  
                  return (
                    <TouchableOpacity 
                      key={index} 
                      style={styles.reportCard}
                      onPress={() => {
                        console.log("Navigating to reflections for currency:", balance.currencyId);
                        router.push('/reflect');
                      }}
                    >
                      <View style={styles.reportHeader}>
                        <Text style={styles.reportTitle}>{balance.currencyName}</Text>
                        {symbolText && <Text style={styles.reportSymbol}>{symbolText}</Text>}
                      </View>
                      <View style={styles.reportRow}>
                        <Text style={styles.reportLabel}>Net Balance:</Text>
                        <Text style={[styles.reportValue, { color: netBalanceColor }]}>
                          {netBalanceText}
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
                    router.push('/reflect');
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
                    router.push('/reflect');
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
                    router.push('/reflect');
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
                    router.push('/reflect');
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
                    router.push('/reflect');
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
                  const progressText = `${goal.progress}%`;
                  const successText = `${goal.successCount} successes`;
                  const struggleText = `${goal.struggleCount} struggles`;
                  
                  return (
                    <TouchableOpacity 
                      key={index} 
                      style={styles.reportCard}
                      onPress={() => {
                        console.log("Navigating to reflections for goal:", goal.goalId);
                        router.push({
                          pathname: '/reflect',
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
          </>
        ) : (
          <>
            {Object.keys(categorizedGoals).length === 0 ? (
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
              Object.entries(categorizedGoals).map(([category, goals], catIndex) => (
                <View key={catIndex} style={styles.categorySection}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  {goals.map((goal, goalIndex) => {
                    const typeText = goal.type === 'RESTRAINING' ? 'Restraining' : 'Proactive';
                    const typeColor = goal.type === 'RESTRAINING' ? colors.warning : colors.success;
                    const successText = `✓ ${goal.todaySuccessCount}`;
                    const struggleText = `✗ ${goal.todayStruggleCount}`;
                    
                    return (
                      <View key={goalIndex} style={styles.goalCard}>
                        <View style={styles.goalHeader}>
                          <Text style={styles.goalCardTitle}>{goal.title}</Text>
                          <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
                            <Text style={styles.typeBadgeText}>{typeText}</Text>
                          </View>
                        </View>
                        
                        {goal.description && (
                          <Text style={styles.goalDescription}>{goal.description}</Text>
                        )}
                        
                        <View style={styles.tallyRow}>
                          <View style={styles.tallyItem}>
                            <Text style={[styles.tallyText, { color: colors.success }]}>
                              {successText}
                            </Text>
                          </View>
                          <View style={styles.tallyItem}>
                            <Text style={[styles.tallyText, { color: colors.error }]}>
                              {struggleText}
                            </Text>
                          </View>
                        </View>
                        
                        <View style={styles.actionButtons}>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.successButton]}
                            onPress={() => handleGoalSuccess(goal.id)}
                          >
                            <IconSymbol
                              ios_icon_name="checkmark"
                              android_material_icon_name="check"
                              size={20}
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
                              size={20}
                              color="#FFFFFF"
                            />
                            <Text style={styles.actionButtonText}>Struggle</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={[styles.actionButton, styles.reflectionButton]}
                            onPress={() => handleReflection(goal.id)}
                          >
                            <IconSymbol
                              ios_icon_name="pencil"
                              android_material_icon_name="edit-note"
                              size={20}
                              color="#FFFFFF"
                            />
                            <Text style={styles.actionButtonText}>Reflect</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </>
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
        visible={successModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModal}>
            <Text style={styles.alertTitle}>Success</Text>
            <Text style={styles.alertMessage}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => setSuccessModalVisible(false)}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
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
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  goalCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  goalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  tallyRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  tallyItem: {
    flex: 1,
  },
  tallyText: {
    fontSize: 18,
    fontWeight: 'bold',
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
    paddingVertical: 10,
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
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
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
});
