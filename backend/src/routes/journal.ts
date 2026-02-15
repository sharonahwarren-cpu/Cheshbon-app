import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerJournalRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/journal - Get all journal entries for authenticated user
  app.fastify.get('/api/journal', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching journal entries');

    try {
      const entries = await app.db
        .select()
        .from(schema.journalEntries)
        .where(eq(schema.journalEntries.userId, session.user.id))
        .orderBy(desc(schema.journalEntries.createdAt));

      app.logger.info({ userId: session.user.id, count: entries.length }, 'Journal entries fetched successfully');
      return entries;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch journal entries');
      throw error;
    }
  });

  // POST /api/journal - Create a new journal entry
  app.fastify.post('/api/journal', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as { date: string; content: string; mood?: string };

    if (!body.date || !body.content) {
      app.logger.warn({ userId: session.user.id }, 'Missing required fields in POST journal');
      return reply.status(400).send({ error: 'Missing required fields: date and content' });
    }

    app.logger.info(
      { userId: session.user.id, date: body.date, contentLength: body.content?.length, mood: body.mood },
      'Creating journal entry'
    );

    try {
      const entries = await app.db
        .insert(schema.journalEntries)
        .values({
          userId: session.user.id,
          entryDate: body.date,
          content: body.content,
          mood: body.mood || null,
        })
        .returning();
      const entry = entries[0];

      app.logger.info({ userId: session.user.id, entryId: entry.id }, 'Journal entry created successfully');
      return entry;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, body: { mood: body.mood } },
        'Failed to create journal entry'
      );
      throw error;
    }
  });

  // PUT /api/journal/:id - Update a journal entry
  app.fastify.put('/api/journal/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as { content?: string; mood?: string };

    app.logger.info(
      { userId: session.user.id, entryId: id },
      'Updating journal entry'
    );

    try {
      // Check if entry exists and belongs to user
      const existingEntry = await app.db
        .select()
        .from(schema.journalEntries)
        .where(eq(schema.journalEntries.id, id))
        .limit(1);

      if (!existingEntry.length) {
        app.logger.warn({ userId: session.user.id, entryId: id }, 'Journal entry not found');
        return reply.status(404).send({ error: 'Journal entry not found' });
      }

      if (existingEntry[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, entryId: id, ownerId: existingEntry[0].userId },
          'Unauthorized access to journal entry'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const updateData: Record<string, unknown> = {};
      if (body.content !== undefined) updateData.content = body.content;
      if (body.mood !== undefined) updateData.mood = body.mood || null;
      updateData.updatedAt = new Date();

      const updatedEntries = await app.db
        .update(schema.journalEntries)
        .set(updateData)
        .where(eq(schema.journalEntries.id, id))
        .returning();
      const updatedEntry = updatedEntries[0];

      app.logger.info({ userId: session.user.id, entryId: id }, 'Journal entry updated successfully');
      return updatedEntry;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, entryId: id },
        'Failed to update journal entry'
      );
      throw error;
    }
  });

  // DELETE /api/journal/:id - Delete a journal entry
  app.fastify.delete('/api/journal/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, entryId: id }, 'Deleting journal entry');

    try {
      // Check if entry exists and belongs to user
      const existingEntry = await app.db
        .select()
        .from(schema.journalEntries)
        .where(eq(schema.journalEntries.id, id))
        .limit(1);

      if (!existingEntry.length) {
        app.logger.warn({ userId: session.user.id, entryId: id }, 'Journal entry not found');
        return reply.status(404).send({ error: 'Journal entry not found' });
      }

      if (existingEntry[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, entryId: id, ownerId: existingEntry[0].userId },
          'Unauthorized access to journal entry'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      await app.db.delete(schema.journalEntries).where(eq(schema.journalEntries.id, id));

      app.logger.info({ userId: session.user.id, entryId: id }, 'Journal entry deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, entryId: id },
        'Failed to delete journal entry'
      );
      throw error;
    }
  });
}
