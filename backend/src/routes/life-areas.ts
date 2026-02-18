import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerLifeAreasRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // Helper function to calculate success percentage
  function calculateSuccessPercentage(successCount: number, struggleCount: number): { percentage: number; status: 'green' | 'red' } {
    const total = successCount + struggleCount;
    if (total === 0) {
      return { percentage: 0, status: 'red' };
    }
    const percentage = Math.round((successCount / total) * 100);
    return { percentage, status: percentage >= 50 ? 'green' : 'red' };
  }

  // Helper function to recursively calculate success stats for a life area and all descendants
  function calculateAreaStats(areaId: string, areaMap: Map<string, any>, goalMap: Map<string, any>): { successCount: number; struggleCount: number } {
    let successCount = 0;
    let struggleCount = 0;

    // Get goals directly linked to this area
    const goalsForArea = Array.from(goalMap.values()).filter(g => g.lifeAreaId === areaId && g.status === 'ACTIVE');
    for (const goal of goalsForArea) {
      successCount += goal.successCount || 0;
      struggleCount += goal.struggleCount || 0;
    }

    // Recursively add stats from children
    const area = areaMap.get(areaId);
    if (area && area.children) {
      for (const child of area.children) {
        const childStats = calculateAreaStats(child.id, areaMap, goalMap);
        successCount += childStats.successCount;
        struggleCount += childStats.struggleCount;
      }
    }

    return { successCount, struggleCount };
  }

  // GET /api/life-areas - Get all life areas organized by hierarchy
  app.fastify.get('/api/life-areas', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching life areas');

    try {
      const areas = await app.db
        .select()
        .from(schema.lifeAreas)
        .where(eq(schema.lifeAreas.userId, session.user.id))
        .orderBy(schema.lifeAreas.displayOrder);

      const goals = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.userId, session.user.id));

      // Get reflections to count successes and struggles per goal
      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(eq(schema.reflections.userId, session.user.id));

      // Calculate success/struggle counts for each goal
      const goalMap = new Map<string, any>();
      for (const goal of goals) {
        let successCount = 0;
        let struggleCount = 0;
        for (const reflection of reflections) {
          if (reflection.linkedGoalId === goal.id) {
            if (reflection.outcome === 'success') successCount++;
            else if (reflection.outcome === 'struggled') struggleCount++;
          }
        }
        goalMap.set(goal.id, {
          id: goal.id,
          title: goal.title,
          status: goal.status || 'ACTIVE',
          successCount,
          struggleCount,
          lifeAreaId: goal.lifeAreaId,
        });
      }

      // Build hierarchy structure with children and goals
      const areaMap = new Map(areas.map(a => [a.id, {
        id: a.id,
        name: a.name,
        parentId: a.parentId,
        icon: a.icon,
        color: a.color,
        displayOrder: a.displayOrder,
        showProgress: a.showProgress,
        children: [] as any[],
        goals: [] as any[],
        successPercentage: 0,
        successStatus: 'red' as 'red' | 'green',
      }]));

      const rootAreas = [];

      for (const area of areas) {
        if (area.parentId) {
          const parent = areaMap.get(area.parentId);
          if (parent) {
            parent.children.push(areaMap.get(area.id)!);
          }
        } else {
          rootAreas.push(areaMap.get(area.id)!);
        }
      }

      // Add goals and calculate success stats for each area
      for (const [areaId, areaNode] of areaMap.entries()) {
        areaNode.goals = Array.from(goalMap.values()).filter(g => g.lifeAreaId === areaId);
        const stats = calculateAreaStats(areaId, areaMap, goalMap);
        const { percentage, status } = calculateSuccessPercentage(stats.successCount, stats.struggleCount);
        areaNode.successPercentage = percentage;
        areaNode.successStatus = status;
      }

      app.logger.info({ userId: session.user.id, count: rootAreas.length }, 'Life areas fetched successfully');
      return rootAreas;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch life areas');
      throw error;
    }
  });

  // POST /api/life-areas - Create a new life area
  app.fastify.post('/api/life-areas', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as {
      name: string;
      parentId?: string;
      icon?: string;
      color?: string;
      displayOrder?: number;
      showProgress?: boolean;
    };

    app.logger.info(
      { userId: session.user.id, name: body.name },
      'Creating life area'
    );

    try {
      const areas = await app.db
        .insert(schema.lifeAreas)
        .values({
          userId: session.user.id,
          name: body.name,
          parentId: body.parentId || null,
          icon: body.icon || null,
          color: body.color || null,
          displayOrder: body.displayOrder ?? 0,
          showProgress: body.showProgress ?? true,
        })
        .returning();
      const area = areas[0];

      app.logger.info({ userId: session.user.id, areaId: area.id }, 'Life area created successfully');
      return area;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, name: body.name },
        'Failed to create life area'
      );
      throw error;
    }
  });

  // PUT /api/life-areas/:id - Update a life area
  app.fastify.put('/api/life-areas/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      parentId?: string;
      icon?: string;
      color?: string;
      displayOrder?: number;
      showProgress?: boolean;
    };

    app.logger.info({ userId: session.user.id, areaId: id }, 'Updating life area');

    try {
      // Check if area exists and belongs to user
      const existingArea = await app.db
        .select()
        .from(schema.lifeAreas)
        .where(eq(schema.lifeAreas.id, id))
        .limit(1);

      if (!existingArea.length) {
        app.logger.warn({ userId: session.user.id, areaId: id }, 'Life area not found');
        return reply.status(404).send({ error: 'Life area not found' });
      }

      if (existingArea[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, areaId: id, ownerId: existingArea[0].userId },
          'Unauthorized access to life area'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.parentId !== undefined) updateData.parentId = body.parentId || null;
      if (body.icon !== undefined) updateData.icon = body.icon || null;
      if (body.color !== undefined) updateData.color = body.color || null;
      if (body.displayOrder !== undefined) updateData.displayOrder = body.displayOrder;
      if (body.showProgress !== undefined) updateData.showProgress = body.showProgress;
      updateData.updatedAt = new Date();

      const updatedAreas = await app.db
        .update(schema.lifeAreas)
        .set(updateData)
        .where(eq(schema.lifeAreas.id, id))
        .returning();
      const updatedArea = updatedAreas[0];

      app.logger.info({ userId: session.user.id, areaId: id }, 'Life area updated successfully');
      return updatedArea;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, areaId: id },
        'Failed to update life area'
      );
      throw error;
    }
  });

  // DELETE /api/life-areas/:id - Delete a life area
  app.fastify.delete('/api/life-areas/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, areaId: id }, 'Deleting life area');

    try {
      // Check if area exists and belongs to user
      const existingArea = await app.db
        .select()
        .from(schema.lifeAreas)
        .where(eq(schema.lifeAreas.id, id))
        .limit(1);

      if (!existingArea.length) {
        app.logger.warn({ userId: session.user.id, areaId: id }, 'Life area not found');
        return reply.status(404).send({ error: 'Life area not found' });
      }

      if (existingArea[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, areaId: id, ownerId: existingArea[0].userId },
          'Unauthorized access to life area'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Set children's parentId to null when deleting
      await app.db
        .update(schema.lifeAreas)
        .set({ parentId: null })
        .where(eq(schema.lifeAreas.parentId, id));

      await app.db.delete(schema.lifeAreas).where(eq(schema.lifeAreas.id, id));

      app.logger.info({ userId: session.user.id, areaId: id }, 'Life area deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, areaId: id },
        'Failed to delete life area'
      );
      throw error;
    }
  });

  // PUT /api/life-areas/reorder - Reorder multiple life areas
  app.fastify.put('/api/life-areas/reorder', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as {
      lifeAreaIds: string[];
    };

    app.logger.info({ userId: session.user.id, count: body.lifeAreaIds.length }, 'Reordering life areas');

    try {
      // Verify all areas belong to user
      const areas = await app.db
        .select()
        .from(schema.lifeAreas)
        .where(and(
          eq(schema.lifeAreas.userId, session.user.id),
        ));

      const areaSet = new Set(areas.map(a => a.id));
      for (const areaId of body.lifeAreaIds) {
        if (!areaSet.has(areaId)) {
          app.logger.warn({ userId: session.user.id, areaId }, 'Area not found or unauthorized');
          return reply.status(404).send({ error: 'Area not found' });
        }
      }

      // Update display_order based on array position
      for (let i = 0; i < body.lifeAreaIds.length; i++) {
        await app.db
          .update(schema.lifeAreas)
          .set({ displayOrder: i, updatedAt: new Date() })
          .where(eq(schema.lifeAreas.id, body.lifeAreaIds[i]));
      }

      app.logger.info({ userId: session.user.id, count: body.lifeAreaIds.length }, 'Life areas reordered successfully');
      return { success: true };
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id },
        'Failed to reorder life areas'
      );
      throw error;
    }
  });

  // POST /api/life-areas/:id/goals - Link a goal to a life area
  app.fastify.post('/api/life-areas/:id/goals', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as {
      goalId: string;
    };

    app.logger.info({ userId: session.user.id, areaId: id, goalId: body.goalId }, 'Linking goal to life area');

    try {
      // Check if area exists and belongs to user
      const area = await app.db
        .select()
        .from(schema.lifeAreas)
        .where(eq(schema.lifeAreas.id, id))
        .limit(1);

      if (!area.length) {
        app.logger.warn({ userId: session.user.id, areaId: id }, 'Life area not found');
        return reply.status(404).send({ error: 'Life area not found' });
      }

      if (area[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, areaId: id, ownerId: area[0].userId },
          'Unauthorized access to life area'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Check if goal exists and belongs to user
      const goal = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.id, body.goalId))
        .limit(1);

      if (!goal.length) {
        app.logger.warn({ userId: session.user.id, goalId: body.goalId }, 'Goal not found');
        return reply.status(404).send({ error: 'Goal not found' });
      }

      if (goal[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, goalId: body.goalId, ownerId: goal[0].userId },
          'Unauthorized access to goal'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Link goal to life area
      await app.db
        .update(schema.goals)
        .set({ lifeAreaId: id, updatedAt: new Date() })
        .where(eq(schema.goals.id, body.goalId));

      app.logger.info({ userId: session.user.id, areaId: id, goalId: body.goalId }, 'Goal linked to life area successfully');
      return { success: true };
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, areaId: id, goalId: body.goalId },
        'Failed to link goal to life area'
      );
      throw error;
    }
  });

  // DELETE /api/life-areas/:id/goals/:goalId - Unlink a goal from a life area
  app.fastify.delete('/api/life-areas/:id/goals/:goalId', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id, goalId } = request.params as { id: string; goalId: string };

    app.logger.info({ userId: session.user.id, areaId: id, goalId }, 'Unlinking goal from life area');

    try {
      // Check if area exists and belongs to user
      const area = await app.db
        .select()
        .from(schema.lifeAreas)
        .where(eq(schema.lifeAreas.id, id))
        .limit(1);

      if (!area.length) {
        app.logger.warn({ userId: session.user.id, areaId: id }, 'Life area not found');
        return reply.status(404).send({ error: 'Life area not found' });
      }

      if (area[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, areaId: id, ownerId: area[0].userId },
          'Unauthorized access to life area'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Check if goal exists and belongs to user
      const goal = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.id, goalId))
        .limit(1);

      if (!goal.length) {
        app.logger.warn({ userId: session.user.id, goalId }, 'Goal not found');
        return reply.status(404).send({ error: 'Goal not found' });
      }

      if (goal[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, goalId, ownerId: goal[0].userId },
          'Unauthorized access to goal'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Unlink goal from life area
      await app.db
        .update(schema.goals)
        .set({ lifeAreaId: null, updatedAt: new Date() })
        .where(eq(schema.goals.id, goalId));

      app.logger.info({ userId: session.user.id, areaId: id, goalId }, 'Goal unlinked from life area successfully');
      return { success: true };
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, areaId: id, goalId },
        'Failed to unlink goal from life area'
      );
      throw error;
    }
  });
}
