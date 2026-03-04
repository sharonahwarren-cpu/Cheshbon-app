import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { createAuthWrapper } from '../utils/auth-wrapper.js';

// Helper function to check if a goal is active on a specific date
function isGoalActiveOnDateHelper(goal: any, dateStr: string): boolean {
  if (goal.scheduleType === 'Always Active') return true;

  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  const dateOfMonth = date.getDate();
  const month = date.getMonth() + 1;

  switch (goal.scheduleType) {
    case 'Daily':
      return true;

    case 'Weekly':
      if (goal.scheduleDaysOfWeek && Array.isArray(goal.scheduleDaysOfWeek) && goal.scheduleDaysOfWeek.length > 0) {
        return goal.scheduleDaysOfWeek.includes(dayOfWeek);
      }
      return false;

    case 'Fortnightly':
      if (goal.scheduleDaysOfWeek && Array.isArray(goal.scheduleDaysOfWeek) && goal.scheduleDaysOfWeek.length > 0) {
        return goal.scheduleDaysOfWeek.includes(dayOfWeek);
      }
      return false;

    case 'Monthly':
      if (goal.scheduleDatesOfMonth && Array.isArray(goal.scheduleDatesOfMonth)) {
        return goal.scheduleDatesOfMonth.includes(dateOfMonth);
      }
      return true;

    case 'Yearly':
      if (goal.scheduleDatesOfYear && Array.isArray(goal.scheduleDatesOfYear)) {
        return goal.scheduleDatesOfYear.some((dateRange: any) => {
          const startMonth = dateRange.month;
          const startDay = dateRange.day;
          const endMonth = dateRange.endMonth || startMonth;
          const endDay = dateRange.endDay || startDay;

          // Check if current date is within range
          const currentMonthDay = month * 100 + dateOfMonth;
          const startMonthDay = startMonth * 100 + startDay;
          const endMonthDay = endMonth * 100 + endDay;

          if (startMonthDay <= endMonthDay) {
            return currentMonthDay >= startMonthDay && currentMonthDay <= endMonthDay;
          } else {
            // Range wraps around year (e.g., Nov to Feb)
            return currentMonthDay >= startMonthDay || currentMonthDay <= endMonthDay;
          }
        });
      }
      return true;

    default:
      return false;
  }
}

// Helper function to check if a goal is active today
function isGoalActiveTodayHelper(goal: any): boolean {
  const today = new Date().toISOString().split('T')[0];
  return isGoalActiveOnDateHelper(goal, today);
}

// Helper function to calculate streak for a goal
function calculateStreak(goal: any, reflections: any[], fromDate?: string): number {
  const successDates = reflections
    .filter(r => r.linkedGoalId === goal.id && r.outcome === 'success')
    .map(r => r.entryDate)
    .filter((date, index, self) => self.indexOf(date) === index) // Get unique dates
    .sort();

  if (successDates.length === 0) return 0;

  const today = new Date().toISOString().split('T')[0];
  const requestedDate = fromDate || today;

  // If the requested date is in the future, calculate streak only up to today
  const calcFromDate = requestedDate > today ? today : requestedDate;

  let currentDate = new Date(calcFromDate);
  currentDate.setUTCHours(0, 0, 0, 0);

  if (goal.scheduleType === 'Always Active') {
    // For always active goals, count consecutive days with success
    let streak = 0;

    for (let i = 0; i < 365; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (successDates.includes(dateStr)) {
        streak++;
      } else {
        break;
      }
      currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
  }

  // For scheduled goals, count consecutive periods with success
  const scheduleType = goal.scheduleType;
  let streak = 0;

  for (let i = 0; i < 365; i++) {
    const dateStr = currentDate.toISOString().split('T')[0];

    // Check if goal was scheduled on this date
    if (isGoalActiveOnDateHelper(goal, dateStr)) {
      // Check if there's a success on this date
      if (successDates.includes(dateStr)) {
        streak++;
      } else {
        break;
      }
    }

    // Move to previous period based on schedule type
    if (scheduleType === 'Daily') {
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (scheduleType === 'Weekly') {
      currentDate.setDate(currentDate.getDate() - 7);
    } else if (scheduleType === 'Fortnightly') {
      currentDate.setDate(currentDate.getDate() - 14);
    } else if (scheduleType === 'Monthly') {
      currentDate.setMonth(currentDate.getMonth() - 1);
    } else if (scheduleType === 'Yearly') {
      currentDate.setFullYear(currentDate.getFullYear() - 1);
    }
  }

  return streak;
}

export function registerGoalsTrackingRoutes(app: App) {
  const requireAuth = createAuthWrapper(app);

  // GET /api/goals/activated-today - Get goals that are active for today
  app.fastify.get('/api/goals/activated-today', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    app.logger.info({ path: request.url }, 'GET /api/goals/activated-today requested');

    const session = await requireAuth(request, reply);

    // Check authentication result
    if (!session) {
      if (!reply.sent) {
        app.logger.warn({ path: request.url }, 'Authentication failed');
        return reply.status(401).send({ error: 'Unauthorized' });
      }
      return;
    }

    const { date } = request.query as { date?: string };

    // Use provided date or default to today
    const requestedDate = date || new Date().toISOString().split('T')[0];

    app.logger.info(
      { userId: session.user.id, requestedDate },
      'Fetching goals activated for date'
    );

    try {
      const goals = await app.db
        .select()
        .from(schema.goals)
        .where(and(eq(schema.goals.userId, session.user.id), eq(schema.goals.isActive, true)));

      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(eq(schema.reflections.userId, session.user.id));

      const lifeAreasData = await app.db
        .select()
        .from(schema.lifeAreas)
        .where(eq(schema.lifeAreas.userId, session.user.id));

      const lifeAreaMap = new Map(lifeAreasData.map(la => [la.id, la]));

      // Get today's date for comparison
      const today = new Date().toISOString().split('T')[0];
      const isRequestedDateToday = requestedDate === today;

      // Filter goals that are active on the requested date
      const activatedToday = goals
        .filter(goal => isGoalActiveOnDateHelper(goal, requestedDate))
        .map(goal => {
          // Count successes and struggles for the requested date, and build dailyEntries array
          let todaySuccessCount = 0;
          let todayStruggleCount = 0;
          // Count total successes and struggles across all dates
          let totalSuccessCount = 0;
          let totalStruggleCount = 0;
          const dailyEntries: Array<{ id: string; type: 'success' | 'struggle'; timestamp: string }> = [];

          for (const reflection of reflections) {
            if (reflection.linkedGoalId === goal.id) {
              if (reflection.outcome === 'success') {
                totalSuccessCount++;
                if (reflection.entryDate === requestedDate) {
                  todaySuccessCount++;
                  // Add to dailyEntries with timestamp (use createdAt for timestamp)
                  dailyEntries.push({
                    id: reflection.id,
                    type: 'success',
                    timestamp: reflection.createdAt instanceof Date
                      ? reflection.createdAt.toISOString()
                      : new Date(reflection.createdAt).toISOString(),
                  });
                }
              } else if (reflection.outcome === 'struggled') {
                totalStruggleCount++;
                if (reflection.entryDate === requestedDate) {
                  todayStruggleCount++;
                  dailyEntries.push({
                    id: reflection.id,
                    type: 'struggle',
                    timestamp: reflection.createdAt instanceof Date
                      ? reflection.createdAt.toISOString()
                      : new Date(reflection.createdAt).toISOString(),
                  });
                }
              }
            }
          }

          // Sort dailyEntries by timestamp (oldest first)
          dailyEntries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

          const lifeArea = goal.lifeAreaId ? lifeAreaMap.get(goal.lifeAreaId) : null;

          // Determine if today's streak is confirmed (only relevant if requesting today)
          const confirmedToday = isRequestedDateToday ? todaySuccessCount > 0 : false;

          return {
            id: goal.id,
            title: goal.title,
            description: goal.description,
            type: goal.type === 'Restraint' ? 'RESTRAINING' : 'PROACTIVE',
            lifeArea: lifeArea
              ? { id: lifeArea.id, name: lifeArea.name }
              : null,
            behaviorCategories: goal.behaviorCategories || [],
            todaySuccessCount,
            todayStruggleCount,
            successCount: totalSuccessCount,
            struggleCount: totalStruggleCount,
            currentStreak: goal.currentStreak || 0,
            bestStreak: goal.bestStreak || 0,
            confirmedToday,
            dailyEntries,
            rewardCurrencyId: goal.rewardCurrencyId || null,
            rewardAmount: goal.rewardAmount ?? null,
            rewardSuccesses: goal.rewardSuccesses ?? null,
            consequenceCurrencyId: goal.consequenceCurrencyId || null,
            consequenceAmount: goal.consequenceAmount ?? null,
            consequenceFailures: goal.consequenceFailures ?? null,
          };
        });

      app.logger.info({ userId: session.user.id, requestedDate, count: activatedToday.length }, 'Goals activated for date fetched');
      return activatedToday;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, requestedDate }, 'Failed to fetch goals activated for date');
      throw error;
    }
  });

  // POST /api/goals/:id/success - Record a success for a goal today
  app.fastify.post('/api/goals/:id/success', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as {
      timestamp: string;
      date?: string;
      category?: string;
      type?: string;
      linkedGoalId?: string;
    };

    app.logger.info(
      { userId: session.user.id, goalId: id, timestamp: body.timestamp, date: body.date, category: body.category, type: body.type },
      'Recording goal success'
    );

    try {
      // Check if goal exists and belongs to user
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

      // Extract date from optional date field (user's local timezone), or fall back to timestamp
      const entryDate = body.date || (body.timestamp ? body.timestamp.split('T')[0] : new Date().toISOString().split('T')[0]);

      // Calculate currency change based on goal and currency settings
      let currencyChange = null;
      if (goals[0].rewardCurrencyId && goals[0].rewardAmount) {
        const currencies = await app.db
          .select()
          .from(schema.currencies)
          .where(eq(schema.currencies.id, goals[0].rewardCurrencyId))
          .limit(1);

        if (currencies.length) {
          const currency = currencies[0];
          let operation = 'add'; // Default

          if (currency.onSuccess === 'SUBTRACT') {
            operation = 'subtract';
          } else if (currency.onSuccess === 'NONE') {
            currencyChange = null;
          } else {
            operation = 'add';
          }

          if (currency.onSuccess !== 'NONE') {
            currencyChange = {
              currencyId: goals[0].rewardCurrencyId,
              amount: goals[0].rewardAmount,
              operation,
            };
          }
        }
      }

      // Create a new reflection entry for this success
      const reflections = await app.db
        .insert(schema.reflections)
        .values({
          userId: session.user.id,
          entryDate: entryDate,
          linkedGoalId: body.linkedGoalId || id,
          outcome: 'success',
          type: body.type || 'Proactive',
          category: body.category || 'Action',
          description: 'Quick success entry',
          currencyChange: currencyChange ? JSON.stringify(currencyChange) : null,
        })
        .returning();

      if (!reflections.length) {
        throw new Error('Failed to create reflection entry');
      }

      app.logger.info({ userId: session.user.id, goalId: id, reflectionId: reflections[0].id, currencyChange }, 'Reflection entry created for success');

      // Count the day's successes after creating the new entry
      const todayReflections = await app.db
        .select()
        .from(schema.reflections)
        .where(and(
          eq(schema.reflections.userId, session.user.id),
          eq(schema.reflections.linkedGoalId, id),
          eq(schema.reflections.entryDate, entryDate),
          eq(schema.reflections.outcome, 'success')
        ));

      const todaySuccessCount = todayReflections.length;

      // Count ALL successes for this goal (across all dates)
      const allSuccessReflections = await app.db
        .select()
        .from(schema.reflections)
        .where(and(
          eq(schema.reflections.userId, session.user.id),
          eq(schema.reflections.linkedGoalId, id),
          eq(schema.reflections.outcome, 'success')
        ));

      const totalSuccessCount = allSuccessReflections.length;

      // Calculate streak based on consecutive scheduled days with successes
      try {
        const allReflections = await app.db
          .select()
          .from(schema.reflections)
          .where(and(
            eq(schema.reflections.linkedGoalId, id),
            eq(schema.reflections.outcome, 'success')
          ));

        // Get unique dates and sort chronologically (oldest to newest)
        const uniqueDatesSet = new Set(allReflections.map(r => r.entryDate));
        const sortedDates = Array.from(uniqueDatesSet).sort(); // Sort ascending: oldest first

        let currentStreak = 0;
        let bestStreak = goals[0].bestStreak || 0;

        if (sortedDates.length > 0) {
          // Create a set for O(1) lookup of success dates
          const successDatesSet = new Set(sortedDates);

          // Calculate current streak: count consecutive scheduled days from most recent success backwards
          // Check EVERY day, not just days with successes
          const mostRecentSuccessDate = sortedDates[sortedDates.length - 1];
          let checkDate = new Date(mostRecentSuccessDate);
          checkDate.setUTCHours(0, 0, 0, 0);

          for (let i = 0; i < 365; i++) {
            const checkDateStr = checkDate.toISOString().split('T')[0];
            const isScheduled = isGoalActiveOnDateHelper(goals[0], checkDateStr);

            if (isScheduled) {
              // Goal is scheduled on this day
              if (successDatesSet.has(checkDateStr)) {
                // Has success on this scheduled day
                currentStreak++;
              } else {
                // Scheduled day but no success - break the streak
                break;
              }
            }
            // If not scheduled, just skip this day and continue (don't break)

            checkDate.setDate(checkDate.getDate() - 1);
          }

          // Calculate best streak: iterate through EVERY day from earliest to today
          // Count consecutive scheduled days with successes
          let tempStreak = 0;
          let maxStreak = 0;

          if (sortedDates.length > 0) {
            const earliestDate = new Date(sortedDates[0]);
            earliestDate.setUTCHours(0, 0, 0, 0);
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            let currentCheckDate = new Date(earliestDate);

            while (currentCheckDate <= today) {
              const checkDateStr = currentCheckDate.toISOString().split('T')[0];
              const isScheduled = isGoalActiveOnDateHelper(goals[0], checkDateStr);

              if (isScheduled) {
                // Goal is scheduled on this day
                if (successDatesSet.has(checkDateStr)) {
                  // Has success on this scheduled day
                  tempStreak++;
                  maxStreak = Math.max(maxStreak, tempStreak);
                } else {
                  // Scheduled day but no success - reset counter
                  tempStreak = 0;
                }
              }
              // If not scheduled, skip but don't reset counter (non-scheduled days don't break streaks)

              currentCheckDate.setDate(currentCheckDate.getDate() + 1);
            }
          }

          bestStreak = Math.max(bestStreak, maxStreak);
        }

        // Update goal with new streak values
        await app.db
          .update(schema.goals)
          .set({
            currentStreak,
            bestStreak,
            updatedAt: new Date(),
          })
          .where(eq(schema.goals.id, id));

        app.logger.info(
          { userId: session.user.id, goalId: id, entryDate, currentStreak, bestStreak, totalSuccessCount },
          'Goal streak updated on success'
        );
      } catch (error) {
        app.logger.error({ err: error, userId: session.user.id, goalId: id }, 'Failed to calculate streak on success');
        // Continue despite streak calculation error
      }

      // Check if threshold is reached for currency reward
      // Award currency for every X successes (use modulo to detect milestone)
      if (goals[0].rewardCurrencyId && goals[0].rewardSuccesses && totalSuccessCount % goals[0].rewardSuccesses === 0) {
        // Threshold reached, create a currency transaction
        const currency = await app.db
          .select()
          .from(schema.currencies)
          .where(eq(schema.currencies.id, goals[0].rewardCurrencyId))
          .limit(1);

        if (currency.length) {
          const curr = currency[0];
          let transactionAmount = goals[0].rewardAmount || 0;

          // Determine direction based on currency settings
          if (curr.onSuccess === 'SUBTRACT') {
            transactionAmount = -transactionAmount;
          } else if (curr.onSuccess === 'NONE') {
            transactionAmount = 0;
          }

          if (transactionAmount !== 0) {
            // Create currency transaction
            await app.db
              .insert(schema.currencyTransactions)
              .values({
                userId: session.user.id,
                currencyId: goals[0].rewardCurrencyId,
                goalId: id,
                reflectionId: reflections[0].id,
                amount: transactionAmount,
                transactionType: 'GOAL_REWARD',
                description: `Reached ${totalSuccessCount} successes (${totalSuccessCount / goals[0].rewardSuccesses} milestones) on goal: ${goals[0].title}`,
              });

            // Update goal_currency_balances
            const existingBalance = await app.db
              .select()
              .from(schema.goalCurrencyBalances)
              .where(and(eq(schema.goalCurrencyBalances.goalId, id), eq(schema.goalCurrencyBalances.currencyId, goals[0].rewardCurrencyId)))
              .limit(1);

            if (existingBalance.length) {
              const newBalance = existingBalance[0].balance + transactionAmount;
              await app.db
                .update(schema.goalCurrencyBalances)
                .set({ balance: newBalance, updatedAt: new Date() })
                .where(eq(schema.goalCurrencyBalances.id, existingBalance[0].id));
            } else {
              await app.db
                .insert(schema.goalCurrencyBalances)
                .values({
                  goalId: id,
                  currencyId: goals[0].rewardCurrencyId,
                  userId: session.user.id,
                  balance: transactionAmount,
                });
            }
          }
        }
      }

      // Fetch updated goal to get streak values
      const updatedGoal = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.id, id))
        .limit(1);

      const currentStreak = updatedGoal.length ? updatedGoal[0].currentStreak || 0 : 0;
      const bestStreak = updatedGoal.length ? updatedGoal[0].bestStreak || 0 : 0;

      app.logger.info({ userId: session.user.id, goalId: id, todaySuccessCount, totalSuccessCount, currentStreak, bestStreak }, 'Goal success recorded');
      return { entryId: reflections[0].id, todaySuccessCount, successCount: totalSuccessCount, currentStreak, bestStreak };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, goalId: id }, 'Failed to record goal success');
      throw error;
    }
  });

  // POST /api/goals/:id/struggle - Record a struggle for a goal today
  app.fastify.post('/api/goals/:id/struggle', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as {
      timestamp: string;
      date?: string;
      category?: string;
      type?: string;
      linkedGoalId?: string;
    };

    app.logger.info(
      { userId: session.user.id, goalId: id, timestamp: body.timestamp, date: body.date, category: body.category, type: body.type },
      'Recording goal struggle'
    );

    try {
      // Check if goal exists and belongs to user
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

      // Extract date from optional date field (user's local timezone), or fall back to timestamp
      const entryDate = body.date || (body.timestamp ? body.timestamp.split('T')[0] : new Date().toISOString().split('T')[0]);

      // Calculate currency change based on goal and currency settings
      let currencyChange = null;
      if (goals[0].consequenceCurrencyId && goals[0].consequenceAmount) {
        const currencies = await app.db
          .select()
          .from(schema.currencies)
          .where(eq(schema.currencies.id, goals[0].consequenceCurrencyId))
          .limit(1);

        if (currencies.length) {
          const currency = currencies[0];
          let operation = 'add'; // Default for debt

          if (currency.onFailure === 'SUBTRACT') {
            operation = 'subtract';
          } else if (currency.onFailure === 'NONE') {
            currencyChange = null;
          } else {
            operation = 'add';
          }

          if (currency.onFailure !== 'NONE') {
            currencyChange = {
              currencyId: goals[0].consequenceCurrencyId,
              amount: goals[0].consequenceAmount,
              operation,
            };
          }
        }
      }

      // Create a new reflection entry for this struggle
      const reflections = await app.db
        .insert(schema.reflections)
        .values({
          userId: session.user.id,
          entryDate: entryDate,
          linkedGoalId: body.linkedGoalId || id,
          outcome: 'struggled',
          type: body.type || 'Restraint',
          category: body.category || 'Action',
          description: 'Quick struggle entry',
          currencyChange: currencyChange ? JSON.stringify(currencyChange) : null,
        })
        .returning();

      if (!reflections.length) {
        throw new Error('Failed to create reflection entry');
      }

      app.logger.info({ userId: session.user.id, goalId: id, reflectionId: reflections[0].id, currencyChange }, 'Reflection entry created for struggle');

      // Count the day's struggles after creating the new entry
      const todayReflections = await app.db
        .select()
        .from(schema.reflections)
        .where(and(
          eq(schema.reflections.userId, session.user.id),
          eq(schema.reflections.linkedGoalId, id),
          eq(schema.reflections.entryDate, entryDate),
          eq(schema.reflections.outcome, 'struggled')
        ));

      const todayStruggleCount = todayReflections.length;

      // Count ALL struggles for this goal (across all dates)
      const allStruggleReflections = await app.db
        .select()
        .from(schema.reflections)
        .where(and(
          eq(schema.reflections.userId, session.user.id),
          eq(schema.reflections.linkedGoalId, id),
          eq(schema.reflections.outcome, 'struggled')
        ));

      const totalStruggleCount = allStruggleReflections.length;

      // Recalculate streaks on struggle: break streak if struggle on a scheduled day with no successes
      try {
        const successOnDate = await app.db
          .select()
          .from(schema.reflections)
          .where(and(
            eq(schema.reflections.linkedGoalId, id),
            eq(schema.reflections.entryDate, entryDate),
            eq(schema.reflections.outcome, 'success')
          ));

        // Only recalculate streak if there are no successes on this date
        if (successOnDate.length === 0) {
          // Recalculate streaks based on all success reflections
          const allSuccessReflections = await app.db
            .select()
            .from(schema.reflections)
            .where(and(
              eq(schema.reflections.linkedGoalId, id),
              eq(schema.reflections.outcome, 'success')
            ));

          const uniqueDatesSet = new Set(allSuccessReflections.map(r => r.entryDate));
          const sortedDates = Array.from(uniqueDatesSet).sort(); // Sort ascending: oldest first

          let currentStreak = 0;
          let bestStreak = goals[0].bestStreak || 0;

          if (sortedDates.length > 0) {
            // Create a set for O(1) lookup of success dates
            const successDatesSet = new Set(sortedDates);

            // Calculate current streak: count consecutive scheduled days from most recent success backwards
            // Check EVERY day, not just days with successes
            const mostRecentSuccessDate = sortedDates[sortedDates.length - 1];
            let checkDate = new Date(mostRecentSuccessDate);
            checkDate.setUTCHours(0, 0, 0, 0);

            for (let i = 0; i < 365; i++) {
              const checkDateStr = checkDate.toISOString().split('T')[0];
              const isScheduled = isGoalActiveOnDateHelper(goals[0], checkDateStr);

              if (isScheduled) {
                // Goal is scheduled on this day
                if (successDatesSet.has(checkDateStr)) {
                  // Has success on this scheduled day
                  currentStreak++;
                } else {
                  // Scheduled day but no success - break the streak
                  break;
                }
              }
              // If not scheduled, just skip this day and continue

              checkDate.setDate(checkDate.getDate() - 1);
            }

            // Calculate best streak: iterate through EVERY day from earliest to today
            // Count consecutive scheduled days with successes
            let tempStreak = 0;
            let maxStreak = 0;

            const earliestDate = new Date(sortedDates[0]);
            earliestDate.setUTCHours(0, 0, 0, 0);
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            let currentCheckDate = new Date(earliestDate);

            while (currentCheckDate <= today) {
              const checkDateStr = currentCheckDate.toISOString().split('T')[0];
              const isScheduled = isGoalActiveOnDateHelper(goals[0], checkDateStr);

              if (isScheduled) {
                // Goal is scheduled on this day
                if (successDatesSet.has(checkDateStr)) {
                  // Has success on this scheduled day
                  tempStreak++;
                  maxStreak = Math.max(maxStreak, tempStreak);
                } else {
                  // Scheduled day but no success - reset counter
                  tempStreak = 0;
                }
              }
              // If not scheduled, skip but don't reset counter

              currentCheckDate.setDate(currentCheckDate.getDate() + 1);
            }

            bestStreak = Math.max(bestStreak, maxStreak);
          }

          // Update goal with recalculated streak values
          await app.db
            .update(schema.goals)
            .set({
              currentStreak,
              bestStreak,
              updatedAt: new Date(),
            })
            .where(eq(schema.goals.id, id));

          app.logger.info(
            { userId: session.user.id, goalId: id, entryDate, currentStreak, bestStreak },
            'Goal streaks recalculated on struggle'
          );
        }
      } catch (error) {
        app.logger.error({ err: error, userId: session.user.id, goalId: id }, 'Failed to recalculate streak on struggle');
        // Continue despite streak calculation error
      }

      // Check if threshold is reached for currency consequence
      // Apply consequence for every X failures (use modulo to detect milestone)
      if (goals[0].consequenceCurrencyId && goals[0].consequenceFailures && totalStruggleCount % goals[0].consequenceFailures === 0) {
        // Threshold reached, create a currency transaction
        const currency = await app.db
          .select()
          .from(schema.currencies)
          .where(eq(schema.currencies.id, goals[0].consequenceCurrencyId))
          .limit(1);

        if (currency.length) {
          const curr = currency[0];
          let transactionAmount = goals[0].consequenceAmount || 0;

          // Determine direction based on currency settings
          if (curr.onFailure === 'SUBTRACT') {
            transactionAmount = -transactionAmount;
          } else if (curr.onFailure === 'NONE') {
            transactionAmount = 0;
          }

          if (transactionAmount !== 0) {
            // Create currency transaction
            await app.db
              .insert(schema.currencyTransactions)
              .values({
                userId: session.user.id,
                currencyId: goals[0].consequenceCurrencyId,
                goalId: id,
                reflectionId: reflections[0].id,
                amount: transactionAmount,
                transactionType: 'GOAL_CONSEQUENCE',
                description: `Reached ${totalStruggleCount} struggles (${totalStruggleCount / goals[0].consequenceFailures} milestones) on goal: ${goals[0].title}`,
              });

            // Update goal_currency_balances
            const existingBalance = await app.db
              .select()
              .from(schema.goalCurrencyBalances)
              .where(and(eq(schema.goalCurrencyBalances.goalId, id), eq(schema.goalCurrencyBalances.currencyId, goals[0].consequenceCurrencyId)))
              .limit(1);

            if (existingBalance.length) {
              const newBalance = existingBalance[0].balance + transactionAmount;
              await app.db
                .update(schema.goalCurrencyBalances)
                .set({ balance: newBalance, updatedAt: new Date() })
                .where(eq(schema.goalCurrencyBalances.id, existingBalance[0].id));
            } else {
              await app.db
                .insert(schema.goalCurrencyBalances)
                .values({
                  goalId: id,
                  currencyId: goals[0].consequenceCurrencyId,
                  userId: session.user.id,
                  balance: transactionAmount,
                });
            }
          }
        }
      }

      // Fetch updated goal to get streak values
      const updatedGoal = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.id, id))
        .limit(1);

      const currentStreak = updatedGoal.length ? updatedGoal[0].currentStreak || 0 : 0;
      const bestStreak = updatedGoal.length ? updatedGoal[0].bestStreak || 0 : 0;

      app.logger.info({ userId: session.user.id, goalId: id, todayStruggleCount, totalStruggleCount, currentStreak, bestStreak }, 'Goal struggle recorded');
      return { entryId: reflections[0].id, todayStruggleCount, struggleCount: totalStruggleCount, currentStreak, bestStreak };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, goalId: id }, 'Failed to record goal struggle');
      throw error;
    }
  });

  // DELETE /api/goals/:goalId/entries/:entryId - Delete a specific success/struggle entry for a goal
  app.fastify.delete('/api/goals/:goalId/entries/:entryId', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { goalId, entryId } = request.params as { goalId: string; entryId: string };

    app.logger.info({ userId: session.user.id, goalId, entryId }, 'Deleting goal entry');

    try {
      // Check if goal exists and belongs to user
      const goals = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.id, goalId))
        .limit(1);

      if (!goals.length) {
        app.logger.warn({ userId: session.user.id, goalId }, 'Goal not found');
        return reply.status(404).send({ error: 'Goal not found' });
      }

      if (goals[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, goalId, ownerId: goals[0].userId },
          'Unauthorized access to goal'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Check if entry exists and belongs to this goal
      const entries = await app.db
        .select()
        .from(schema.reflections)
        .where(and(
          eq(schema.reflections.id, entryId),
          eq(schema.reflections.userId, session.user.id),
          eq(schema.reflections.linkedGoalId, goalId)
        ))
        .limit(1);

      if (!entries.length) {
        app.logger.warn({ userId: session.user.id, goalId, entryId }, 'Entry not found or does not belong to this goal');
        return reply.status(404).send({ error: 'Entry not found' });
      }

      // Delete the reflection entry
      await app.db
        .delete(schema.reflections)
        .where(eq(schema.reflections.id, entryId));

      app.logger.info({ userId: session.user.id, goalId, entryId }, 'Goal entry deleted successfully');

      // Recalculate streaks after deletion
      try {
        const allSuccessReflections = await app.db
          .select()
          .from(schema.reflections)
          .where(and(
            eq(schema.reflections.linkedGoalId, goalId),
            eq(schema.reflections.outcome, 'success')
          ));

        const uniqueDatesSet = new Set(allSuccessReflections.map(r => r.entryDate));
        const sortedDates = Array.from(uniqueDatesSet).sort(); // Sort ascending: oldest first

        let currentStreak = 0;
        let bestStreak = goals[0].bestStreak || 0;

        if (sortedDates.length > 0) {
          // Create a set for O(1) lookup of success dates
          const successDatesSet = new Set(sortedDates);

          // Calculate current streak: count consecutive scheduled days from most recent success backwards
          // Check EVERY day, not just days with successes
          const mostRecentSuccessDate = sortedDates[sortedDates.length - 1];
          let checkDate = new Date(mostRecentSuccessDate);
          checkDate.setUTCHours(0, 0, 0, 0);

          for (let i = 0; i < 365; i++) {
            const checkDateStr = checkDate.toISOString().split('T')[0];
            const isScheduled = isGoalActiveOnDateHelper(goals[0], checkDateStr);

            if (isScheduled) {
              // Goal is scheduled on this day
              if (successDatesSet.has(checkDateStr)) {
                // Has success on this scheduled day
                currentStreak++;
              } else {
                // Scheduled day but no success - break the streak
                break;
              }
            }
            // If not scheduled, just skip this day and continue (don't break)

            checkDate.setDate(checkDate.getDate() - 1);
          }

          // Calculate best streak: iterate through EVERY day from earliest to today
          // Count consecutive scheduled days with successes
          let tempStreak = 0;
          let maxStreak = 0;

          const earliestDate = new Date(sortedDates[0]);
          earliestDate.setUTCHours(0, 0, 0, 0);
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);

          let currentCheckDate = new Date(earliestDate);

          while (currentCheckDate <= today) {
            const checkDateStr = currentCheckDate.toISOString().split('T')[0];
            const isScheduled = isGoalActiveOnDateHelper(goals[0], checkDateStr);

            if (isScheduled) {
              // Goal is scheduled on this day
              if (successDatesSet.has(checkDateStr)) {
                // Has success on this scheduled day
                tempStreak++;
                maxStreak = Math.max(maxStreak, tempStreak);
              } else {
                // Scheduled day but no success - reset counter
                tempStreak = 0;
              }
            }
            // If not scheduled, skip but don't reset counter

            currentCheckDate.setDate(currentCheckDate.getDate() + 1);
          }

          bestStreak = Math.max(bestStreak, maxStreak);
        } else {
          // No successes remaining after deletion
          currentStreak = 0;
          bestStreak = 0;
        }

        // Update goal with recalculated streak values
        await app.db
          .update(schema.goals)
          .set({
            currentStreak,
            bestStreak,
            updatedAt: new Date(),
          })
          .where(eq(schema.goals.id, goalId));

        app.logger.info(
          { userId: session.user.id, goalId, entryId, currentStreak, bestStreak },
          'Goal streaks recalculated after deletion'
        );

        return { success: true, currentStreak, bestStreak };
      } catch (error) {
        app.logger.error({ err: error, userId: session.user.id, goalId, entryId }, 'Failed to recalculate streak after deletion');
        // Still return success but log the error
        return { success: true, currentStreak: goals[0].currentStreak || 0, bestStreak: goals[0].bestStreak || 0 };
      }
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, goalId, entryId }, 'Failed to delete goal entry');
      throw error;
    }
  });
}
