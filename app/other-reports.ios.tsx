
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import React, { useState, useEffect, useCallback } from "react";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ReflectionListModal } from "@/components/ReflectionListModal";
import { supabase } from "@/lib/supabase";

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

type TimeFilter = 'week' | 'month' | '6months' | 'year' | 'all';

export default function OtherReportsScreen() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [winsVsLosses, setWinsVsLosses] = useState<WinsVsLosses | null>(null);
  const [successVsStruggles, setSuccessVsStruggles] = useState<SuccessVsStruggles | null>(null);
  const [reflectionStats, setReflectionStats] = useState<ReflectionStats | null>(null);
  const [journalCount, setJournalCount] = useState<JournalCount | null>(null);
  const [gainsLossesSummary, setGainsLossesSummary] = useState<GainsLossesSummary | null>(null);
  const [gainsLossesDistribution, setGainsLossesDistribution] = useState<GainsLossesDistribution | null>(null);
  const [behaviorCounts, setBehaviorCounts] = useState<BehaviorCounts | null>(null);
  const [topMotivationsByType, setTopMotivationsByType] = useState<TopMotivationsByType | null>(null);
  const [topMotivationsByOutcome, setTopMotivationsByOutcome] = useState<TopMotivationsByOutcome | null>(null);

  // Reflection list modal state
  const [showReflectionListModal, setShowReflectionListModal] = useState(false);
  const [reflectionListTitle, setReflectionListTitle] = useState('');
  const [reflectionListFilterType, setReflectionListFilterType] = useState<'wins' | 'losses' | 'successes' | 'struggles' | 'all' | 'behavior' | 'goal' | 'gainslosses'>('all');
  const [reflectionListFilterValue, setReflectionListFilterValue] = useState<string | undefined>(undefined);

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
      console.log('[Other Reports] Date range for modal:', timeFilter, 'Start:', startDateISO, 'End:', endDateISO);
      return {
        startDate: startDateISO,
        endDate: endDateISO,
      };
    }
    
    return {};
  }, [timeFilter]);

  const loadReportsData = useCallback(async (refreshing: boolean = false) => {
    console.log("Loading other reports data with time filter:", timeFilter, refreshing ? "(refreshing)" : "");
    if (!refreshing) {
      setLoading(true);
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const dateRange = getDateRangeForModal();
      
      console.log('[Other Reports] Fetching data for user:', user.id);
      console.log('[Other Reports] Date range:', dateRange);
      
      // Build date filter for queries
      let startDate = dateRange.startDate;
      let endDate = dateRange.endDate;
      
      // Get reflections with date filter
      let reflectionsQuery = supabase
        .from('reflections')
        .select('*')
        .eq('user_id', user.id);
      
      if (startDate && endDate) {
        reflectionsQuery = reflectionsQuery
          .gte('entry_date', startDate.split('T')[0])
          .lte('entry_date', endDate.split('T')[0]);
      }
      
      const { data: reflections, error: reflectionsError } = await reflectionsQuery;
      
      if (reflectionsError) {
        console.error('[Other Reports] Error fetching reflections:', reflectionsError);
        throw reflectionsError;
      }
      
      console.log('[Other Reports] Fetched', reflections?.length || 0, 'reflections');
      
      // Calculate stats from reflections
      const totalReflections = reflections?.length || 0;
      const successes = reflections?.filter(r => r.outcome === 'success').length || 0;
      const struggles = reflections?.filter(r => r.outcome === 'struggled').length || 0;
      const wins = reflections?.filter(r => r.was_worth_it === true).length || 0;
      const losses = reflections?.filter(r => r.was_worth_it === false).length || 0;
      const totalRestraints = reflections?.filter(r => r.type === 'Restraint').length || 0;
      const totalProactive = reflections?.filter(r => r.type === 'Proactive').length || 0;
      const worthItCount = reflections?.filter(r => r.was_worth_it === true).length || 0;
      const worthItPercentage = totalReflections > 0 ? (worthItCount / totalReflections) * 100 : 0;
      
      // Calculate behavior counts
      const actionEntries = reflections?.filter(r => r.category === 'Action').length || 0;
      const speechEntries = reflections?.filter(r => r.category === 'Speech').length || 0;
      const thoughtEntries = reflections?.filter(r => r.category === 'Thought').length || 0;
      
      // Calculate gains/losses summary
      const gainsMap = new Map<string, { id: string; name: string; count: number }>();
      const lossesMap = new Map<string, { id: string; name: string; count: number }>();
      
      reflections?.forEach(r => {
        r.gained_ids?.forEach((gainId: string) => {
          const existing = gainsMap.get(gainId);
          if (existing) {
            existing.count++;
          } else {
            gainsMap.set(gainId, { id: gainId, name: 'Gain', count: 1 });
          }
        });
        
        r.lost_ids?.forEach((lossId: string) => {
          const existing = lossesMap.get(lossId);
          if (existing) {
            existing.count++;
          } else {
            lossesMap.set(lossId, { id: lossId, name: 'Loss', count: 1 });
          }
        });
      });
      
      const topGains = Array.from(gainsMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
      
      const topLosses = Array.from(lossesMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
      
      // Get journal count
      let journalsQuery = supabase
        .from('journals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      if (startDate && endDate) {
        journalsQuery = journalsQuery
          .gte('entry_date', startDate.split('T')[0])
          .lte('entry_date', endDate.split('T')[0]);
      }
      
      const { count: journalCount } = await journalsQuery;
      
      // Set all the data
      setSuccessVsStruggles({
        successes,
        struggles,
        total: totalReflections,
      });
      
      setWinsVsLosses({
        wins,
        losses,
        totalReflections,
      });
      
      setReflectionStats({
        totalReflections,
        totalRestraints,
        totalProactive,
        worthItPercentage,
      });
      
      setJournalCount({
        count: journalCount || 0,
      });
      
      setGainsLossesSummary({
        totalGains: gainsMap.size,
        totalLosses: lossesMap.size,
        byCategory: [],
        topGains,
        topLosses,
      });
      
      setBehaviorCounts({
        actionEntries,
        speechEntries,
        thoughtEntries,
      });
      
      // Set empty data for features not yet implemented
      setGainsLossesDistribution(null);
      setTopMotivationsByType(null);
      setTopMotivationsByOutcome(null);
      
      console.log('[Other Reports] Data loaded successfully');
    } catch (error: any) {
      console.error("Error loading other reports data:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [timeFilter, getDateRangeForModal]);

  useEffect(() => {
    console.log("OtherReportsScreen mounted or timeFilter changed");
    loadReportsData();
  }, [loadReportsData]);

  const handleRefresh = useCallback(async () => {
    console.log("User initiated pull-to-refresh on Other Reports screen");
    setIsRefreshing(true);
    await loadReportsData(true);
  }, [loadReportsData]);

  const openReflectionListModal = (title: string, filterType: 'wins' | 'losses' | 'successes' | 'struggles' | 'all' | 'behavior' | 'goal' | 'gainslosses', filterValue?: string) => {
    console.log('[Other Reports] Opening reflection list modal:', title, filterType, filterValue);
    setReflectionListTitle(title);
    setReflectionListFilterType(filterType);
    setReflectionListFilterValue(filterValue);
    setShowReflectionListModal(true);
  };

  const handleTimeFilterChange = (filter: TimeFilter) => {
    console.log('[Other Reports] Changing time filter to:', filter);
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
      <Stack.Screen
        options={{
          title: 'Other Reports',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Time Filter at the top */}
        <View style={styles.filterSection}>
          <View style={styles.filterHeader}>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={18}
              color={colors.primary}
            />
            <Text style={styles.filterLabel}>Time Period</Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterButtons}
          >
            <TouchableOpacity
              style={[styles.filterButton, timeFilter === 'week' && styles.filterButtonActive]}
              onPress={() => handleTimeFilterChange('week')}
            >
              <Text style={[styles.filterButtonText, timeFilter === 'week' && styles.filterButtonTextActive]}>
                Week
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, timeFilter === 'month' && styles.filterButtonActive]}
              onPress={() => handleTimeFilterChange('month')}
            >
              <Text style={[styles.filterButtonText, timeFilter === 'month' && styles.filterButtonTextActive]}>
                Month
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, timeFilter === '6months' && styles.filterButtonActive]}
              onPress={() => handleTimeFilterChange('6months')}
            >
              <Text style={[styles.filterButtonText, timeFilter === '6months' && styles.filterButtonTextActive]}>
                6 Months
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, timeFilter === 'year' && styles.filterButtonActive]}
              onPress={() => handleTimeFilterChange('year')}
            >
              <Text style={[styles.filterButtonText, timeFilter === 'year' && styles.filterButtonTextActive]}>
                Year
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, timeFilter === 'all' && styles.filterButtonActive]}
              onPress={() => handleTimeFilterChange('all')}
            >
              <Text style={[styles.filterButtonText, timeFilter === 'all' && styles.filterButtonTextActive]}>
                All Time
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* 1. Success vs Struggles */}
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

        {/* 2. Wins vs Losses - Visual Progress Bar */}
        {winsVsLosses && winsVsLosses.totalReflections > 0 && (
          <>
            <Text style={styles.sectionTitle}>Wins vs Losses</Text>
            <TouchableOpacity 
              style={styles.reportCard}
              onPress={() => openReflectionListModal('Wins vs Losses', 'all')}
            >
              <View style={styles.winsLossesProgressContainer}>
                <View style={styles.winsLossesProgressBar}>
                  <View 
                    style={[
                      styles.winsProgressFill, 
                      { width: `${(winsVsLosses.wins / winsVsLosses.totalReflections) * 100}%` }
                    ]} 
                  />
                  <View 
                    style={[
                      styles.lossesProgressFill, 
                      { width: `${(winsVsLosses.losses / winsVsLosses.totalReflections) * 100}%` }
                    ]} 
                  />
                </View>
              </View>
              <View style={styles.winsLossesLegend}>
                <TouchableOpacity 
                  style={styles.legendItem}
                  onPress={() => openReflectionListModal('Wins', 'wins')}
                >
                  <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                  <Text style={styles.legendLabel}>Wins:</Text>
                  <Text style={[styles.legendValue, { color: colors.success }]}>
                    {winsVsLosses.wins} ({Math.round((winsVsLosses.wins / winsVsLosses.totalReflections) * 100)}%)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.legendItem}
                  onPress={() => openReflectionListModal('Losses', 'losses')}
                >
                  <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
                  <Text style={styles.legendLabel}>Losses:</Text>
                  <Text style={[styles.legendValue, { color: colors.error }]}>
                    {winsVsLosses.losses} ({Math.round((winsVsLosses.losses / winsVsLosses.totalReflections) * 100)}%)
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* 3. Gains and Losses */}
        {gainsLossesSummary && (
          <>
            <Text style={styles.sectionTitle}>Gains and Losses</Text>
            <TouchableOpacity 
              style={styles.reportCard}
              onPress={() => openReflectionListModal('Gains and Losses', 'gainslosses')}
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

        {/* 4. Gains & Losses Distribution */}
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

        {/* 5. Top Motivations by Reflection Type */}
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

        {/* 6. Top Motivations by Goal Outcome */}
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

        {/* 7. Reflection Statistics */}
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

        {/* 8. Behavior Entries */}
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

        {/* 9. Journal Entries */}
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
      </ScrollView>

      {/* Reflection List Modal */}
      <ReflectionListModal
        visible={showReflectionListModal}
        onClose={() => setShowReflectionListModal(false)}
        title={reflectionListTitle}
        filterType={reflectionListFilterType}
        filterValue={reflectionListFilterValue}
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
  winsLossesProgressContainer: {
    marginBottom: 16,
  },
  winsLossesProgressBar: {
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: colors.error,
  },
  winsProgressFill: {
    height: '100%',
    backgroundColor: colors.success,
  },
  lossesProgressFill: {
    height: '100%',
    backgroundColor: colors.error,
  },
  winsLossesLegend: {
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  legendValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});
