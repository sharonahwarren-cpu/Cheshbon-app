
import { supabase } from '@/lib/supabase';
import { PostgrestError } from '@supabase/supabase-js';

/**
 * Supabase API Helper Functions
 * All data operations now use Supabase client directly instead of REST API
 */

// Helper to get current user ID
export const getCurrentUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.id;
};

// Helper to handle Supabase errors
const handleError = (error: PostgrestError | null, operation: string) => {
  if (error) {
    console.error(`[Supabase API] Error in ${operation}:`, error);
    throw new Error(error.message);
  }
};

// ============================================================================
// USER PREFERENCES
// ============================================================================

export const getUserPreferences = async () => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    handleError(error, 'getUserPreferences');
  }
  
  return data || {
    notificationsEnabled: true,
    notificationAlarms: [],
    reflectionCategoriesEnabled: false,
    reflectionCategories: [],
    preferredHomeScreen: 'goals-detailed',
  };
};

export const updateUserPreferences = async (preferences: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      ...preferences,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  handleError(error, 'updateUserPreferences');
  return data;
};

// ============================================================================
// LIFE AREAS
// ============================================================================

export const getLifeAreas = async () => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('life_areas')
    .select('*')
    .eq('user_id', userId)
    .order('display_order', { ascending: true });
  
  handleError(error, 'getLifeAreas');
  return data || [];
};

export const createLifeArea = async (lifeArea: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('life_areas')
    .insert({
      user_id: userId,
      ...lifeArea,
    })
    .select()
    .single();
  
  handleError(error, 'createLifeArea');
  return data;
};

export const updateLifeArea = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('life_areas')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  
  handleError(error, 'updateLifeArea');
  return data;
};

export const deleteLifeArea = async (id: string) => {
  const userId = await getCurrentUserId();
  
  const { error } = await supabase
    .from('life_areas')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  
  handleError(error, 'deleteLifeArea');
  return { success: true };
};

export const reorderLifeAreas = async (reorderedAreas: Array<{ id: string; displayOrder: number; parentId?: string | null }>) => {
  const userId = await getCurrentUserId();
  
  // Update each area's display order
  const updates = reorderedAreas.map(area => ({
    id: area.id,
    user_id: userId,
    display_order: area.displayOrder,
    parent_id: area.parentId,
    updated_at: new Date().toISOString(),
  }));
  
  const { data, error } = await supabase
    .from('life_areas')
    .upsert(updates)
    .select();
  
  handleError(error, 'reorderLifeAreas');
  return data;
};

// ============================================================================
// CURRENCIES
// ============================================================================

export const getCurrencies = async () => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('currencies')
    .select('*')
    .eq('user_id', userId);
  
  handleError(error, 'getCurrencies');
  return data || [];
};

export const createCurrency = async (currency: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('currencies')
    .insert({
      user_id: userId,
      ...currency,
    })
    .select()
    .single();
  
  handleError(error, 'createCurrency');
  return data;
};

export const updateCurrency = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('currencies')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  
  handleError(error, 'updateCurrency');
  return data;
};

export const deleteCurrency = async (id: string) => {
  const userId = await getCurrentUserId();
  
  const { error } = await supabase
    .from('currencies')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  
  handleError(error, 'deleteCurrency');
  return { success: true };
};

export const getCurrencyBalances = async () => {
  const userId = await getCurrentUserId();
  
  // Get all currency transactions
  const { data: transactions, error } = await supabase
    .from('currency_transactions')
    .select(`
      *,
      currency:currencies(id, name, symbol),
      goal:goals(id, title)
    `)
    .eq('user_id', userId);
  
  handleError(error, 'getCurrencyBalances');
  
  // Calculate balances
  const balances: any = {};
  
  transactions?.forEach((transaction: any) => {
    const currencyId = transaction.currency_id;
    
    if (!balances[currencyId]) {
      balances[currencyId] = {
        currencyId,
        currencyName: transaction.currency?.name || 'Unknown',
        symbol: transaction.currency?.symbol || '',
        totalBalance: 0,
        goalBreakdown: {},
      };
    }
    
    const amount = transaction.operation === 'add' ? transaction.amount : -transaction.amount;
    balances[currencyId].totalBalance += amount;
    
    if (transaction.goal_id) {
      if (!balances[currencyId].goalBreakdown[transaction.goal_id]) {
        balances[currencyId].goalBreakdown[transaction.goal_id] = {
          goalId: transaction.goal_id,
          goalTitle: transaction.goal?.title || 'Unknown',
          balance: 0,
        };
      }
      balances[currencyId].goalBreakdown[transaction.goal_id].balance += amount;
    }
  });
  
  return Object.values(balances).map((balance: any) => ({
    ...balance,
    goalBreakdown: Object.values(balance.goalBreakdown),
  }));
};

export const createCurrencyTransaction = async (transaction: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('currency_transactions')
    .insert({
      user_id: userId,
      ...transaction,
    })
    .select()
    .single();
  
  handleError(error, 'createCurrencyTransaction');
  return data;
};

export const getCurrencyTransactions = async (currencyId: string) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('currency_transactions')
    .select(`
      *,
      goal:goals(title)
    `)
    .eq('user_id', userId)
    .eq('currency_id', currencyId)
    .order('created_at', { ascending: false });
  
  handleError(error, 'getCurrencyTransactions');
  return data || [];
};

// ============================================================================
// GOALS
// ============================================================================

export const getGoals = async () => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('goals')
    .select(`
      *,
      life_area:life_areas(id, name, parent_id, icon, color)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  handleError(error, 'getGoals');
  return data || [];
};

export const getGoalById = async (id: string) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('goals')
    .select(`
      *,
      life_area:life_areas(id, name, parent_id, icon, color)
    `)
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  
  handleError(error, 'getGoalById');
  return data;
};

export const createGoal = async (goal: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      ...goal,
    })
    .select()
    .single();
  
  handleError(error, 'createGoal');
  return data;
};

export const updateGoal = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('goals')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  
  handleError(error, 'updateGoal');
  return data;
};

export const deleteGoal = async (id: string) => {
  const userId = await getCurrentUserId();
  
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  
  handleError(error, 'deleteGoal');
  return { success: true };
};

export const getGoalsWithDailyEntries = async (date: string) => {
  const userId = await getCurrentUserId();
  
  // Get all active goals
  const { data: goals, error: goalsError } = await supabase
    .from('goals')
    .select(`
      *,
      life_area:life_areas(id, name, parent_id, icon, color)
    `)
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');
  
  handleError(goalsError, 'getGoalsWithDailyEntries');
  
  // Get daily entries for the specified date
  const { data: entries, error: entriesError } = await supabase
    .from('daily_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_date', date);
  
  handleError(entriesError, 'getGoalsWithDailyEntries - entries');
  
  // Combine goals with their daily entries
  const goalsWithEntries = goals?.map(goal => {
    const goalEntries = entries?.filter(entry => entry.goal_id === goal.id) || [];
    const todaySuccessCount = goalEntries.filter(e => e.type === 'success').length;
    const todayStruggleCount = goalEntries.filter(e => e.type === 'struggle').length;
    
    return {
      ...goal,
      dailyEntries: goalEntries,
      todaySuccessCount,
      todayStruggleCount,
    };
  });
  
  return goalsWithEntries || [];
};

// ============================================================================
// DAILY ENTRIES
// ============================================================================

export const createDailyEntry = async (entry: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('daily_entries')
    .insert({
      user_id: userId,
      ...entry,
    })
    .select()
    .single();
  
  handleError(error, 'createDailyEntry');
  
  // Update goal success/struggle count
  if (data) {
    const { data: goal } = await supabase
      .from('goals')
      .select('success_count, struggle_count')
      .eq('id', entry.goal_id)
      .single();
    
    if (goal) {
      const updates: any = {};
      if (entry.type === 'success') {
        updates.success_count = (goal.success_count || 0) + 1;
      } else {
        updates.struggle_count = (goal.struggle_count || 0) + 1;
      }
      
      await supabase
        .from('goals')
        .update(updates)
        .eq('id', entry.goal_id);
    }
  }
  
  return data;
};

export const deleteDailyEntry = async (id: string) => {
  const userId = await getCurrentUserId();
  
  // Get the entry first to update goal counts
  const { data: entry } = await supabase
    .from('daily_entries')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  
  const { error } = await supabase
    .from('daily_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  
  handleError(error, 'deleteDailyEntry');
  
  // Update goal success/struggle count
  if (entry) {
    const { data: goal } = await supabase
      .from('goals')
      .select('success_count, struggle_count')
      .eq('id', entry.goal_id)
      .single();
    
    if (goal) {
      const updates: any = {};
      if (entry.type === 'success') {
        updates.success_count = Math.max(0, (goal.success_count || 0) - 1);
      } else {
        updates.struggle_count = Math.max(0, (goal.struggle_count || 0) - 1);
      }
      
      await supabase
        .from('goals')
        .update(updates)
        .eq('id', entry.goal_id);
    }
  }
  
  return { success: true };
};

// ============================================================================
// STRATEGIES
// ============================================================================

export const getStrategies = async () => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .eq('user_id', userId);
  
  handleError(error, 'getStrategies');
  return data || [];
};

export const createStrategy = async (strategy: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('strategies')
    .insert({
      user_id: userId,
      ...strategy,
    })
    .select()
    .single();
  
  handleError(error, 'createStrategy');
  return data;
};

export const updateStrategy = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('strategies')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  
  handleError(error, 'updateStrategy');
  return data;
};

export const deleteStrategy = async (id: string) => {
  const userId = await getCurrentUserId();
  
  const { error } = await supabase
    .from('strategies')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  
  handleError(error, 'deleteStrategy');
  return { success: true };
};

// ============================================================================
// GAINS & LOSSES
// ============================================================================

export const getGainsLosses = async () => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('gains_losses')
    .select('*')
    .eq('user_id', userId);
  
  handleError(error, 'getGainsLosses');
  return data || [];
};

export const createGainLoss = async (gainLoss: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('gains_losses')
    .insert({
      user_id: userId,
      ...gainLoss,
    })
    .select()
    .single();
  
  handleError(error, 'createGainLoss');
  return data;
};

export const updateGainLoss = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('gains_losses')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  
  handleError(error, 'updateGainLoss');
  return data;
};

export const deleteGainLoss = async (id: string) => {
  const userId = await getCurrentUserId();
  
  const { error } = await supabase
    .from('gains_losses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  
  handleError(error, 'deleteGainLoss');
  return { success: true };
};

export const getGainLossCategories = async () => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('gain_loss_categories')
    .select('*')
    .eq('user_id', userId);
  
  handleError(error, 'getGainLossCategories');
  return data || [];
};

export const createGainLossCategory = async (category: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('gain_loss_categories')
    .insert({
      user_id: userId,
      ...category,
    })
    .select()
    .single();
  
  handleError(error, 'createGainLossCategory');
  return data;
};

export const updateGainLossCategory = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('gain_loss_categories')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  
  handleError(error, 'updateGainLossCategory');
  return data;
};

export const deleteGainLossCategory = async (id: string) => {
  const userId = await getCurrentUserId();
  
  const { error } = await supabase
    .from('gain_loss_categories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  
  handleError(error, 'deleteGainLossCategory');
  return { success: true };
};

// ============================================================================
// REFLECTION MOTIVATIONS
// ============================================================================

export const getReflectionMotivations = async () => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('reflection_motivations')
    .select('*')
    .eq('user_id', userId);
  
  handleError(error, 'getReflectionMotivations');
  return data || [];
};

export const createReflectionMotivation = async (motivation: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('reflection_motivations')
    .insert({
      user_id: userId,
      ...motivation,
    })
    .select()
    .single();
  
  handleError(error, 'createReflectionMotivation');
  return data;
};

export const updateReflectionMotivation = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('reflection_motivations')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  
  handleError(error, 'updateReflectionMotivation');
  return data;
};

export const deleteReflectionMotivation = async (id: string) => {
  const userId = await getCurrentUserId();
  
  const { error } = await supabase
    .from('reflection_motivations')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  
  handleError(error, 'deleteReflectionMotivation');
  return { success: true };
};

// ============================================================================
// REFLECTIONS
// ============================================================================

export const getReflections = async (date?: string) => {
  const userId = await getCurrentUserId();
  
  let query = supabase
    .from('reflections')
    .select(`
      *,
      goal:goals(id, title)
    `)
    .eq('user_id', userId);
  
  if (date) {
    query = query.eq('entry_date', date);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  handleError(error, 'getReflections');
  return data || [];
};

export const createReflection = async (reflection: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('reflections')
    .insert({
      user_id: userId,
      ...reflection,
    })
    .select()
    .single();
  
  handleError(error, 'createReflection');
  return data;
};

export const updateReflection = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('reflections')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  
  handleError(error, 'updateReflection');
  return data;
};

export const deleteReflection = async (id: string) => {
  const userId = await getCurrentUserId();
  
  const { error } = await supabase
    .from('reflections')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  
  handleError(error, 'deleteReflection');
  return { success: true };
};

// ============================================================================
// JOURNALS
// ============================================================================

export const getJournals = async (date?: string) => {
  const userId = await getCurrentUserId();
  
  let query = supabase
    .from('journals')
    .select('*')
    .eq('user_id', userId);
  
  if (date) {
    query = query.eq('entry_date', date);
  }
  
  const { data, error } = await query.order('entry_date', { ascending: false });
  
  handleError(error, 'getJournals');
  return data || [];
};

export const createJournal = async (journal: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('journals')
    .insert({
      user_id: userId,
      ...journal,
    })
    .select()
    .single();
  
  handleError(error, 'createJournal');
  return data;
};

export const updateJournal = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('journals')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  
  handleError(error, 'updateJournal');
  return data;
};

export const deleteJournal = async (id: string) => {
  const userId = await getCurrentUserId();
  
  const { error } = await supabase
    .from('journals')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  
  handleError(error, 'deleteJournal');
  return { success: true };
};

// ============================================================================
// ALARMS
// ============================================================================

export const getAlarms = async () => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('alarms')
    .select(`
      *,
      goal:goals(id, title)
    `)
    .eq('user_id', userId);
  
  handleError(error, 'getAlarms');
  return data || [];
};

export const createAlarm = async (alarm: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('alarms')
    .insert({
      user_id: userId,
      ...alarm,
    })
    .select()
    .single();
  
  handleError(error, 'createAlarm');
  return data;
};

export const updateAlarm = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('alarms')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  
  handleError(error, 'updateAlarm');
  return data;
};

export const deleteAlarm = async (id: string) => {
  const userId = await getCurrentUserId();
  
  const { error } = await supabase
    .from('alarms')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  
  handleError(error, 'deleteAlarm');
  return { success: true };
};

// ============================================================================
// REPORTS & ANALYTICS
// ============================================================================

export const getReportsData = async (timeFilter: string = 'all') => {
  const userId = await getCurrentUserId();
  
  // Calculate date range based on filter
  let startDate: string | null = null;
  if (timeFilter !== 'all') {
    const now = new Date();
    if (timeFilter === 'week') {
      now.setDate(now.getDate() - 7);
    } else if (timeFilter === 'month') {
      now.setMonth(now.getMonth() - 1);
    } else if (timeFilter === 'year') {
      now.setFullYear(now.getFullYear() - 1);
    }
    startDate = now.toISOString().split('T')[0];
  }
  
  // Get reflections
  let reflectionsQuery = supabase
    .from('reflections')
    .select('*')
    .eq('user_id', userId);
  
  if (startDate) {
    reflectionsQuery = reflectionsQuery.gte('entry_date', startDate);
  }
  
  const { data: reflections, error: reflectionsError } = await reflectionsQuery;
  handleError(reflectionsError, 'getReportsData - reflections');
  
  // Get goals with their entries
  const { data: goals, error: goalsError } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId);
  
  handleError(goalsError, 'getReportsData - goals');
  
  // Get journals count
  let journalsQuery = supabase
    .from('journals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  
  if (startDate) {
    journalsQuery = journalsQuery.gte('entry_date', startDate);
  }
  
  const { count: journalCount, error: journalsError } = await journalsQuery;
  handleError(journalsError, 'getReportsData - journals');
  
  // Calculate stats
  const totalReflections = reflections?.length || 0;
  const totalRestraints = reflections?.filter(r => r.type === 'Restraint').length || 0;
  const totalProactive = reflections?.filter(r => r.type === 'Proactive').length || 0;
  const wins = reflections?.filter(r => r.outcome === 'success').length || 0;
  const losses = reflections?.filter(r => r.outcome === 'struggled').length || 0;
  const worthIt = reflections?.filter(r => r.was_worth_it === true).length || 0;
  
  return {
    reflectionStats: {
      totalReflections,
      totalRestraints,
      totalProactive,
      worthItPercentage: totalReflections > 0 ? (worthIt / totalReflections) * 100 : 0,
    },
    winsVsLosses: {
      wins,
      losses,
      totalReflections,
    },
    journalCount: {
      count: journalCount || 0,
    },
    goalProgress: goals?.map(goal => ({
      goalId: goal.id,
      goalTitle: goal.title,
      successCount: goal.success_count || 0,
      struggleCount: goal.struggle_count || 0,
      progress: goal.success_count && goal.struggle_count 
        ? (goal.success_count / (goal.success_count + goal.struggle_count)) * 100 
        : 0,
      currentStreak: goal.current_streak || 0,
      bestStreak: goal.best_streak || 0,
    })) || [],
  };
};

// ============================================================================
// DATA MANAGEMENT
// ============================================================================

export const deleteAllUserData = async () => {
  const userId = await getCurrentUserId();
  
  // Delete in order to respect foreign key constraints
  await supabase.from('daily_entries').delete().eq('user_id', userId);
  await supabase.from('currency_transactions').delete().eq('user_id', userId);
  await supabase.from('reflections').delete().eq('user_id', userId);
  await supabase.from('journals').delete().eq('user_id', userId);
  await supabase.from('alarms').delete().eq('user_id', userId);
  await supabase.from('goals').delete().eq('user_id', userId);
  await supabase.from('strategies').delete().eq('user_id', userId);
  await supabase.from('gains_losses').delete().eq('user_id', userId);
  await supabase.from('gain_loss_categories').delete().eq('user_id', userId);
  await supabase.from('reflection_motivations').delete().eq('user_id', userId);
  await supabase.from('currencies').delete().eq('user_id', userId);
  await supabase.from('life_areas').delete().eq('user_id', userId);
  await supabase.from('user_preferences').delete().eq('user_id', userId);
  
  return { success: true };
};

export const deleteUserAccount = async () => {
  // First delete all user data
  await deleteAllUserData();
  
  // Then delete the auth user
  const { error } = await supabase.auth.admin.deleteUser(
    (await getCurrentUserId())
  );
  
  if (error) {
    // If admin delete fails, try regular sign out
    await supabase.auth.signOut();
  }
  
  return { success: true };
};

export const exportUserData = async (format: 'json' | 'csv' | 'pdf', dataType: string, startDate?: string, endDate?: string) => {
  const userId = await getCurrentUserId();
  
  // This is a placeholder - actual export logic would need to be implemented
  // based on the specific requirements of each data type and format
  console.log('Export user data:', { format, dataType, startDate, endDate });
  
  // For now, return a simple message
  throw new Error('Data export functionality needs to be implemented with Supabase Edge Functions');
};
