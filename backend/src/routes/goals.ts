import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, asc, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';

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

      const goalWithBalances = {
        ...goal,
        rewardCurrencyBalance,
        consequenceCurrencyBalance,
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

      // Sort by status (ACTIVE first) then by title
      const goals = goalsData.sort((a, b) => {
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
      progress?: number;
      reward?: { currencyId: string; successes: number; amount: number };
      consequence?: { currencyId: string; failures: number; amount: number };
    };

    app.logger.info(
      { userId: session.user.id, title: body.title, type: body.type },
      'Creating goal'
    );

    try {
      const goals = await app.db
        .insert(schema.goals)
        .values({
          userId: session.user.id,
          title: body.title,
          description: body.description || null,
          targetDate: body.targetDate ? new Date(body.targetDate) : null,
          progress: body.progress || 0,
          parentGoalId: body.parentGoalId || null,
          lifeAreaId: body.lifeAreaId || null,
          behaviorCategories: (body.behaviorCategories?.length ? body.behaviorCategories : null) as string[] | null,
          type: body.type || 'Proactive',
          strategyIds: (body.strategyIds?.length ? body.strategyIds : null) as string[] | null,
          scheduleType: body.scheduleType || 'Always Active',
          scheduleTimesPerDay: body.scheduleTimesPerDay || null,
          rewardCurrencyId: body.reward?.currencyId || null,
          rewardSuccesses: body.reward?.successes || null,
          rewardAmount: body.reward?.amount || null,
          consequenceCurrencyId: body.consequence?.currencyId || null,
          consequenceFailures: body.consequence?.failures || null,
          consequenceAmount: body.consequence?.amount || null,
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
      completed?: boolean;
      progress?: number;
      reward?: { currencyId: string; successes: number; amount: number };
      consequence?: { currencyId: string; failures: number; amount: number };
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
}
