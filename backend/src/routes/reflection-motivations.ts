import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { createAuthWrapper } from '../utils/auth-wrapper.js';

export function registerReflectionMotivationsRoutes(app: App) {
  const requireAuth = createAuthWrapper(app);

  // GET /api/reflection-motivations - Get all motivations for authenticated user
  app.fastify.get('/api/reflection-motivations', {
    schema: {
      description: 'Get all reflection motivations for the authenticated user',
      tags: ['reflection-motivations'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              userId: { type: 'string' },
              name: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching reflection motivations');

    try {
      let motivations = await app.db
        .select()
        .from(schema.reflectionMotivations)
        .where(eq(schema.reflectionMotivations.userId, session.user.id));

      // Seed default motivations if user has none
      if (motivations.length === 0) {
        app.logger.info({ userId: session.user.id }, 'No motivations found, seeding defaults');

        const defaultMotivations = [
          { userId: session.user.id, name: 'Pride' },
          { userId: session.user.id, name: 'Money' },
          { userId: session.user.id, name: 'Exhaustion' },
          { userId: session.user.id, name: 'Overwhelm' },
          { userId: session.user.id, name: 'Anger' },
        ];

        await app.db.insert(schema.reflectionMotivations).values(defaultMotivations);

        // Fetch the created motivations
        motivations = await app.db
          .select()
          .from(schema.reflectionMotivations)
          .where(eq(schema.reflectionMotivations.userId, session.user.id));
      }

      // Sort by name alphabetically
      motivations.sort((a, b) => a.name.localeCompare(b.name));

      // Convert timestamps to ISO format
      const motivationsWithDates = motivations.map(motivation => ({
        ...motivation,
        createdAt: motivation.createdAt instanceof Date ? motivation.createdAt.toISOString() : new Date(motivation.createdAt).toISOString(),
        updatedAt: motivation.updatedAt instanceof Date ? motivation.updatedAt.toISOString() : new Date(motivation.updatedAt).toISOString(),
      }));

      app.logger.info({ userId: session.user.id, count: motivationsWithDates.length }, 'Reflection motivations fetched successfully');
      return motivationsWithDates;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch reflection motivations');
      throw error;
    }
  });

  // POST /api/reflection-motivations - Create a new motivation
  app.fastify.post('/api/reflection-motivations', {
    schema: {
      description: 'Create a new reflection motivation for the authenticated user',
      tags: ['reflection-motivations'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            name: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { name } = request.body as { name: string };

    app.logger.info({ userId: session.user.id, name }, 'Creating reflection motivation');

    try {
      const created = await app.db
        .insert(schema.reflectionMotivations)
        .values({
          userId: session.user.id,
          name,
        })
        .returning();

      const motivation = created[0];
      const result = {
        ...motivation,
        createdAt: motivation.createdAt instanceof Date ? motivation.createdAt.toISOString() : new Date(motivation.createdAt).toISOString(),
        updatedAt: motivation.updatedAt instanceof Date ? motivation.updatedAt.toISOString() : new Date(motivation.updatedAt).toISOString(),
      };

      app.logger.info({ userId: session.user.id, motivationId: motivation.id, name }, 'Reflection motivation created successfully');
      return result;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, name }, 'Failed to create reflection motivation');
      throw error;
    }
  });

  // PUT /api/reflection-motivations/:id - Update a motivation
  app.fastify.put('/api/reflection-motivations/:id', {
    schema: {
      description: 'Update a reflection motivation (only if owned by authenticated user)',
      tags: ['reflection-motivations'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            name: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const { name } = request.body as { name: string };

    app.logger.info({ userId: session.user.id, motivationId: id, name }, 'Updating reflection motivation');

    try {
      // Verify motivation belongs to user
      const motivation = await app.db
        .select()
        .from(schema.reflectionMotivations)
        .where(
          and(
            eq(schema.reflectionMotivations.id, id),
            eq(schema.reflectionMotivations.userId, session.user.id)
          )
        )
        .limit(1);

      if (!motivation || motivation.length === 0) {
        app.logger.warn({ userId: session.user.id, motivationId: id }, 'Motivation not found or not owned by user');
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Motivation not found or you do not have permission to update it.',
        });
      }

      // Update motivation
      const updated = await app.db
        .update(schema.reflectionMotivations)
        .set({ name, updatedAt: new Date() })
        .where(eq(schema.reflectionMotivations.id, id))
        .returning();

      const result = updated[0];
      const response = {
        ...result,
        createdAt: result.createdAt instanceof Date ? result.createdAt.toISOString() : new Date(result.createdAt).toISOString(),
        updatedAt: result.updatedAt instanceof Date ? result.updatedAt.toISOString() : new Date(result.updatedAt).toISOString(),
      };

      app.logger.info({ userId: session.user.id, motivationId: id, name }, 'Reflection motivation updated successfully');
      return response;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, motivationId: id, name }, 'Failed to update reflection motivation');
      throw error;
    }
  });

  // DELETE /api/reflection-motivations/:id - Delete a motivation
  app.fastify.delete('/api/reflection-motivations/:id', {
    schema: {
      description: 'Delete a reflection motivation (only if owned by authenticated user)',
      tags: ['reflection-motivations'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, motivationId: id }, 'Deleting reflection motivation');

    try {
      // Verify motivation belongs to user
      const motivation = await app.db
        .select()
        .from(schema.reflectionMotivations)
        .where(
          and(
            eq(schema.reflectionMotivations.id, id),
            eq(schema.reflectionMotivations.userId, session.user.id)
          )
        )
        .limit(1);

      if (!motivation || motivation.length === 0) {
        app.logger.warn({ userId: session.user.id, motivationId: id }, 'Motivation not found or not owned by user');
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Motivation not found or you do not have permission to delete it.',
        });
      }

      // Delete motivation
      await app.db
        .delete(schema.reflectionMotivations)
        .where(eq(schema.reflectionMotivations.id, id));

      app.logger.info({ userId: session.user.id, motivationId: id }, 'Reflection motivation deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, motivationId: id }, 'Failed to delete reflection motivation');
      throw error;
    }
  });
}
