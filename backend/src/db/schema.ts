import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, date } from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

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
  parentId: uuid('parent_id').references(() => lifeAreas.id, { onDelete: 'cascade' }),
  level: integer('level').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const strategies = pgTable('strategies', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  linkedGoalIds: uuid('linked_goal_ids').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const currencies = pgTable('currencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  symbol: text('symbol'),
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
  scheduleTimesPerDay: integer('schedule_times_per_day'),
  rewardCurrencyId: uuid('reward_currency_id').references(() => currencies.id, { onDelete: 'set null' }),
  rewardSuccesses: integer('reward_successes'),
  rewardAmount: integer('reward_amount'),
  consequenceCurrencyId: uuid('consequence_currency_id').references(() => currencies.id, { onDelete: 'set null' }),
  consequenceFailures: integer('consequence_failures'),
  consequenceAmount: integer('consequence_amount'),
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
  lookupField1: text('lookup_field_1'),
  lookupField2: text('lookup_field_2'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});
