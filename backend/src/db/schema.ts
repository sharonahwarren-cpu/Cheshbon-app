import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, date, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

export const currencyTypeEnum = pgEnum('currency_type', ['reward', 'consequence']);

export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  entryDate: date('entry_date').notNull(),
  content: text('content').notNull(),
  mood: text('mood'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const lifeAreas = pgTable('life_areas', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  parentId: uuid('parent_id').references(() => lifeAreas.id, { onDelete: 'set null' }),
  icon: text('icon'),
  color: text('color'),
  displayOrder: integer('display_order').default(0).notNull(),
  showProgress: boolean('show_progress').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const strategies = pgTable('strategies', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  linkedGoalIds: uuid('linked_goal_ids').array(),
  successCount: integer('success_count').default(0).notNull(),
  failureCount: integer('failure_count').default(0).notNull(),
  timesUsed: integer('times_used').default(0).notNull(),
  difficulties: text('difficulties'),
  overcomeDifficulties: text('overcome_difficulties'),
  confidenceRating: integer('confidence_rating'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const currencies = pgTable('currencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  symbol: text('symbol'),
  type: currencyTypeEnum('type').notNull().default('consequence'),
  onSuccess: text('on_success').default('NONE'),
  onFailure: text('on_failure').default('NONE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  targetDate: timestamp('target_date', { withTimezone: true }),
  completed: boolean('completed').default(false).notNull(),
  progress: integer('progress').default(0).notNull(),
  parentGoalId: uuid('parent_goal_id').references(() => goals.id, { onDelete: 'cascade' }),
  lifeAreaId: uuid('life_area_id').references(() => lifeAreas.id, { onDelete: 'set null' }),
  behaviorCategories: text('behavior_categories').array(),
  type: text('type').default('Proactive').notNull(),
  strategyIds: text('strategy_ids').array(),
  scheduleType: text('schedule_type').default('Always Active').notNull(),
  scheduleTimesPerDay: integer('schedule_times_per_day').default(1),
  scheduleDaysOfWeek: integer('schedule_days_of_week').array(),
  scheduleDatesOfMonth: integer('schedule_dates_of_month').array(),
  scheduleNthDayOfMonth: jsonb('schedule_nth_day_of_month'),
  scheduleTimesPerMonth: integer('schedule_times_per_month'),
  scheduleYearlyDates: jsonb('schedule_yearly_dates'),
  scheduleYearlyRanges: jsonb('schedule_yearly_ranges'),
  isActive: boolean('is_active').default(true).notNull(),
  status: text('status').default('ACTIVE').notNull(),
  rewardCurrencyId: uuid('reward_currency_id').references(() => currencies.id, { onDelete: 'set null' }),
  rewardSuccesses: integer('reward_successes'),
  rewardAmount: integer('reward_amount'),
  consequenceCurrencyId: uuid('consequence_currency_id').references(() => currencies.id, { onDelete: 'set null' }),
  consequenceFailures: integer('consequence_failures'),
  consequenceAmount: integer('consequence_amount'),
  alarms: jsonb('alarms'),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  calendarType: text('calendar_type'),
  scheduleRecurrenceType: text('schedule_recurrence_type').default('daily'),
  scheduleTimesPerDayDetails: jsonb('schedule_times_per_day_details'),
  scheduleWeekendsOnly: boolean('schedule_weekends_only').default(false),
  scheduleWeekdaysOnly: boolean('schedule_weekdays_only').default(false),
  scheduleFortnightEvenOdd: text('schedule_fortnight_even_odd'),
  scheduleMonthlyRange: jsonb('schedule_monthly_range'),
  scheduleMonthlyRandomCount: integer('schedule_monthly_random_count'),
  scheduleExclusions: jsonb('schedule_exclusions'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  notificationsEnabled: boolean('notifications_enabled').default(false).notNull(),
  notificationFrequency: text('notification_frequency'),
  notificationTime: text('notification_time'),
  notificationDays: text('notification_days').array(),
  notificationAlarms: jsonb('notification_alarms'),
  reflectionCategoriesEnabled: boolean('reflection_categories_enabled').default(true).notNull(),
  reflectionCategories: jsonb('reflection_categories'),
  preferredHomeScreen: text('preferred_home_screen').default('reflect').notNull(),
  alternativeCalendar: text('alternative_calendar').default('gregorian').notNull(),
  timezone: text('timezone').default('UTC').notNull(),
  useAiCheshbon: boolean('use_ai_cheshbon').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const goalCompletions = pgTable('goal_completions', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  isSuccess: boolean('is_success').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const reflections = pgTable('reflections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  entryDate: date('entry_date').notNull(),
  category: text('category'),
  type: text('type').notNull(),
  description: text('description').notNull(),
  linkedGoalId: uuid('linked_goal_id').references(() => goals.id, { onDelete: 'set null' }),
  outcome: text('outcome'),
  currencyChange: jsonb('currency_change'),
  gainedIds: uuid('gained_ids').array(),
  lostIds: uuid('lost_ids').array(),
  wasWorthIt: boolean('was_worth_it'),
  additionalThoughts: text('additional_thoughts'),
  strategyEffectiveness: jsonb('strategy_effectiveness'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const gainsLosses = pgTable('gains_losses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  category: text('category'),
  subCategory: text('sub_category'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const goalCurrencyBalances = pgTable('goal_currency_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  currencyId: uuid('currency_id').notNull().references(() => currencies.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  balance: integer('balance').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  uniqueGoalCurrency: uniqueIndex('unique_goal_currency').on(table.goalId, table.currencyId),
}));

export const currencyTransactions = pgTable('currency_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  currencyId: uuid('currency_id').notNull().references(() => currencies.id, { onDelete: 'cascade' }),
  goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'set null' }),
  reflectionId: uuid('reflection_id').references(() => reflections.id, { onDelete: 'set null' }),
  amount: integer('amount').notNull(),
  transactionType: text('transaction_type').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const alarms = pgTable('alarms', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  calendarType: text('calendar_type').default('gregorian'),
  eventType: text('event_type'),
  triggers: jsonb('triggers').notNull(),
  recurring: boolean('recurring').default(false).notNull(),
  location: jsonb('location'),
  timezone: text('timezone').notNull(),
  nextTriggerTimeUtc: integer('next_trigger_time_utc'),
  notificationId: text('notification_id'),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const userLocations = pgTable('user_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  locationType: text('location_type').notNull(), // 'home' or 'other'
  name: text('name'), // e.g., "Home", "Work", "Gym"
  latitude: integer('latitude').notNull(), // Store as integer (degrees * 1000000 for precision)
  longitude: integer('longitude').notNull(),
  radius: integer('radius').notNull(), // In meters
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const mitzvotCategories = pgTable('mitzvot_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  displayOrder: integer('display_order').default(0).notNull(),
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const mitzvot = pgTable('mitzvot', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  categoryId: uuid('category_id').references(() => mitzvotCategories.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  status: text('status').default('ACTIVE').notNull(),
  isSystem: boolean('is_system').default(false).notNull(),
  scheduleType: text('schedule_type').default('always_active').notNull(),
  scheduleDaysOfWeek: integer('schedule_days_of_week').array(),
  scheduleDatesOfMonth: integer('schedule_dates_of_month').array(),
  scheduleNthDayOfMonth: jsonb('schedule_nth_day_of_month'),
  scheduleTimesPerMonth: integer('schedule_times_per_month'),
  scheduleYearlyDates: jsonb('schedule_yearly_dates'),
  scheduleYearlyRanges: jsonb('schedule_yearly_ranges'),
  scheduleRecurrenceType: text('schedule_recurrence_type'),
  scheduleTimesPerDayDetails: jsonb('schedule_times_per_day_details'),
  scheduleWeekendsOnly: boolean('schedule_weekends_only').default(false),
  scheduleWeekdaysOnly: boolean('schedule_weekdays_only').default(false),
  scheduleFortnightEvenOdd: text('schedule_fortnight_even_odd'),
  scheduleMonthlyRange: jsonb('schedule_monthly_range'),
  scheduleMonthlyRandomCount: integer('schedule_monthly_random_count'),
  scheduleExclusions: jsonb('schedule_exclusions'),
  calendarType: text('calendar_type'),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  rewardCurrencyId: uuid('reward_currency_id').references(() => currencies.id, { onDelete: 'set null' }),
  rewardSuccesses: integer('reward_successes'),
  rewardAmount: integer('reward_amount'),
  consequenceCurrencyId: uuid('consequence_currency_id').references(() => currencies.id, { onDelete: 'set null' }),
  consequenceFailures: integer('consequence_failures'),
  consequenceAmount: integer('consequence_amount'),
  mitzvahNumber: integer('mitzvah_number'),
  source: text('source'),
  hebrewName: text('hebrew_name'),
  appliesToCat: text('applies_to'),
  location: text('location'),
  timePeriod: text('time_period'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const mitzvotCompletions = pgTable('mitzvot_completions', {
  id: uuid('id').primaryKey().defaultRandom(),
  mitzvahId: uuid('mitzvah_id').notNull().references(() => mitzvot.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  isSuccess: boolean('is_success').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const cheshbonSessions = pgTable('cheshbon_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  sessionDate: date('session_date').notNull(),
  audioUrl: text('audio_url'),
  transcription: text('transcription'),
  aiSuggestions: jsonb('ai_suggestions'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const cheshbonMessages = pgTable('cheshbon_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => cheshbonSessions.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
