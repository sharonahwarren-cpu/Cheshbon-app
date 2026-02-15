import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerLifeAreasRoutes(app: App) {
  const requireAuth = app.requireAuth();

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
        .orderBy(schema.lifeAreas.level, desc(schema.lifeAreas.createdAt));

      // Build hierarchy structure
      const areaMap = new Map(areas.map(a => [a.id, { ...a, children: [] }]));
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
      level: number;
    };

    app.logger.info(
      { userId: session.user.id, name: body.name, level: body.level },
      'Creating life area'
    );

    try {
      const areas = await app.db
        .insert(schema.lifeAreas)
        .values({
          userId: session.user.id,
          name: body.name,
          parentId: body.parentId || null,
          level: body.level,
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
}
