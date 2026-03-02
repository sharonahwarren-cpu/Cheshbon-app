import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { createAuthWrapper } from '../utils/auth-wrapper.js';

export function registerMitzvotCategoryRoutes(app: App) {
  const requireAuth = createAuthWrapper(app);

  // GET /api/mitzvot-categories - Get all categories (both system and user-created)
  app.fastify.get('/api/mitzvot-categories', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching mitzvot categories');

    try {
      const categories = await app.db
        .select()
        .from(schema.mitzvotCategories)
        .where(eq(schema.mitzvotCategories.userId, session.user.id))
        .orderBy(schema.mitzvotCategories.displayOrder);

      app.logger.info({ userId: session.user.id, count: categories.length }, 'Mitzvot categories fetched successfully');
      return categories;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch mitzvot categories');
      throw error;
    }
  });

  // POST /api/mitzvot-categories - Create a new user category
  app.fastify.post('/api/mitzvot-categories', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as {
      name: string;
      description?: string;
      displayOrder?: number;
    };

    app.logger.info({ userId: session.user.id, name: body.name }, 'Creating mitzvot category');

    try {
      const categories = await app.db
        .insert(schema.mitzvotCategories)
        .values({
          userId: session.user.id,
          name: body.name,
          description: body.description || null,
          displayOrder: body.displayOrder || 0,
          isSystem: false,
        })
        .returning();

      const category = categories[0];

      app.logger.info({ userId: session.user.id, categoryId: category.id }, 'Mitzvot category created successfully');
      return category;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, name: body.name }, 'Failed to create mitzvot category');
      throw error;
    }
  });

  // PUT /api/mitzvot-categories/:id - Update a category
  app.fastify.put('/api/mitzvot-categories/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      description?: string;
      displayOrder?: number;
    };

    app.logger.info({ userId: session.user.id, categoryId: id }, 'Updating mitzvot category');

    try {
      const existingCategories = await app.db
        .select()
        .from(schema.mitzvotCategories)
        .where(eq(schema.mitzvotCategories.id, id))
        .limit(1);

      if (!existingCategories.length) {
        app.logger.warn({ userId: session.user.id, categoryId: id }, 'Mitzvot category not found');
        return reply.status(404).send({ error: 'Category not found' });
      }

      if (existingCategories[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, categoryId: id, ownerId: existingCategories[0].userId },
          'Unauthorized access to mitzvot category'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description || null;
      if (body.displayOrder !== undefined) updateData.displayOrder = body.displayOrder;
      updateData.updatedAt = new Date();

      const updatedCategories = await app.db
        .update(schema.mitzvotCategories)
        .set(updateData)
        .where(eq(schema.mitzvotCategories.id, id))
        .returning();

      const category = updatedCategories[0];

      app.logger.info({ userId: session.user.id, categoryId: id }, 'Mitzvot category updated successfully');
      return category;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, categoryId: id }, 'Failed to update mitzvot category');
      throw error;
    }
  });

  // DELETE /api/mitzvot-categories/:id - Delete a category (only if not system)
  app.fastify.delete('/api/mitzvot-categories/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, categoryId: id }, 'Deleting mitzvot category');

    try {
      const existingCategories = await app.db
        .select()
        .from(schema.mitzvotCategories)
        .where(eq(schema.mitzvotCategories.id, id))
        .limit(1);

      if (!existingCategories.length) {
        app.logger.warn({ userId: session.user.id, categoryId: id }, 'Mitzvot category not found');
        return reply.status(404).send({ error: 'Category not found' });
      }

      if (existingCategories[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, categoryId: id, ownerId: existingCategories[0].userId },
          'Unauthorized access to mitzvot category'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      if (existingCategories[0].isSystem) {
        app.logger.warn({ userId: session.user.id, categoryId: id }, 'Cannot delete system category');
        return reply.status(400).send({ error: 'Cannot delete system categories' });
      }

      await app.db.delete(schema.mitzvotCategories).where(eq(schema.mitzvotCategories.id, id));

      app.logger.info({ userId: session.user.id, categoryId: id }, 'Mitzvot category deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, categoryId: id }, 'Failed to delete mitzvot category');
      throw error;
    }
  });

  // POST /api/mitzvot-categories/upload-csv - Upload system categories from CSV
  app.fastify.post('/api/mitzvot-categories/upload-csv', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Uploading mitzvot categories from CSV');

    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file provided' });
      }

      const buffer = await data.toBuffer();
      const csvContent = buffer.toString('utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        return reply.status(400).send({ error: 'CSV must have header and at least one data row' });
      }

      // Parse CSV (simple parsing - assumes no commas in values)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const categories = [];
      let displayOrder = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length < 1 || !values[0]) continue;

        const nameIndex = headers.indexOf('name');
        const descIndex = headers.indexOf('description');

        if (nameIndex === -1) {
          app.logger.warn({ userId: session.user.id }, 'CSV missing name column');
          continue;
        }

        const category = {
          userId: session.user.id,
          name: values[nameIndex],
          description: descIndex !== -1 ? values[descIndex] : null,
          displayOrder: displayOrder++,
          isSystem: true,
        };

        categories.push(category);
      }

      if (categories.length === 0) {
        return reply.status(400).send({ error: 'No valid categories found in CSV' });
      }

      const inserted = await app.db
        .insert(schema.mitzvotCategories)
        .values(categories as any)
        .returning();

      app.logger.info({ userId: session.user.id, count: inserted.length }, 'Mitzvot categories uploaded successfully');
      return { count: inserted.length, categories: inserted };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to upload mitzvot categories from CSV');
      throw error;
    }
  });
}
