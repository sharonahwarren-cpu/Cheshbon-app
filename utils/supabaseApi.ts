
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

// Helper to normalize goal type to uppercase (database expects 'RESTRAINING' or 'PROACTIVE')
const normalizeGoalType = (type: string | undefined): string | undefined => {
  if (!type) return undefined;
  const upperType = type.toUpperCase();
  if (upperType === 'RESTRAINING' || upperType === 'PROACTIVE') {
    return upperType;
  }
  // Default to PROACTIVE if invalid
  console.warn(`[Supabase API] Invalid goal type "${type}", defaulting to PROACTIVE`);
  return 'PROACTIVE';
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
    notifications_enabled: true,
    notification_alarms: [],
    reflection_categories_enabled: false,
    reflection_categories: [],
    preferred_home_screen: 'goals-detailed',
  };
};

export const updateUserPreferences = async (preferences: any) => {
  const userId = await getCurrentUserId();
  
  // CRITICAL FIX: Only send snake_case fields to Supabase
  // Build the update object with ONLY valid database columns
  const dbPreferences: any = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  
  // Map both camelCase and snake_case inputs to snake_case output
  if (preferences.notifications_enabled !== undefined) {
    dbPreferences.notifications_enabled = preferences.notifications_enabled;
  }
  if (preferences.notificationsEnabled !== undefined) {
    dbPreferences.notifications_enabled = preferences.notificationsEnabled;
  }
  
  if (preferences.notification_alarms !== undefined) {
    dbPreferences.notification_alarms = preferences.notification_alarms;
  }
  if (preferences.notificationAlarms !== undefined) {
    dbPreferences.notification_alarms = preferences.notificationAlarms;
  }
  
  if (preferences.reflection_categories_enabled !== undefined) {
    dbPreferences.reflection_categories_enabled = preferences.reflection_categories_enabled;
  }
  if (preferences.reflectionCategoriesEnabled !== undefined) {
    dbPreferences.reflection_categories_enabled = preferences.reflectionCategoriesEnabled;
  }
  
  if (preferences.reflection_categories !== undefined) {
    dbPreferences.reflection_categories = preferences.reflection_categories;
  }
  if (preferences.reflectionCategories !== undefined) {
    dbPreferences.reflection_categories = preferences.reflectionCategories;
  }
  
  if (preferences.preferred_home_screen !== undefined) {
    dbPreferences.preferred_home_screen = preferences.preferred_home_screen;
  }
  if (preferences.preferredHomeScreen !== undefined) {
    dbPreferences.preferred_home_screen = preferences.preferredHomeScreen;
  }
  
  if (preferences.alternative_calendar !== undefined) {
    dbPreferences.alternative_calendar = preferences.alternative_calendar;
  }
  if (preferences.alternativeCalendar !== undefined) {
    dbPreferences.alternative_calendar = preferences.alternativeCalendar;
  }
  
  console.log('[Supabase API] Updating user preferences with:', dbPreferences);
  
  // CRITICAL FIX: Use upsert with onConflict to handle duplicate key constraint
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(dbPreferences, { 
      onConflict: 'user_id',  // Specify the unique constraint column
      ignoreDuplicates: false  // Update existing row instead of ignoring
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
  
  // CRITICAL FIX: Map camelCase to snake_case for currency fields
  const currencyData: any = {
    user_id: userId,
    name: currency.name,
    symbol: currency.symbol || null,
    type: currency.type || 'consequence',
    on_success: currency.on_success || currency.onSuccess || 'NONE',
    on_failure: currency.on_failure || currency.onFailure || 'NONE',
  };
  
  console.log('[Supabase API] Creating currency with data:', currencyData);
  
  const { data, error } = await supabase
    .from('currencies')
    .insert(currencyData)
    .select()
    .single();
  
  handleError(error, 'createCurrency');
  return data;
};

export const updateCurrency = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  // CRITICAL FIX: Map camelCase to snake_case for currency fields
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };
  
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.symbol !== undefined) updateData.symbol = updates.symbol;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.on_success !== undefined || updates.onSuccess !== undefined) {
    updateData.on_success = updates.on_success || updates.onSuccess;
  }
  if (updates.on_failure !== undefined || updates.onFailure !== undefined) {
    updateData.on_failure = updates.on_failure || updates.onFailure;
  }
  
  console.log('[Supabase API] Updating currency with data:', updateData);
  
  const { data, error } = await supabase
    .from('currencies')
    .update(updateData)
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
  
  // PERFORMANCE FIX: Select only needed columns instead of *
  // Get all currency transactions with related data in a single query
  const { data: transactions, error } = await supabase
    .from('currency_transactions')
    .select(`
      currency_id,
      goal_id,
      amount,
      operation,
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
  
  // PERFORMANCE FIX: Select only needed columns instead of *
  const { data, error } = await supabase
    .from('goals')
    .select(`
      id,
      title,
      description,
      type,
      status,
      behavior_categories,
      tracking_type,
      success_count,
      struggle_count,
      current_streak,
      best_streak,
      reward_currency_id,
      reward_amount,
      reward_successes,
      consequence_currency_id,
      consequence_amount,
      consequence_failures,
      schedule_config,
      created_at,
      updated_at,
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
  
  // CRITICAL FIX: Normalize type to uppercase (database expects 'RESTRAINING' or 'PROACTIVE')
  const normalizedType = normalizeGoalType(goal.type);
  
  // Map frontend field names to Supabase snake_case column names
  const goalData: any = {
    user_id: userId,
    title: goal.title,
    description: goal.description,
    type: normalizedType,
    status: goal.status || 'ACTIVE',
    life_area_id: goal.lifeAreaId || goal.life_area_id || null,
    behavior_categories: goal.behaviorCategories || goal.behavior_categories || [],
    tracking_type: goal.tracking_type || 'tally', // NEW: Add tracking_type field
    reward_currency_id: goal.reward_currency_id || null,
    reward_amount: goal.reward_amount || 0,
    reward_successes: goal.reward_successes || 0,
    consequence_currency_id: goal.consequence_currency_id || null,
    consequence_amount: goal.consequence_amount || 0,
    consequence_failures: goal.consequence_failures || 0,
    success_count: goal.success_count || 0,
    struggle_count: goal.struggle_count || 0,
    current_streak: goal.current_streak || 0,
    best_streak: goal.best_streak || 0,
    schedule_config: goal.schedule_config || goal.scheduleConfig || null,
  };
  
  console.log('[Supabase API] Creating goal with data:', JSON.stringify(goalData, null, 2));
  
  const { data, error } = await supabase
    .from('goals')
    .insert(goalData)
    .select()
    .single();
  
  if (error) {
    console.error('[Supabase API] Error in createGoal:', error);
    throw new Error(error.message);
  }
  
  return data;
};

export const updateGoal = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  // Map frontend field names to Supabase snake_case column names
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };
  
  // Only include fields that are actually being updated
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.type !== undefined) updateData.type = normalizeGoalType(updates.type);
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.lifeAreaId !== undefined || updates.life_area_id !== undefined) {
    updateData.life_area_id = updates.life_area_id || updates.lifeAreaId || null;
  }
  if (updates.behaviorCategories !== undefined || updates.behavior_categories !== undefined) {
    updateData.behavior_categories = updates.behavior_categories || updates.behaviorCategories || [];
  }
  // NEW: Add tracking_type field handling
  if (updates.tracking_type !== undefined) updateData.tracking_type = updates.tracking_type;
  if (updates.reward_currency_id !== undefined) updateData.reward_currency_id = updates.reward_currency_id;
  if (updates.reward_amount !== undefined) updateData.reward_amount = updates.reward_amount;
  if (updates.reward_successes !== undefined) updateData.reward_successes = updates.reward_successes;
  if (updates.consequence_currency_id !== undefined) updateData.consequence_currency_id = updates.consequence_currency_id;
  if (updates.consequence_amount !== undefined) updateData.consequence_amount = updates.consequence_amount;
  if (updates.consequence_failures !== undefined) updateData.consequence_failures = updates.consequence_failures;
  if (updates.success_count !== undefined) updateData.success_count = updates.success_count;
  if (updates.struggle_count !== undefined) updateData.struggle_count = updates.struggle_count;
  if (updates.current_streak !== undefined) updateData.current_streak = updates.current_streak;
  if (updates.best_streak !== undefined) updateData.best_streak = updates.best_streak;
  if (updates.schedule_config !== undefined || updates.scheduleConfig !== undefined) {
    updateData.schedule_config = updates.schedule_config || updates.scheduleConfig || null;
  }
  
  console.log('[Supabase API] Updating goal with data:', JSON.stringify(updateData, null, 2));
  
  const { data, error } = await supabase
    .from('goals')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  
  if (error) {
    console.error('[Supabase API] Error in updateGoal:', error);
    throw new Error(error.message);
  }
  
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
  
  // PERFORMANCE FIX: Select only needed columns instead of *
  // Get all active goals with life area info in a single query
  const { data: goals, error: goalsError } = await supabase
    .from('goals')
    .select(`
      id,
      title,
      description,
      type,
      status,
      behavior_categories,
      tracking_type,
      success_count,
      struggle_count,
      current_streak,
      best_streak,
      reward_currency_id,
      reward_amount,
      reward_successes,
      consequence_currency_id,
      consequence_amount,
      consequence_failures,
      schedule_config,
      created_at,
      updated_at,
      life_area:life_areas(id, name, parent_id, icon, color)
    `)
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');
  
  handleError(goalsError, 'getGoalsWithDailyEntries');
  
  // PERFORMANCE FIX: Select only needed columns for reflections
  // Get reflections for the specified date in a single query
  const { data: reflections, error: reflectionsError } = await supabase
    .from('reflections')
    .select('id, linked_goal_id, outcome, created_at')
    .eq('user_id', userId)
    .eq('entry_date', date);
  
  handleError(reflectionsError, 'getGoalsWithDailyEntries - reflections');
  
  console.log('[Supabase API] getGoalsWithDailyEntries - Found', reflections?.length || 0, 'reflections for date:', date);
  
  // Combine goals with their reflection counts and map snake_case to camelCase
  const goalsWithEntries = goals?.map(goal => {
    // Count reflections for this goal on this date
    const goalReflections = reflections?.filter(r => r.linked_goal_id === goal.id) || [];
    const todaySuccessCount = goalReflections.filter(r => r.outcome === 'success').length;
    const todayStruggleCount = goalReflections.filter(r => r.outcome === 'struggled').length;
    
    console.log('[Supabase API] Goal:', goal.title, 'todaySuccesses:', todaySuccessCount, 'todayStruggles:', todayStruggleCount);
    
    // Build dailyEntries array from reflections (for compatibility with existing code)
    const dailyEntries = goalReflections.map(r => ({
      id: r.id,
      type: r.outcome === 'success' ? 'success' as const : 'struggle' as const,
      timestamp: r.created_at,
    }));
    
    // CRITICAL FIX: Map snake_case database fields to camelCase for frontend
    return {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      type: goal.type,
      status: goal.status,
      lifeArea: goal.life_area,
      behaviorCategories: goal.behavior_categories || [],
      trackingType: goal.tracking_type || 'tally',
      // CUMULATIVE COUNTS from database (these are the total counts, not today's counts)
      successCount: goal.success_count || 0,
      struggleCount: goal.struggle_count || 0,
      currentStreak: goal.current_streak || 0,
      bestStreak: goal.best_streak || 0,
      // Currency fields
      rewardCurrencyId: goal.reward_currency_id,
      rewardAmount: goal.reward_amount,
      rewardSuccesses: goal.reward_successes,
      consequenceCurrencyId: goal.consequence_currency_id,
      consequenceAmount: goal.consequence_amount,
      consequenceFailures: goal.consequence_failures,
      // Schedule config
      scheduleConfig: goal.schedule_config,
      // Today's counts from reflections (NOT daily_entries)
      todaySuccessCount,
      todayStruggleCount,
      dailyEntries,
      // Timestamps
      createdAt: goal.created_at,
      updatedAt: goal.updated_at,
    };
  });
  
  console.log('[Supabase API] getGoalsWithDailyEntries - Sample goal data:', goalsWithEntries?.[0]);
  
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
  
  // PERFORMANCE FIX: Select only needed columns instead of *
  let query = supabase
    .from('reflections')
    .select(`
      id,
      entry_date,
      category,
      type,
      description,
      linked_goal_id,
      outcome,
      currency_change,
      gained_ids,
      lost_ids,
      motivation_ids,
      was_worth_it,
      additional_thoughts,
      strategy_effectiveness,
      created_at,
      updated_at,
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
  
  // Map camelCase to snake_case for reflection fields
  const reflectionData: any = {
    user_id: userId,
    entry_date: reflection.entry_date || reflection.entryDate,
    category: reflection.category,
    type: reflection.type,
    description: reflection.description,
    linked_goal_id: reflection.linked_goal_id || reflection.linkedGoalId || null,
    outcome: reflection.outcome,
    currency_change: reflection.currency_change || reflection.currencyChange || null,
    gained_ids: reflection.gained_ids || reflection.gainedIds || [],
    lost_ids: reflection.lost_ids || reflection.lostIds || [],
    motivation_ids: reflection.motivation_ids || reflection.motivationIds || [],
    was_worth_it: reflection.was_worth_it !== undefined ? reflection.was_worth_it : reflection.wasWorthIt,
    additional_thoughts: reflection.additional_thoughts || reflection.additionalThoughts || null,
    strategy_effectiveness: reflection.strategy_effectiveness || reflection.strategyEffectiveness || [],
  };
  
  const { data, error } = await supabase
    .from('reflections')
    .insert(reflectionData)
    .select()
    .single();
  
  handleError(error, 'createReflection');
  return data;
};

export const updateReflection = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  // Map camelCase to snake_case for reflection fields
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };
  
  if (updates.entry_date !== undefined || updates.entryDate !== undefined) {
    updateData.entry_date = updates.entry_date || updates.entryDate;
  }
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.linked_goal_id !== undefined || updates.linkedGoalId !== undefined) {
    updateData.linked_goal_id = updates.linked_goal_id || updates.linkedGoalId || null;
  }
  if (updates.outcome !== undefined) updateData.outcome = updates.outcome;
  if (updates.currency_change !== undefined || updates.currencyChange !== undefined) {
    updateData.currency_change = updates.currency_change || updates.currencyChange || null;
  }
  if (updates.gained_ids !== undefined || updates.gainedIds !== undefined) {
    updateData.gained_ids = updates.gained_ids || updates.gainedIds || [];
  }
  if (updates.lost_ids !== undefined || updates.lostIds !== undefined) {
    updateData.lost_ids = updates.lost_ids || updates.lostIds || [];
  }
  if (updates.motivation_ids !== undefined || updates.motivationIds !== undefined) {
    updateData.motivation_ids = updates.motivation_ids || updates.motivationIds || [];
  }
  if (updates.was_worth_it !== undefined || updates.wasWorthIt !== undefined) {
    updateData.was_worth_it = updates.was_worth_it !== undefined ? updates.was_worth_it : updates.wasWorthIt;
  }
  if (updates.additional_thoughts !== undefined || updates.additionalThoughts !== undefined) {
    updateData.additional_thoughts = updates.additional_thoughts || updates.additionalThoughts || null;
  }
  if (updates.strategy_effectiveness !== undefined || updates.strategyEffectiveness !== undefined) {
    updateData.strategy_effectiveness = updates.strategy_effectiveness || updates.strategyEffectiveness || [];
  }
  
  const { data, error } = await supabase
    .from('reflections')
    .update(updateData)
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
  
  // Map camelCase to snake_case
  const journalData: any = {
    user_id: userId,
    content: journal.content,
    entry_date: journal.entry_date || journal.entryDate,
  };
  
  const { data, error } = await supabase
    .from('journals')
    .insert(journalData)
    .select()
    .single();
  
  handleError(error, 'createJournal');
  return data;
};

export const updateJournal = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  // Map camelCase to snake_case
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };
  
  if (updates.content !== undefined) updateData.content = updates.content;
  if (updates.entry_date !== undefined || updates.entryDate !== undefined) {
    updateData.entry_date = updates.entry_date || updates.entryDate;
  }
  
  const { data, error } = await supabase
    .from('journals')
    .update(updateData)
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
  
  // Map camelCase to snake_case
  const alarmData: any = {
    user_id: userId,
    title: alarm.title,
    goal_id: alarm.goal_id || alarm.goalId || null,
    enabled: alarm.enabled !== undefined ? alarm.enabled : true,
    time: alarm.time,
    triggers: alarm.triggers || [],
    secondary_alarms: alarm.secondary_alarms || alarm.secondaryAlarms || [],
  };
  
  const { data, error } = await supabase
    .from('alarms')
    .insert(alarmData)
    .select()
    .single();
  
  handleError(error, 'createAlarm');
  return data;
};

export const updateAlarm = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  // Map camelCase to snake_case
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };
  
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.goal_id !== undefined || updates.goalId !== undefined) {
    updateData.goal_id = updates.goal_id || updates.goalId || null;
  }
  if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
  if (updates.time !== undefined) updateData.time = updates.time;
  if (updates.triggers !== undefined) updateData.triggers = updates.triggers;
  if (updates.secondary_alarms !== undefined || updates.secondaryAlarms !== undefined) {
    updateData.secondary_alarms = updates.secondary_alarms || updates.secondaryAlarms;
  }
  
  const { data, error } = await supabase
    .from('alarms')
    .update(updateData)
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

/**
 * CRITICAL FIX: Clean up orphaned daily_entries that don't have corresponding reflections
 * This fixes the bug where icon counts are wrong because daily_entries and reflections are out of sync
 */
export const cleanupOrphanedDailyEntries = async () => {
  const userId = await getCurrentUserId();
  
  console.log('[Supabase API] Starting cleanup of orphaned daily_entries...');
  
  // Get all daily entries for the user
  const { data: allEntries, error: entriesError } = await supabase
    .from('daily_entries')
    .select('*')
    .eq('user_id', userId);
  
  handleError(entriesError, 'cleanupOrphanedDailyEntries - fetch entries');
  
  if (!allEntries || allEntries.length === 0) {
    console.log('[Supabase API] No daily entries found');
    return { deletedCount: 0 };
  }
  
  console.log('[Supabase API] Found', allEntries.length, 'daily entries');
  
  // Get all reflections for the user
  const { data: allReflections, error: reflectionsError } = await supabase
    .from('reflections')
    .select('*')
    .eq('user_id', userId);
  
  handleError(reflectionsError, 'cleanupOrphanedDailyEntries - fetch reflections');
  
  console.log('[Supabase API] Found', allReflections?.length || 0, 'reflections');
  
  // Find orphaned entries (entries without matching reflections)
  const orphanedEntries: string[] = [];
  
  for (const entry of allEntries) {
    // Check if there's a matching reflection
    const hasMatchingReflection = allReflections?.some(r => 
      r.linked_goal_id === entry.goal_id &&
      r.entry_date === entry.entry_date &&
      r.outcome === entry.type
    );
    
    if (!hasMatchingReflection) {
      console.log('[Supabase API] Found orphaned entry:', {
        id: entry.id,
        goalId: entry.goal_id,
        date: entry.entry_date,
        type: entry.type,
      });
      orphanedEntries.push(entry.id);
    }
  }
  
  console.log('[Supabase API] Found', orphanedEntries.length, 'orphaned entries to delete');
  
  // Delete orphaned entries
  if (orphanedEntries.length > 0) {
    const { error: deleteError } = await supabase
      .from('daily_entries')
      .delete()
      .in('id', orphanedEntries);
    
    handleError(deleteError, 'cleanupOrphanedDailyEntries - delete');
    
    console.log('[Supabase API] Successfully deleted', orphanedEntries.length, 'orphaned entries');
  }
  
  return { deletedCount: orphanedEntries.length };
};

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

// ============================================================================
// GOAL SCHEDULE SUMMARY
// ============================================================================

export const getGoalScheduleSummary = async (goalId: string) => {
  const userId = await getCurrentUserId();
  
  // Get the goal with its schedule configuration
  const { data: goal, error } = await supabase
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .eq('user_id', userId)
    .single();
  
  handleError(error, 'getGoalScheduleSummary');
  
  // Return a summary object (this would need backend logic to generate next occurrences)
  return {
    summary: 'Schedule summary',
    nextOccurrences: [],
    calendarType: goal?.calendar_type || 'gregorian',
  };
};

// ============================================================================
// LINK/UNLINK GOALS TO LIFE AREAS
// ============================================================================

export const linkGoalToLifeArea = async (lifeAreaId: string, goalId: string) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('goals')
    .update({ life_area_id: lifeAreaId })
    .eq('id', goalId)
    .eq('user_id', userId)
    .select()
    .single();
  
  handleError(error, 'linkGoalToLifeArea');
  return data;
};

export const unlinkGoalFromLifeArea = async (lifeAreaId: string, goalId: string) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('goals')
    .update({ life_area_id: null })
    .eq('id', goalId)
    .eq('user_id', userId)
    .eq('life_area_id', lifeAreaId)
    .select()
    .single();
  
  handleError(error, 'unlinkGoalFromLifeArea');
  return data;
};

// ============================================================================
// MITZVOT
// ============================================================================

export const getMitzvot = async () => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('mitzvot')
    .select('*')
    .eq('user_id', userId);
  
  handleError(error, 'getMitzvot');
  return data || [];
};

export const createMitzvah = async (mitzvah: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('mitzvot')
    .insert({
      user_id: userId,
      ...mitzvah,
    })
    .select()
    .single();
  
  handleError(error, 'createMitzvah');
  return data;
};

export const updateMitzvah = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('mitzvot')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  
  handleError(error, 'updateMitzvah');
  return data;
};

export const deleteMitzvah = async (id: string) => {
  const userId = await getCurrentUserId();
  
  const { error } = await supabase
    .from('mitzvot')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  
  handleError(error, 'deleteMitzvah');
  return { success: true };
};

export const getMitzvotCategories = async () => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('mitzvot_categories')
    .select('*')
    .eq('user_id', userId);
  
  handleError(error, 'getMitzvotCategories');
  return data || [];
};

export const createMitzvahCategory = async (category: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('mitzvot_categories')
    .insert({
      user_id: userId,
      ...category,
    })
    .select()
    .single();
  
  handleError(error, 'createMitzvahCategory');
  return data;
};

export const updateMitzvahCategory = async (id: string, updates: any) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('mitzvot_categories')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  
  handleError(error, 'updateMitzvahCategory');
  return data;
};

export const deleteMitzvahCategory = async (id: string) => {
  const userId = await getCurrentUserId();
  
  const { error } = await supabase
    .from('mitzvot_categories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  
  handleError(error, 'deleteMitzvahCategory');
  return { success: true };
};

export const getMitzvotImportStatus = async () => {
  const userId = await getCurrentUserId();
  
  // This would need to be implemented with Supabase Edge Functions
  // For now, return a placeholder
  return {
    totalSystemMitzvot: 0,
    userHasImported: false,
    systemMitzvotAvailable: false,
  };
};

export const downloadMitzvotTemplate = async () => {
  // Generate a simple CSV template
  const templateHeaders = 'mitzvah_number,title,type,location,description,source,applies_to,primary_domain,subdomain,tags,mode';
  const templateExample = '1,Love your neighbor as yourself,PROACTIVE,Everywhere,Treat others with kindness and respect,Leviticus 19:18,All Jews,Interpersonal Mitzvot,Kindness,"kindness,love,respect",Positive Action';
  const csvContent = `${templateHeaders}\n${templateExample}\n`;
  
  return csvContent;
};

export const initializeSystemMitzvot = async () => {
  // This would need to be implemented with Supabase Edge Functions
  throw new Error('System mitzvot initialization needs to be implemented with Supabase Edge Functions');
};

export const importMitzvotCSV = async (csvContent: string) => {
  // This would need to be implemented with Supabase Edge Functions
  throw new Error('CSV import needs to be implemented with Supabase Edge Functions');
};

// ============================================================================
// AI CHAT / CONVERSATIONS
// ============================================================================

export const getHealthStatus = async () => {
  // This would need to be implemented with Supabase Edge Functions
  return {
    status: 'ok',
    features: {
      aiChat: false,
      voiceTranscription: false,
    },
  };
};

export const getConversations = async () => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  
  handleError(error, 'getConversations');
  return data || [];
};

export const createConversation = async () => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      title: 'New Conversation',
    })
    .select()
    .single();
  
  handleError(error, 'createConversation');
  return data;
};

export const getConversationMessages = async (conversationId: string) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  
  handleError(error, 'getConversationMessages');
  return data || [];
};

export const sendTextMessage = async (conversationId: string, message: string) => {
  // This would need to be implemented with Supabase Edge Functions for AI integration
  throw new Error('AI chat needs to be implemented with Supabase Edge Functions');
};

export const sendAudioMessage = async (conversationId: string, audioBase64: string) => {
  // This would need to be implemented with Supabase Edge Functions for AI integration
  throw new Error('Voice transcription needs to be implemented with Supabase Edge Functions');
};

// ============================================================================
// HELPER: GET SINGLE GOAL
// ============================================================================

export const getGoal = async (id: string) => {
  return getGoalById(id);
};

// ============================================================================
// HELPER: GET SINGLE ALARM
// ============================================================================

export const getAlarm = async (id: string) => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('alarms')
    .select(`
      *,
      goal:goals(id, title)
    `)
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  
  handleError(error, 'getAlarm');
  return data;
};

// ============================================================================
// USER PROFILE
// ============================================================================

export const getProfile = async () => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    handleError(error, 'getProfile');
  }
  
  return data || null;
};

export const updateProfile = async (updates: { name?: string; avatar_url?: string }) => {
  const userId = await getCurrentUserId();
  
  let avatarUrl = updates.avatar_url;
  
  // CRITICAL FIX: Handle local file URIs, blob URLs, and content URIs
  // These need to be uploaded to Supabase Storage to work on iOS
  if (avatarUrl && (
    avatarUrl.startsWith('file://') || 
    avatarUrl.startsWith('content://') || 
    avatarUrl.startsWith('blob:')
  )) {
    console.log('[Supabase API] Uploading avatar image to storage from local/blob URI...');
    
    try {
      // Convert local URI to blob
      const response = await fetch(avatarUrl);
      const blob = await response.blob();
      
      // CRITICAL FIX: Generate path that matches RLS policy
      // RLS policy expects: avatars/{user_id}/{filename}
      const fileExt = 'jpg'; // Default to jpg
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;
      
      console.log('[Supabase API] Uploading to path:', filePath);
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      
      if (uploadError) {
        console.error('[Supabase API] Error uploading avatar:', uploadError);
        throw new Error('Failed to upload avatar image: ' + uploadError.message);
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      avatarUrl = publicUrl;
      console.log('[Supabase API] Avatar uploaded successfully to Supabase Storage:', avatarUrl);
    } catch (error: any) {
      console.error('[Supabase API] Error processing avatar upload:', error);
      throw new Error('Failed to process avatar image: ' + (error.message || 'Unknown error'));
    }
  } else if (avatarUrl) {
    console.log('[Supabase API] Using existing avatar URL (Gravatar or Supabase Storage):', avatarUrl);
  }
  
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      name: updates.name,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id',
      ignoreDuplicates: false,
    })
    .select()
    .single();
  
  handleError(error, 'updateProfile');
  console.log('[Supabase API] Profile updated successfully with avatar:', data?.avatar_url);
  return data;
};

// Helper to get Gravatar URL from email
export const getGravatarUrl = (email: string, size: number = 200): string => {
  // Use crypto-js for proper MD5 hashing
  const CryptoJS = require('crypto-js');
  const emailHash = CryptoJS.MD5(email.toLowerCase().trim()).toString();
  return `https://www.gravatar.com/avatar/${emailHash}?s=${size}&d=identicon`;
};
