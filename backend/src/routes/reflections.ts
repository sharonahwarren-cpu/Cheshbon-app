import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerReflectionsRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // Helper function to calculate currency change based on goal and outcome
  async function calculateCurrencyChange(
    goalId: string | undefined,
    outcome: string | undefined,
    db: any
  ): Promise<{ currencyId: string; amount: number; operation: string } | null> {
    if (!goalId || !outcome) return null;

    try {
      const goals = await db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.id, goalId))
        .limit(1);

      if (!goals.length) return null;
      const goal = goals[0];

      if (outcome === 'success' && goal.rewardCurrencyId && goal.rewardAmount) {
        const currencies = await db
          .select()
          .from(schema.currencies)
          .where(eq(schema.currencies.id, goal.rewardCurrencyId))
          .limit(1);

        if (currencies.length && currencies[0].onSuccess !== 'NONE') {
          return {
            currencyId: goal.rewardCurrencyId,
            amount: goal.rewardAmount,
            operation: currencies[0].onSuccess === 'ADD' ? 'add' : 'subtract',
          };
        }
      } else if (outcome === 'struggled' && goal.consequenceCurrencyId && goal.consequenceAmount) {
        const currencies = await db
          .select()
          .from(schema.currencies)
          .where(eq(schema.currencies.id, goal.consequenceCurrencyId))
          .limit(1);

        if (currencies.length && currencies[0].onFailure !== 'NONE') {
          return {
            currencyId: goal.consequenceCurrencyId,
            amount: goal.consequenceAmount,
            operation: currencies[0].onFailure === 'ADD' ? 'add' : 'subtract',
          };
        }
      }
      return null;
    } catch (error) {
      app.logger.error({ err: error, goalId }, 'Failed to calculate currency change');
      return null;
    }
  }

  // GET /api/reflections/by-date?date=YYYY-MM-DD - Get all reflections for specific date
  app.fastify.get('/api/reflections/by-date', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { date } = request.query as { date: string };

    if (!date) {
      app.logger.warn({ userId: session.user.id }, 'Missing date parameter in GET reflections by date');
      return reply.status(400).send({ error: 'Missing date parameter' });
    }

    app.logger.info({ userId: session.user.id, date }, 'Fetching reflections for date');

    try {
      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(and(
          eq(schema.reflections.userId, session.user.id),
          eq(schema.reflections.entryDate, date)
        ));

      app.logger.info({ userId: session.user.id, date, count: reflections.length }, 'Reflections retrieved');
      return reflections;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, date }, 'Failed to fetch reflections by date');
      throw error;
    }
  });

  // POST /api/reflections - Create a new reflection
  app.fastify.post('/api/reflections', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as {
      date: string;
      category?: string;
      type: string;
      description: string;
      linkedGoalId?: string;
      outcome?: string;
      gainedIds?: string[];
      lostIds?: string[];
      wasWorthIt?: boolean;
      additionalThoughts?: string;
      strategyEffectiveness?: Array<{ strategyId: string; worked: boolean }>;
    };

    if (!body.date || !body.type || !body.description) {
      app.logger.warn({ userId: session.user.id }, 'Missing required fields in POST reflection');
      return reply.status(400).send({ error: 'Missing required fields: date, type, description' });
    }

    app.logger.info(
      { userId: session.user.id, date: body.date, type: body.type, linkedGoalId: body.linkedGoalId },
      'Creating reflection'
    );

    try {
      // Calculate currency change if needed
      const currencyChange = await calculateCurrencyChange(body.linkedGoalId, body.outcome, app.db);

      const reflections = await app.db
        .insert(schema.reflections)
        .values({
          userId: session.user.id,
          entryDate: body.date,
          category: body.category || null,
          type: body.type,
          description: body.description,
          linkedGoalId: body.linkedGoalId || null,
          outcome: body.outcome || null,
          currencyChange: currencyChange ? JSON.stringify(currencyChange) : null,
          gainedIds: (body.gainedIds?.length ? body.gainedIds : null) as string[] | null,
          lostIds: (body.lostIds?.length ? body.lostIds : null) as string[] | null,
          wasWorthIt: body.wasWorthIt || null,
          additionalThoughts: body.additionalThoughts || null,
          strategyEffectiveness: body.strategyEffectiveness ? JSON.stringify(body.strategyEffectiveness) : null,
        })
        .returning();
      const reflection = reflections[0];

      // Update strategy effectiveness counts if provided
      if (body.strategyEffectiveness && body.strategyEffectiveness.length > 0) {
        for (const strategy of body.strategyEffectiveness) {
          const strategyRecord = await app.db
            .select()
            .from(schema.strategies)
            .where(eq(schema.strategies.id, strategy.strategyId))
            .limit(1);

          if (strategyRecord.length) {
            const updateData: Record<string, unknown> = {
              timesUsed: (strategyRecord[0].timesUsed || 0) + 1,
            };
            if (strategy.worked) {
              updateData.successCount = (strategyRecord[0].successCount || 0) + 1;
            } else {
              updateData.failureCount = (strategyRecord[0].failureCount || 0) + 1;
            }
            updateData.updatedAt = new Date();

            await app.db
              .update(schema.strategies)
              .set(updateData)
              .where(eq(schema.strategies.id, strategy.strategyId));
          }
        }
      }

      app.logger.info({ userId: session.user.id, reflectionId: reflection.id, date: body.date }, 'Reflection created');
      return reflection;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, date: body.date }, 'Failed to create reflection');
      throw error;
    }
  });

  // PUT /api/reflections/:id - Update a reflection
  app.fastify.put('/api/reflections/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as {
      category?: string;
      type?: string;
      description?: string;
      linkedGoalId?: string;
      outcome?: string;
      gainedIds?: string[];
      lostIds?: string[];
      wasWorthIt?: boolean;
      additionalThoughts?: string;
      strategyEffectiveness?: Array<{ strategyId: string; worked: boolean }>;
    };

    app.logger.info({ userId: session.user.id, reflectionId: id }, 'Updating reflection');

    try {
      // Check if reflection exists and belongs to user
      const existingReflections = await app.db
        .select()
        .from(schema.reflections)
        .where(eq(schema.reflections.id, id))
        .limit(1);

      if (!existingReflections.length) {
        app.logger.warn({ userId: session.user.id, reflectionId: id }, 'Reflection not found');
        return reply.status(404).send({ error: 'Reflection not found' });
      }

      if (existingReflections[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, reflectionId: id, ownerId: existingReflections[0].userId },
          'Unauthorized access to reflection'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Calculate new currency change if outcome or linked goal changed
      let currencyChange = existingReflections[0].currencyChange;
      if (body.outcome !== undefined || body.linkedGoalId !== undefined) {
        const newCurrencyChange = await calculateCurrencyChange(
          body.linkedGoalId ?? existingReflections[0].linkedGoalId,
          body.outcome ?? existingReflections[0].outcome,
          app.db
        );
        currencyChange = newCurrencyChange ? JSON.stringify(newCurrencyChange) : null;
      }

      const updateData: Record<string, unknown> = {};
      if (body.category !== undefined) updateData.category = body.category || null;
      if (body.type !== undefined) updateData.type = body.type;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.linkedGoalId !== undefined) updateData.linkedGoalId = body.linkedGoalId || null;
      if (body.outcome !== undefined) updateData.outcome = body.outcome || null;
      if (body.gainedIds !== undefined) updateData.gainedIds = (body.gainedIds?.length ? body.gainedIds : null) as string[] | null;
      if (body.lostIds !== undefined) updateData.lostIds = (body.lostIds?.length ? body.lostIds : null) as string[] | null;
      if (body.wasWorthIt !== undefined) updateData.wasWorthIt = body.wasWorthIt;
      if (body.additionalThoughts !== undefined) updateData.additionalThoughts = body.additionalThoughts || null;
      if (body.strategyEffectiveness !== undefined) updateData.strategyEffectiveness = body.strategyEffectiveness ? JSON.stringify(body.strategyEffectiveness) : null;
      updateData.currencyChange = currencyChange;
      updateData.updatedAt = new Date();

      const updatedReflections = await app.db
        .update(schema.reflections)
        .set(updateData)
        .where(eq(schema.reflections.id, id))
        .returning();
      const updatedReflection = updatedReflections[0];

      app.logger.info({ userId: session.user.id, reflectionId: id }, 'Reflection updated');
      return updatedReflection;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, reflectionId: id }, 'Failed to update reflection');
      throw error;
    }
  });

  // DELETE /api/reflections/:id - Delete a reflection
  app.fastify.delete('/api/reflections/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, reflectionId: id }, 'Deleting reflection');

    try {
      // Check if reflection exists and belongs to user
      const existingReflections = await app.db
        .select()
        .from(schema.reflections)
        .where(eq(schema.reflections.id, id))
        .limit(1);

      if (!existingReflections.length) {
        app.logger.warn({ userId: session.user.id, reflectionId: id }, 'Reflection not found');
        return reply.status(404).send({ error: 'Reflection not found' });
      }

      if (existingReflections[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, reflectionId: id, ownerId: existingReflections[0].userId },
          'Unauthorized access to reflection'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      await app.db.delete(schema.reflections).where(eq(schema.reflections.id, id));

      app.logger.info({ userId: session.user.id, reflectionId: id }, 'Reflection deleted');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, reflectionId: id }, 'Failed to delete reflection');
      throw error;
    }
  });
}
