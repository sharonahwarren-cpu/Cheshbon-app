import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerGoalRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/goals - Get all goals for authenticated user
  app.fastify.get('/api/goals', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching goals');

    try {
      const goals = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.userId, session.user.id))
        .orderBy(desc(schema.goals.createdAt));

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
      targetDate?: string;
      progress?: number;
    };

    app.logger.info(
      { userId: session.user.id, title: body.title, progress: body.progress },
      'Creating goal'
    );

    try {
      const [goal] = await app.db
        .insert(schema.goals)
        .values({
          userId: session.user.id,
          title: body.title,
          description: body.description || null,
          targetDate: body.targetDate ? new Date(body.targetDate) : null,
          progress: body.progress || 0,
        })
        .returning();

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
      targetDate?: string;
      completed?: boolean;
      progress?: number;
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
      if (body.targetDate !== undefined) updateData.targetDate = body.targetDate ? new Date(body.targetDate) : null;
      if (body.completed !== undefined) updateData.completed = body.completed;
      if (body.progress !== undefined) updateData.progress = body.progress;
      updateData.updatedAt = new Date();

      const [updatedGoal] = await app.db
        .update(schema.goals)
        .set(updateData)
        .where(eq(schema.goals.id, id))
        .returning();

      app.logger.info({ userId: session.user.id, goalId: id }, 'Goal updated successfully');
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
}
