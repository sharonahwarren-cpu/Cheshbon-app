import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, asc, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { getNextActivations, calculateAstronomicalTimes, applyTimeOffset, type ScheduleConfig } from '../utils/goal-scheduler.js';
import { getScheduleSummaryWithOccurrences } from '../utils/schedule-summary.js';

export function registerGoalRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/goals/hierarchy - Get goals organized in parent-child hierarchy
  app.fastify.get('/api/goals/hierarchy', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching goal hierarchy');

    try {
      const goals = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.userId, session.user.id))
        .orderBy(desc(schema.goals.createdAt));

      // Build hierarchy structure
      const goalMap = new Map(goals.map(g => [g.id, { ...g, children: [] }]));
      const rootGoals = [];

      for (const goal of goals) {
        if (goal.parentGoalId) {
          const parent = goalMap.get(goal.parentGoalId);
          if (parent) {
            parent.children.push(goalMap.get(goal.id)!);
          }
        } else {
          rootGoals.push(goalMap.get(goal.id)!);
        }
      }

      app.logger.info({ userId: session.user.id, count: rootGoals.length }, 'Goal hierarchy fetched successfully');
      return rootGoals;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch goal hierarchy');
      throw error;
    }
  });

  // GET /api/goals/:id - Get a single goal by ID
  app.fastify.get('/api/goals/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, goalId: id }, 'Fetching goal');

    try {
      const goals = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.id, id))
        .limit(1);

      if (!goals.length) {
        app.logger.warn({ userId: session.user.id, goalId: id }, 'Goal not found');
        return reply.status(404).send({ error: 'Goal not found' });
      }

      if (goals[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, goalId: id, ownerId: goals[0].userId },
          'Unauthorized access to goal'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const goal = goals[0];

      // Fetch currency balances for this goal
      let rewardCurrencyBalance = 0;
      let consequenceCurrencyBalance = 0;

      if (goal.rewardCurrencyId) {
        const rewardBalances = await app.db
          .select()
          .from(schema.goalCurrencyBalances)
          .where(and(eq(schema.goalCurrencyBalances.goalId, id), eq(schema.goalCurrencyBalances.currencyId, goal.rewardCurrencyId)))
          .limit(1);
        if (rewardBalances.length) {
          rewardCurrencyBalance = rewardBalances[0].balance;
        }
      }

      if (goal.consequenceCurrencyId) {
        const consequenceBalances = await app.db
          .select()
          .from(schema.goalCurrencyBalances)
          .where(and(eq(schema.goalCurrencyBalances.goalId, id), eq(schema.goalCurrencyBalances.currencyId, goal.consequenceCurrencyId)))
          .limit(1);
        if (consequenceBalances.length) {
          consequenceCurrencyBalance = consequenceBalances[0].balance;
        }
      }

      // Parse JSONB fields for proper return
      const monthlyWeekdayRules = goal.scheduleNthDayOfMonth
        ? (typeof goal.scheduleNthDayOfMonth === 'string' ? JSON.parse(goal.scheduleNthDayOfMonth) : goal.scheduleNthDayOfMonth)
        : null;

      const scheduleMonthlyRange = goal.scheduleMonthlyRange
        ? (typeof goal.scheduleMonthlyRange === 'string' ? JSON.parse(goal.scheduleMonthlyRange) : goal.scheduleMonthlyRange)
        : null;

      const scheduleTimesPerDayDetails = goal.scheduleTimesPerDayDetails
        ? (typeof goal.scheduleTimesPerDayDetails === 'string' ? JSON.parse(goal.scheduleTimesPerDayDetails) : goal.scheduleTimesPerDayDetails)
        : null;

      const scheduleExclusions = goal.scheduleExclusions
        ? (typeof goal.scheduleExclusions === 'string' ? JSON.parse(goal.scheduleExclusions) : goal.scheduleExclusions)
        : null;

      // Convert dates to ISO 8601 UTC format
      const convertToISO = (date: Date | null) => date ? (date instanceof Date ? date.toISOString() : new Date(date).toISOString()) : null;

      const goalWithBalances = {
        ...goal,
        rewardCurrencyBalance,
        consequenceCurrencyBalance,
        targetDate: convertToISO(goal.targetDate),
        startDate: convertToISO(goal.startDate),
        endDate: convertToISO(goal.endDate),
        createdAt: convertToISO(goal.createdAt),
        updatedAt: convertToISO(goal.updatedAt),
        yearlyDates: goal.scheduleDatesOfYear || [],
        monthlyDates: goal.scheduleDatesOfMonth || [],
        monthlyWeekdayRules: monthlyWeekdayRules || [],
        selectedWeekdays: goal.scheduleDaysOfWeek || [],
        selectedFortnightDays: goal.scheduleDaysOfWeek || [],
        scheduleRecurrenceType: goal.scheduleRecurrenceType,
        scheduleTimesPerDayDetails,
        scheduleWeekendsOnly: goal.scheduleWeekendsOnly,
        scheduleWeekdaysOnly: goal.scheduleWeekdaysOnly,
        scheduleFortnightEvenOdd: goal.scheduleFortnightEvenOdd,
        scheduleMonthlyRange,
        scheduleMonthlyRandomCount: goal.scheduleMonthlyRandomCount,
        scheduleExclusions,
      };

      app.logger.info({ userId: session.user.id, goalId: id }, 'Goal retrieved successfully');
      return goalWithBalances;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, goalId: id }, 'Failed to fetch goal');
      throw error;
    }
  });

  // GET /api/goals - Get all goals for authenticated user
  app.fastify.get('/api/goals', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching goals');

    try {
      const goalsData = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.userId, session.user.id));

      // Get all reflections for the user to calculate counts
      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(eq(schema.reflections.userId, session.user.id));

      // Helper to convert dates to ISO 8601 UTC format
      const convertToISO = (date: Date | null) => date ? (date instanceof Date ? date.toISOString() : new Date(date).toISOString()) : null;

      // Map goals with success/struggle counts and UTC dates
      const goalsWithCounts = goalsData.map(goal => {
        // Count successes and struggles for this goal
        let successCount = 0;
        let struggleCount = 0;

        for (const reflection of reflections) {
          if (reflection.linkedGoalId === goal.id) {
            if (reflection.outcome === 'success') {
              successCount++;
            } else if (reflection.outcome === 'struggled') {
              struggleCount++;
            }
          }
        }

        const goalWithCounts = Object.assign({}, goal, {
          successCount,
          struggleCount,
          targetDate: convertToISO(goal.targetDate),
          startDate: convertToISO(goal.startDate),
          endDate: convertToISO(goal.endDate),
          createdAt: convertToISO(goal.createdAt),
          updatedAt: convertToISO(goal.updatedAt),
        });
        return goalWithCounts;
      });

      // Sort by status (ACTIVE first) then by title
      const goals = goalsWithCounts.sort((a: any, b: any) => {
        const statusA = a.status || 'ACTIVE';
        const statusB = b.status || 'ACTIVE';
        if (statusA !== statusB) {
          return statusA === 'ACTIVE' ? -1 : 1;
        }
        return (a.title || '').localeCompare(b.title || '');
      });

      app.logger.info({ userId: session.user.id, count: goals.length }, 'Goals fetched successfully');
      return goals;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch goals');
      throw error;
    }
  });

  // POST /api/goals - Create a new goal
  app.fastify.post('/api/goals', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as {
      title: string;
      description?: string;
      parentGoalId?: string;
      lifeAreaId?: string;
      behaviorCategories?: string[];
      type?: 'Restraining' | 'Proactive';
      strategyIds?: string[];
      scheduleType?: string;
      scheduleTimesPerDay?: number;
      targetDate?: string;
      startDate?: string;
      endDate?: string;
      progress?: number;
      reward?: { currencyId: string; successes: number; amount: number };
      consequence?: { currencyId: string; failures: number; amount: number };
      alarms?: Array<{
        time: string;
        isRelative?: boolean;
        offset?: number;
        offsetUnit?: 'minutes' | 'hours' | 'days';
      }>;
      calendarType?: string;
      selectedWeekdays?: number[];
      selectedFortnightDays?: number[];
      monthlyDates?: number[];
      monthlyWeekdayRules?: Array<{ week: number; day: number }>;
      yearlyDates?: string[];
      scheduleRecurrenceType?: string;
      scheduleTimesPerDayDetails?: Array<{ hour: number; minute: number; conditions?: string }>;
      scheduleWeekendsOnly?: boolean;
      scheduleWeekdaysOnly?: boolean;
      scheduleFortnightEvenOdd?: string;
      scheduleMonthlyRange?: { start: number; end: number };
      scheduleMonthlyRandomCount?: number;
      scheduleExclusions?: string[];
    };


    app.logger.info(
      { userId: session.user.id, title: body.title, type: body.type, alarmCount: body.alarms?.length },
      'Creating goal'
    );

    try {
      // Convert ISO 8601 strings to UTC timestamps
      const startDate = body.startDate ? new Date(body.startDate) : null;
      const endDate = body.endDate ? new Date(body.endDate) : null;
      const targetDate = body.targetDate ? new Date(body.targetDate) : null;

      app.logger.info(
        {
          userId: session.user.id,
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
        },
        'Converting goal dates to UTC'
      );

      const goals = await app.db
        .insert(schema.goals)
        .values({
          userId: session.user.id,
          title: body.title,
          description: body.description || null,
          targetDate,
          startDate,
          endDate,
          progress: body.progress || 0,
          parentGoalId: body.parentGoalId || null,
          lifeAreaId: body.lifeAreaId || null,
          behaviorCategories: (body.behaviorCategories?.length ? body.behaviorCategories : null) as string[] | null,
          type: body.type || 'Proactive',
          strategyIds: (body.strategyIds?.length ? body.strategyIds : null) as string[] | null,
          scheduleType: body.scheduleType || 'Always Active',
          scheduleTimesPerDay: body.scheduleTimesPerDay || null,
          scheduleDaysOfWeek: (body.selectedWeekdays?.length || body.selectedFortnightDays?.length ? (body.selectedWeekdays || body.selectedFortnightDays) : null) as number[] | null,
          scheduleDatesOfMonth: (body.monthlyDates?.length ? body.monthlyDates : null) as number[] | null,
          scheduleNthDayOfMonth: body.monthlyWeekdayRules ? JSON.stringify(body.monthlyWeekdayRules) : null,
          scheduleDatesOfYear: (body.yearlyDates?.length ? body.yearlyDates : null) as string[] | null,
          rewardCurrencyId: body.reward?.currencyId || null,
          rewardSuccesses: body.reward?.successes || null,
          rewardAmount: body.reward?.amount || null,
          consequenceCurrencyId: body.consequence?.currencyId || null,
          consequenceFailures: body.consequence?.failures || null,
          consequenceAmount: body.consequence?.amount || null,
          alarms: body.alarms ? JSON.stringify(body.alarms) : null,
          calendarType: body.calendarType || null,
          scheduleRecurrenceType: body.scheduleRecurrenceType || 'daily',
          scheduleTimesPerDayDetails: body.scheduleTimesPerDayDetails ? JSON.stringify(body.scheduleTimesPerDayDetails) : null,
          scheduleWeekendsOnly: body.scheduleWeekendsOnly || false,
          scheduleWeekdaysOnly: body.scheduleWeekdaysOnly || false,
          scheduleFortnightEvenOdd: body.scheduleFortnightEvenOdd || null,
          scheduleMonthlyRange: body.scheduleMonthlyRange ? JSON.stringify(body.scheduleMonthlyRange) : null,
          scheduleMonthlyRandomCount: body.scheduleMonthlyRandomCount || null,
          scheduleExclusions: body.scheduleExclusions ? JSON.stringify(body.scheduleExclusions) : null,
          scheduleDateOfYearMonths: (body.selectedWeekdays?.length ? body.selectedWeekdays : null) as number[] | null,
        })
        .returning();
      const goal = goals[0];

      app.logger.info({ userId: session.user.id, goalId: goal.id }, 'Goal created successfully');
      return goal;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, title: body.title },
        'Failed to create goal'
      );
      throw error;
    }
  });

  // PUT /api/goals/:id - Update a goal
  app.fastify.put('/api/goals/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as {
      title?: string;
      description?: string;
      parentGoalId?: string;
      lifeAreaId?: string;
      behaviorCategories?: string[];
      type?: 'Restraining' | 'Proactive';
      strategyIds?: string[];
      scheduleType?: string;
      scheduleTimesPerDay?: number;
      targetDate?: string;
      startDate?: string;
      endDate?: string;
      completed?: boolean;
      progress?: number;
      reward?: { currencyId: string; successes: number; amount: number };
      consequence?: { currencyId: string; failures: number; amount: number };
      alarms?: Array<{
        time: string;
        isRelative?: boolean;
        offset?: number;
        offsetUnit?: 'minutes' | 'hours' | 'days';
      }>;
      calendarType?: string;
      selectedWeekdays?: number[];
      selectedFortnightDays?: number[];
      monthlyDates?: number[];
      monthlyWeekdayRules?: Array<{ week: number; day: number }>;
      yearlyDates?: string[];
      scheduleRecurrenceType?: string;
      scheduleTimesPerDayDetails?: Array<{ hour: number; minute: number; conditions?: string }>;
      scheduleWeekendsOnly?: boolean;
      scheduleWeekdaysOnly?: boolean;
      scheduleFortnightEvenOdd?: string;
      scheduleMonthlyRange?: { start: number; end: number };
      scheduleMonthlyRandomCount?: number;
      scheduleExclusions?: string[];
    };

    app.logger.info({ userId: session.user.id, goalId: id }, 'Updating goal');

    try {
      // Check if goal exists and belongs to user
      const existingGoal = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.id, id))
        .limit(1);

      if (!existingGoal.length) {
        app.logger.warn({ userId: session.user.id, goalId: id }, 'Goal not found');
        return reply.status(404).send({ error: 'Goal not found' });
      }

      if (existingGoal[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, goalId: id, ownerId: existingGoal[0].userId },
          'Unauthorized access to goal'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const updateData: Record<string, unknown> = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.description !== undefined) updateData.description = body.description || null;
      if (body.parentGoalId !== undefined) updateData.parentGoalId = body.parentGoalId || null;
      if (body.lifeAreaId !== undefined) updateData.lifeAreaId = body.lifeAreaId || null;
      if (body.behaviorCategories !== undefined) updateData.behaviorCategories = (body.behaviorCategories?.length ? body.behaviorCategories : null) as string[] | null;
      if (body.type !== undefined) updateData.type = body.type;
      if (body.strategyIds !== undefined) updateData.strategyIds = (body.strategyIds?.length ? body.strategyIds : null) as string[] | null;
      if (body.scheduleType !== undefined) updateData.scheduleType = body.scheduleType;
      if (body.scheduleTimesPerDay !== undefined) updateData.scheduleTimesPerDay = body.scheduleTimesPerDay || null;
      if (body.targetDate !== undefined) updateData.targetDate = body.targetDate ? new Date(body.targetDate) : null;
      if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null;
      if (body.endDate !== undefined) {
        updateData.endDate = body.endDate ? new Date(body.endDate) : null;
        if (body.endDate) {
          app.logger.info(
            { userId: session.user.id, goalId: id, endDate: new Date(body.endDate).toISOString() },
            'Updating goal endDate to UTC'
          );
        }
      }
      if (body.selectedWeekdays !== undefined || body.selectedFortnightDays !== undefined) {
        updateData.scheduleDaysOfWeek = (body.selectedWeekdays?.length || body.selectedFortnightDays?.length ? (body.selectedWeekdays || body.selectedFortnightDays) : null) as number[] | null;
      }
      if (body.monthlyDates !== undefined) updateData.scheduleDatesOfMonth = (body.monthlyDates?.length ? body.monthlyDates : null) as number[] | null;
      if (body.monthlyWeekdayRules !== undefined) updateData.scheduleNthDayOfMonth = body.monthlyWeekdayRules ? JSON.stringify(body.monthlyWeekdayRules) : null;
      if (body.yearlyDates !== undefined) updateData.scheduleDatesOfYear = (body.yearlyDates?.length ? body.yearlyDates : null) as string[] | null;
      if (body.calendarType !== undefined) {
        const newCalendarType = body.calendarType || null;
        const oldCalendarType = existingGoal[0].calendarType;

        updateData.calendarType = newCalendarType;

        // Handle calendar type toggle logic
        if (newCalendarType && newCalendarType !== 'gregorian' && oldCalendarType === 'gregorian') {
          // Switching TO alternative calendar: clear Gregorian calendar dates
          updateData.scheduleDatesOfMonth = null;
          updateData.scheduleMonthlyRange = null;
          updateData.scheduleDatesOfYear = null;
          app.logger.info(
            { userId: session.user.id, goalId: id, newCalendarType },
            'Calendar type changed to alternative; clearing Gregorian calendar dates'
          );
        } else if (newCalendarType === 'gregorian' || !newCalendarType) {
          // Switching TO Gregorian or clearing calendar: clear alternative calendar dates
          updateData.calendarType = 'gregorian';
          // For now, we keep scheduleDatesOfYear as is since it can be used for both calendars
          app.logger.info(
            { userId: session.user.id, goalId: id },
            'Calendar type set to Gregorian'
          );
        }
      }
      if (body.completed !== undefined) updateData.completed = body.completed;
      if (body.progress !== undefined) updateData.progress = body.progress;
      if (body.reward !== undefined) {
        if (body.reward && body.reward.currencyId) {
          updateData.rewardCurrencyId = body.reward.currencyId;
          updateData.rewardSuccesses = body.reward.successes ?? null;
          updateData.rewardAmount = body.reward.amount ?? null;
        } else {
          // If reward is explicitly set to null or missing currencyId, clear all reward fields
          updateData.rewardCurrencyId = null;
          updateData.rewardSuccesses = null;
          updateData.rewardAmount = null;
        }
      }
      if (body.consequence !== undefined) {
        if (body.consequence && body.consequence.currencyId) {
          updateData.consequenceCurrencyId = body.consequence.currencyId;
          updateData.consequenceFailures = body.consequence.failures ?? null;
          updateData.consequenceAmount = body.consequence.amount ?? null;
        } else {
          // If consequence is explicitly set to null or missing currencyId, clear all consequence fields
          updateData.consequenceCurrencyId = null;
          updateData.consequenceFailures = null;
          updateData.consequenceAmount = null;
        }
      }
      if (body.alarms !== undefined) {
        updateData.alarms = body.alarms ? JSON.stringify(body.alarms) : null;
      }
      if (body.scheduleRecurrenceType !== undefined) updateData.scheduleRecurrenceType = body.scheduleRecurrenceType;
      if (body.scheduleTimesPerDayDetails !== undefined) updateData.scheduleTimesPerDayDetails = body.scheduleTimesPerDayDetails ? JSON.stringify(body.scheduleTimesPerDayDetails) : null;
      if (body.scheduleWeekendsOnly !== undefined) updateData.scheduleWeekendsOnly = body.scheduleWeekendsOnly;
      if (body.scheduleWeekdaysOnly !== undefined) updateData.scheduleWeekdaysOnly = body.scheduleWeekdaysOnly;
      if (body.scheduleFortnightEvenOdd !== undefined) updateData.scheduleFortnightEvenOdd = body.scheduleFortnightEvenOdd || null;
      if (body.scheduleMonthlyRange !== undefined) updateData.scheduleMonthlyRange = body.scheduleMonthlyRange ? JSON.stringify(body.scheduleMonthlyRange) : null;
      if (body.scheduleMonthlyRandomCount !== undefined) updateData.scheduleMonthlyRandomCount = body.scheduleMonthlyRandomCount || null;
      if (body.scheduleExclusions !== undefined) updateData.scheduleExclusions = body.scheduleExclusions ? JSON.stringify(body.scheduleExclusions) : null;
      updateData.updatedAt = new Date();

      const updatedGoals = await app.db
        .update(schema.goals)
        .set(updateData)
        .where(eq(schema.goals.id, id))
        .returning();

      if (!updatedGoals.length) {
        app.logger.error({ userId: session.user.id, goalId: id }, 'Goal update failed - no result returned');
        return reply.status(500).send({ error: 'Failed to update goal' });
      }

      const updatedGoal = updatedGoals[0];

      // Initialize or update goal_currency_balances if currencies are set
      if (body.reward !== undefined && body.reward?.currencyId) {
        const existingBalance = await app.db
          .select()
          .from(schema.goalCurrencyBalances)
          .where(and(eq(schema.goalCurrencyBalances.goalId, id), eq(schema.goalCurrencyBalances.currencyId, body.reward.currencyId)))
          .limit(1);

        if (!existingBalance.length) {
          await app.db
            .insert(schema.goalCurrencyBalances)
            .values({
              goalId: id,
              currencyId: body.reward.currencyId,
              userId: session.user.id,
              balance: 0,
            });
        }
      }

      if (body.consequence !== undefined && body.consequence?.currencyId) {
        const existingBalance = await app.db
          .select()
          .from(schema.goalCurrencyBalances)
          .where(and(eq(schema.goalCurrencyBalances.goalId, id), eq(schema.goalCurrencyBalances.currencyId, body.consequence.currencyId)))
          .limit(1);

        if (!existingBalance.length) {
          await app.db
            .insert(schema.goalCurrencyBalances)
            .values({
              goalId: id,
              currencyId: body.consequence.currencyId,
              userId: session.user.id,
              balance: 0,
            });
        }
      }

      app.logger.info(
        {
          userId: session.user.id,
          goalId: id,
          rewardCurrencyId: updatedGoal.rewardCurrencyId,
          rewardSuccesses: updatedGoal.rewardSuccesses,
          rewardAmount: updatedGoal.rewardAmount,
          consequenceCurrencyId: updatedGoal.consequenceCurrencyId,
          consequenceFailures: updatedGoal.consequenceFailures,
          consequenceAmount: updatedGoal.consequenceAmount,
        },
        'Goal updated successfully'
      );
      return updatedGoal;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, goalId: id },
        'Failed to update goal'
      );
      throw error;
    }
  });

  // DELETE /api/goals/:id - Delete a goal
  app.fastify.delete('/api/goals/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, goalId: id }, 'Deleting goal');

    try {
      // Check if goal exists and belongs to user
      const existingGoal = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.id, id))
        .limit(1);

      if (!existingGoal.length) {
        app.logger.warn({ userId: session.user.id, goalId: id }, 'Goal not found');
        return reply.status(404).send({ error: 'Goal not found' });
      }

      if (existingGoal[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, goalId: id, ownerId: existingGoal[0].userId },
          'Unauthorized access to goal'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      await app.db.delete(schema.goals).where(eq(schema.goals.id, id));

      app.logger.info({ userId: session.user.id, goalId: id }, 'Goal deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, goalId: id },
        'Failed to delete goal'
      );
      throw error;
    }
  });

  // POST /api/goals/:id/deactivate - Toggle goal status between ACTIVE and DEACTIVATED
  app.fastify.post('/api/goals/:id/deactivate', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, goalId: id }, 'Toggling goal deactivation');

    try {
      // Check if goal exists and belongs to user
      const existingGoals = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.id, id))
        .limit(1);

      if (!existingGoals.length) {
        app.logger.warn({ userId: session.user.id, goalId: id }, 'Goal not found');
        return reply.status(404).send({ error: 'Goal not found' });
      }

      if (existingGoals[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, goalId: id, ownerId: existingGoals[0].userId },
          'Unauthorized access to goal'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const currentStatus = existingGoals[0].status || 'ACTIVE';
      const newStatus = currentStatus === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';

      const updatedGoals = await app.db
        .update(schema.goals)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(schema.goals.id, id))
        .returning();

      app.logger.info(
        { userId: session.user.id, goalId: id, newStatus },
        'Goal status toggled successfully'
      );
      return updatedGoals[0];
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, goalId: id },
        'Failed to toggle goal deactivation'
      );
      throw error;
    }
  });

  // GET /api/goals/:id/activations - Get upcoming activations for a goal
  app.fastify.get('/api/goals/:id/activations', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const { count, startDate } = request.query as { count?: string; startDate?: string };

    const activationCount = Math.min(parseInt(count || '10'), 30); // Max 30 activations
    const fromDate = startDate ? new Date(startDate) : new Date();

    app.logger.info({ userId: session.user.id, goalId: id, count: activationCount }, 'Fetching goal activations');

    try {
      // Get the goal
      const goals = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.id, id))
        .limit(1);

      if (!goals.length) {
        app.logger.warn({ userId: session.user.id, goalId: id }, 'Goal not found');
        return reply.status(404).send({ error: 'Goal not found' });
      }

      if (goals[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, goalId: id, ownerId: goals[0].userId },
          'Unauthorized access to goal'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const goal = goals[0];

      // Get user preferences for timezone
      const prefs = await app.db
        .select()
        .from(schema.userPreferences)
        .where(eq(schema.userPreferences.userId, session.user.id))
        .limit(1);

      const timezone = prefs[0]?.timezone || 'UTC';

      // Build schedule config from goal
      const scheduleConfig: ScheduleConfig = {
        calendarType: (goal.calendarType as any) || 'gregorian',
        recurrenceType: (goal.scheduleRecurrenceType as any) || 'daily',
        startDate: goal.startDate,
        endDate: goal.endDate,
        timezone: timezone,
        timesPerDay: goal.scheduleTimesPerDayDetails ? (typeof goal.scheduleTimesPerDayDetails === 'string' ? JSON.parse(goal.scheduleTimesPerDayDetails) : goal.scheduleTimesPerDayDetails) : undefined,
        daysOfWeek: goal.scheduleDaysOfWeek,
        weekendsOnly: goal.scheduleWeekendsOnly,
        weekdaysOnly: goal.scheduleWeekdaysOnly,
        fortnightEvenOdd: (goal.scheduleFortnightEvenOdd as any),
        monthlyDates: goal.scheduleDatesOfMonth,
        monthlyRange: goal.scheduleMonthlyRange ? (typeof goal.scheduleMonthlyRange === 'string' ? JSON.parse(goal.scheduleMonthlyRange) : goal.scheduleMonthlyRange) : undefined,
        monthlyRandomCount: goal.scheduleMonthlyRandomCount,
        nthDayOfMonth: goal.scheduleNthDayOfMonth ? (typeof goal.scheduleNthDayOfMonth === 'string' ? JSON.parse(goal.scheduleNthDayOfMonth) : goal.scheduleNthDayOfMonth) : undefined,
        yearlyMonths: goal.scheduleDateOfYearMonths,
        yearlyDatesOrRanges: goal.scheduleDatesOfYear ? (typeof goal.scheduleDatesOfYear === 'string' ? JSON.parse(goal.scheduleDatesOfYear) : goal.scheduleDatesOfYear) : undefined,
        exclusions: goal.scheduleExclusions ? (typeof goal.scheduleExclusions === 'string' ? JSON.parse(goal.scheduleExclusions) : goal.scheduleExclusions) : undefined,
      };

      // Get next activations
      const activations = getNextActivations(scheduleConfig, fromDate, activationCount);

      app.logger.info({ userId: session.user.id, goalId: id, count: activations.length }, 'Goal activations fetched successfully');
      return { goalId: id, goalTitle: goal.title, activations };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, goalId: id }, 'Failed to fetch goal activations');
      throw error;
    }
  });

  // GET /api/goals/:id/schedule-summary - Get human-readable schedule summary
  app.fastify.get('/api/goals/:id/schedule-summary', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const { occurrences } = request.query as { occurrences?: string };

    const occurrenceCount = Math.min(parseInt(occurrences || '3'), 10);

    app.logger.info({ userId: session.user.id, goalId: id }, 'Generating schedule summary');

    try {
      // Get the goal
      const goals = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.id, id))
        .limit(1);

      if (!goals.length) {
        app.logger.warn({ userId: session.user.id, goalId: id }, 'Goal not found');
        return reply.status(404).send({ error: 'Goal not found' });
      }

      if (goals[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, goalId: id, ownerId: goals[0].userId },
          'Unauthorized access to goal'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const goal = goals[0];

      // Get user preferences for timezone
      const prefs = await app.db
        .select()
        .from(schema.userPreferences)
        .where(eq(schema.userPreferences.userId, session.user.id))
        .limit(1);

      const timezone = prefs[0]?.timezone || 'UTC';

      // Build summary config from goal
      const summaryConfig = {
        scheduleType: goal.scheduleType,
        scheduleRecurrenceType: goal.scheduleRecurrenceType,
        scheduleDaysOfWeek: goal.scheduleDaysOfWeek,
        scheduleDatesOfMonth: goal.scheduleDatesOfMonth,
        scheduleNthDayOfMonth: goal.scheduleNthDayOfMonth ? (typeof goal.scheduleNthDayOfMonth === 'string' ? JSON.parse(goal.scheduleNthDayOfMonth) : goal.scheduleNthDayOfMonth) : undefined,
        scheduleMonthlyRange: goal.scheduleMonthlyRange ? (typeof goal.scheduleMonthlyRange === 'string' ? JSON.parse(goal.scheduleMonthlyRange) : goal.scheduleMonthlyRange) : undefined,
        scheduleFortnightEvenOdd: goal.scheduleFortnightEvenOdd,
        scheduleDatesOfYear: goal.scheduleDatesOfYear ? (typeof goal.scheduleDatesOfYear === 'string' ? JSON.parse(goal.scheduleDatesOfYear) : goal.scheduleDatesOfYear) : undefined,
        scheduleTimesPerDayDetails: goal.scheduleTimesPerDayDetails ? (typeof goal.scheduleTimesPerDayDetails === 'string' ? JSON.parse(goal.scheduleTimesPerDayDetails) : goal.scheduleTimesPerDayDetails) : undefined,
        scheduleWeekendsOnly: goal.scheduleWeekendsOnly,
        scheduleWeekdaysOnly: goal.scheduleWeekdaysOnly,
        calendarType: goal.calendarType,
        eventType: goal.eventType,
        timezone: timezone,
        startDate: goal.startDate,
        endDate: goal.endDate,
      };

      // Generate summary
      const summary = getScheduleSummaryWithOccurrences(summaryConfig, occurrenceCount);

      app.logger.info({ userId: session.user.id, goalId: id }, 'Schedule summary generated successfully');
      return {
        goalId: id,
        goalTitle: goal.title,
        ...summary,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, goalId: id }, 'Failed to generate schedule summary');
      throw error;
    }
  });
}
