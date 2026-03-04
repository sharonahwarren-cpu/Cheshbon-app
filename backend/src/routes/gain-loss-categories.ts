import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { createAuthWrapper } from '../utils/auth-wrapper.js';

export function registerGainLossCategoriesRoutes(app: App) {
  const requireAuth = createAuthWrapper(app);

  // GET /api/gain-loss-categories - Get all categories for authenticated user
  app.fastify.get('/api/gain-loss-categories', {
    schema: {
      description: 'Get all gain/loss categories for the authenticated user',
      tags: ['gain-loss-categories'],
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

    app.logger.info({ userId: session.user.id }, 'Fetching gain/loss categories');

    try {
      let categories = await app.db
        .select()
        .from(schema.gainLossCategories)
        .where(eq(schema.gainLossCategories.userId, session.user.id));

      // Seed default categories if user has none
      if (categories.length === 0) {
        app.logger.info({ userId: session.user.id }, 'No categories found, seeding defaults');

        const defaultCategories = [
          { userId: session.user.id, name: 'Financial' },
          { userId: session.user.id, name: 'Relationship' },
        ];

        await app.db.insert(schema.gainLossCategories).values(defaultCategories);

        // Fetch the created categories
        categories = await app.db
          .select()
          .from(schema.gainLossCategories)
          .where(eq(schema.gainLossCategories.userId, session.user.id));
      }

      // Convert timestamps to ISO format
      const categoriesWithDates = categories.map(category => ({
        ...category,
        createdAt: category.createdAt instanceof Date ? category.createdAt.toISOString() : new Date(category.createdAt).toISOString(),
        updatedAt: category.updatedAt instanceof Date ? category.updatedAt.toISOString() : new Date(category.updatedAt).toISOString(),
      }));

      app.logger.info({ userId: session.user.id, count: categoriesWithDates.length }, 'Gain/loss categories fetched successfully');
      return categoriesWithDates;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch gain/loss categories');
      throw error;
    }
  });

  // POST /api/gain-loss-categories - Create a new category
  app.fastify.post('/api/gain-loss-categories', {
    schema: {
      description: 'Create a new gain/loss category for the authenticated user',
      tags: ['gain-loss-categories'],
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

    app.logger.info({ userId: session.user.id, name }, 'Creating gain/loss category');

    try {
      const created = await app.db
        .insert(schema.gainLossCategories)
        .values({
          userId: session.user.id,
          name,
        })
        .returning();

      const category = created[0];
      const result = {
        ...category,
        createdAt: category.createdAt instanceof Date ? category.createdAt.toISOString() : new Date(category.createdAt).toISOString(),
        updatedAt: category.updatedAt instanceof Date ? category.updatedAt.toISOString() : new Date(category.updatedAt).toISOString(),
      };

      app.logger.info({ userId: session.user.id, categoryId: category.id, name }, 'Gain/loss category created successfully');
      return result;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, name }, 'Failed to create gain/loss category');
      throw error;
    }
  });

  // PUT /api/gain-loss-categories/:id - Update a category
  app.fastify.put('/api/gain-loss-categories/:id', {
    schema: {
      description: 'Update a gain/loss category (only if owned by authenticated user)',
      tags: ['gain-loss-categories'],
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

    app.logger.info({ userId: session.user.id, categoryId: id, name }, 'Updating gain/loss category');

    try {
      // Verify category belongs to user
      const category = await app.db
        .select()
        .from(schema.gainLossCategories)
        .where(
          and(
            eq(schema.gainLossCategories.id, id),
            eq(schema.gainLossCategories.userId, session.user.id)
          )
        )
        .limit(1);

      if (!category || category.length === 0) {
        app.logger.warn({ userId: session.user.id, categoryId: id }, 'Category not found or not owned by user');
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Category not found or you do not have permission to update it.',
        });
      }

      // Update category
      const updated = await app.db
        .update(schema.gainLossCategories)
        .set({ name, updatedAt: new Date() })
        .where(eq(schema.gainLossCategories.id, id))
        .returning();

      const result = updated[0];
      const response = {
        ...result,
        createdAt: result.createdAt instanceof Date ? result.createdAt.toISOString() : new Date(result.createdAt).toISOString(),
        updatedAt: result.updatedAt instanceof Date ? result.updatedAt.toISOString() : new Date(result.updatedAt).toISOString(),
      };

      app.logger.info({ userId: session.user.id, categoryId: id, name }, 'Gain/loss category updated successfully');
      return response;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, categoryId: id, name }, 'Failed to update gain/loss category');
      throw error;
    }
  });

  // DELETE /api/gain-loss-categories/:id - Delete a category
  app.fastify.delete('/api/gain-loss-categories/:id', {
    schema: {
      description: 'Delete a gain/loss category (only if owned by authenticated user)',
      tags: ['gain-loss-categories'],
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

    app.logger.info({ userId: session.user.id, categoryId: id }, 'Deleting gain/loss category');

    try {
      // Verify category belongs to user
      const category = await app.db
        .select()
        .from(schema.gainLossCategories)
        .where(
          and(
            eq(schema.gainLossCategories.id, id),
            eq(schema.gainLossCategories.userId, session.user.id)
          )
        )
        .limit(1);

      if (!category || category.length === 0) {
        app.logger.warn({ userId: session.user.id, categoryId: id }, 'Category not found or not owned by user');
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Category not found or you do not have permission to delete it.',
        });
      }

      // Delete category
      await app.db
        .delete(schema.gainLossCategories)
        .where(eq(schema.gainLossCategories.id, id));

      app.logger.info({ userId: session.user.id, categoryId: id }, 'Gain/loss category deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, categoryId: id }, 'Failed to delete gain/loss category');
      throw error;
    }
  });
}
