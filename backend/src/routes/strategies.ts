import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerStrategiesRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/strategies - Get all strategies for authenticated user
  app.fastify.get('/api/strategies', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching strategies');

    try {
      const strategies = await app.db
        .select()
        .from(schema.strategies)
        .where(eq(schema.strategies.userId, session.user.id))
        .orderBy(desc(schema.strategies.createdAt));

      app.logger.info({ userId: session.user.id, count: strategies.length }, 'Strategies fetched successfully');
      return strategies;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch strategies');
      throw error;
    }
  });

  // POST /api/strategies - Create a new strategy
  app.fastify.post('/api/strategies', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as {
      name: string;
      description?: string;
      linkedGoalIds?: string[];
    };

    app.logger.info(
      { userId: session.user.id, name: body.name },
      'Creating strategy'
    );

    try {
      const strategies = await app.db
        .insert(schema.strategies)
        .values({
          userId: session.user.id,
          name: body.name,
          description: body.description || null,
          linkedGoalIds: (body.linkedGoalIds?.length ? body.linkedGoalIds : null) as string[] | null,
        })
        .returning();
      const strategy = strategies[0];

      app.logger.info({ userId: session.user.id, strategyId: strategy.id }, 'Strategy created successfully');
      return strategy;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, name: body.name },
        'Failed to create strategy'
      );
      throw error;
    }
  });

  // PUT /api/strategies/:id - Update a strategy
  app.fastify.put('/api/strategies/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      description?: string;
      linkedGoalIds?: string[];
    };

    app.logger.info({ userId: session.user.id, strategyId: id }, 'Updating strategy');

    try {
      // Check if strategy exists and belongs to user
      const existingStrategy = await app.db
        .select()
        .from(schema.strategies)
        .where(eq(schema.strategies.id, id))
        .limit(1);

      if (!existingStrategy.length) {
        app.logger.warn({ userId: session.user.id, strategyId: id }, 'Strategy not found');
        return reply.status(404).send({ error: 'Strategy not found' });
      }

      if (existingStrategy[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, strategyId: id, ownerId: existingStrategy[0].userId },
          'Unauthorized access to strategy'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description || null;
      if (body.linkedGoalIds !== undefined) updateData.linkedGoalIds = (body.linkedGoalIds?.length ? body.linkedGoalIds : null) as string[] | null;
      updateData.updatedAt = new Date();

      const updatedStrategies = await app.db
        .update(schema.strategies)
        .set(updateData)
        .where(eq(schema.strategies.id, id))
        .returning();
      const updatedStrategy = updatedStrategies[0];

      app.logger.info({ userId: session.user.id, strategyId: id }, 'Strategy updated successfully');
      return updatedStrategy;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, strategyId: id },
        'Failed to update strategy'
      );
      throw error;
    }
  });

  // DELETE /api/strategies/:id - Delete a strategy
  app.fastify.delete('/api/strategies/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, strategyId: id }, 'Deleting strategy');

    try {
      // Check if strategy exists and belongs to user
      const existingStrategy = await app.db
        .select()
        .from(schema.strategies)
        .where(eq(schema.strategies.id, id))
        .limit(1);

      if (!existingStrategy.length) {
        app.logger.warn({ userId: session.user.id, strategyId: id }, 'Strategy not found');
        return reply.status(404).send({ error: 'Strategy not found' });
      }

      if (existingStrategy[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, strategyId: id, ownerId: existingStrategy[0].userId },
          'Unauthorized access to strategy'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      await app.db.delete(schema.strategies).where(eq(schema.strategies.id, id));

      app.logger.info({ userId: session.user.id, strategyId: id }, 'Strategy deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, strategyId: id },
        'Failed to delete strategy'
      );
      throw error;
    }
  });
}
