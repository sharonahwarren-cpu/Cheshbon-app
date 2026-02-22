import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerGainsLossesRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/gains-losses - Get all gains and losses for authenticated user
  app.fastify.get('/api/gains-losses', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching gains and losses');

    try {
      const items = await app.db
        .select()
        .from(schema.gainsLosses)
        .where(eq(schema.gainsLosses.userId, session.user.id))
        .orderBy(desc(schema.gainsLosses.createdAt));

      const convertToISO = (date: Date | null) => date ? (date instanceof Date ? date.toISOString() : new Date(date).toISOString()) : null;
      const itemsWithDates = items.map(item => ({
        ...item,
        createdAt: convertToISO(item.createdAt),
        updatedAt: convertToISO(item.updatedAt),
      }));

      app.logger.info({ userId: session.user.id, count: itemsWithDates.length }, 'Gains and losses fetched successfully');
      return itemsWithDates;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch gains and losses');
      throw error;
    }
  });

  // POST /api/gains-losses - Create a new gain or loss
  app.fastify.post('/api/gains-losses', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as {
      name: string;
      type: string;
      category?: string;
      subCategory?: string;
    };

    if (!body.name || !body.type) {
      app.logger.warn({ userId: session.user.id }, 'Missing required fields in POST gains/losses');
      return reply.status(400).send({ error: 'Missing required fields: name and type' });
    }

    app.logger.info(
      { userId: session.user.id, name: body.name, type: body.type },
      'Creating gain/loss'
    );

    try {
      const items = await app.db
        .insert(schema.gainsLosses)
        .values({
          userId: session.user.id,
          name: body.name,
          type: body.type,
          category: body.category || null,
          subCategory: body.subCategory || null,
        })
        .returning();
      const item = items[0];

      const convertToISO = (date: Date | null) => date ? (date instanceof Date ? date.toISOString() : new Date(date).toISOString()) : null;
      const itemWithDates = {
        ...item,
        createdAt: convertToISO(item.createdAt),
        updatedAt: convertToISO(item.updatedAt),
      };

      app.logger.info({ userId: session.user.id, itemId: item.id }, 'Gain/loss created successfully');
      return itemWithDates;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, name: body.name },
        'Failed to create gain/loss'
      );
      throw error;
    }
  });

  // PUT /api/gains-losses/:id - Update a gain or loss
  app.fastify.put('/api/gains-losses/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      type?: string;
      category?: string;
      subCategory?: string;
    };

    app.logger.info({ userId: session.user.id, itemId: id }, 'Updating gain/loss');

    try {
      // Check if item exists and belongs to user
      const existingItems = await app.db
        .select()
        .from(schema.gainsLosses)
        .where(eq(schema.gainsLosses.id, id))
        .limit(1);

      if (!existingItems.length) {
        app.logger.warn({ userId: session.user.id, itemId: id }, 'Gain/loss not found');
        return reply.status(404).send({ error: 'Gain/loss not found' });
      }

      if (existingItems[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, itemId: id, ownerId: existingItems[0].userId },
          'Unauthorized access to gain/loss'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.type !== undefined) updateData.type = body.type;
      if (body.category !== undefined) updateData.category = body.category || null;
      if (body.subCategory !== undefined) updateData.subCategory = body.subCategory || null;
      updateData.updatedAt = new Date();

      const updatedItems = await app.db
        .update(schema.gainsLosses)
        .set(updateData)
        .where(eq(schema.gainsLosses.id, id))
        .returning();
      const updatedItem = updatedItems[0];

      const convertToISO = (date: Date | null) => date ? (date instanceof Date ? date.toISOString() : new Date(date).toISOString()) : null;
      const itemWithDates = {
        ...updatedItem,
        createdAt: convertToISO(updatedItem.createdAt),
        updatedAt: convertToISO(updatedItem.updatedAt),
      };

      app.logger.info({ userId: session.user.id, itemId: id }, 'Gain/loss updated successfully');
      return itemWithDates;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, itemId: id },
        'Failed to update gain/loss'
      );
      throw error;
    }
  });

  // DELETE /api/gains-losses/:id - Delete a gain or loss
  app.fastify.delete('/api/gains-losses/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, itemId: id }, 'Deleting gain/loss');

    try {
      // Check if item exists and belongs to user
      const existingItems = await app.db
        .select()
        .from(schema.gainsLosses)
        .where(eq(schema.gainsLosses.id, id))
        .limit(1);

      if (!existingItems.length) {
        app.logger.warn({ userId: session.user.id, itemId: id }, 'Gain/loss not found');
        return reply.status(404).send({ error: 'Gain/loss not found' });
      }

      if (existingItems[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, itemId: id, ownerId: existingItems[0].userId },
          'Unauthorized access to gain/loss'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      await app.db.delete(schema.gainsLosses).where(eq(schema.gainsLosses.id, id));

      app.logger.info({ userId: session.user.id, itemId: id }, 'Gain/loss deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, itemId: id },
        'Failed to delete gain/loss'
      );
      throw error;
    }
  });
}
