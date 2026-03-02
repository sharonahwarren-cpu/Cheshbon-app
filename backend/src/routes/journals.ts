import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, ilike } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { createAuthWrapper } from '../utils/auth-wrapper.js';

export function registerJournalsRoutes(app: App) {
  const requireAuth = createAuthWrapper(app);

  // GET /api/journals/by-date?date=YYYY-MM-DD - Get journal entry for specific date
  app.fastify.get('/api/journals/by-date', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { date } = request.query as { date: string };

    if (!date) {
      app.logger.warn({ userId: session.user.id }, 'Missing date parameter in GET journals by date');
      return reply.status(400).send({ error: 'Missing date parameter' });
    }

    app.logger.info({ userId: session.user.id, date }, 'Fetching journal entry for date');

    try {
      const entries = await app.db
        .select()
        .from(schema.journalEntries)
        .where(and(
          eq(schema.journalEntries.userId, session.user.id),
          eq(schema.journalEntries.entryDate, date)
        ))
        .limit(1);

      app.logger.info({ userId: session.user.id, date, found: entries.length > 0 }, 'Journal entry retrieved');
      return entries[0] || null;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, date }, 'Failed to fetch journal entry by date');
      throw error;
    }
  });

  // POST /api/journals/by-date - Create or update journal entry for specific date
  app.fastify.post('/api/journals/by-date', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as {
      date: string;
      content?: string;
    };

    if (!body.date) {
      app.logger.warn({ userId: session.user.id }, 'Missing date in POST journals by date');
      return reply.status(400).send({ error: 'Missing required field: date' });
    }

    // Check if content is empty or only whitespace
    const isContentEmpty = !body.content || body.content.trim() === '';

    app.logger.info({ userId: session.user.id, date: body.date, contentEmpty: isContentEmpty }, 'Processing journal entry for date');

    try {
      // Check if entry exists for this date
      const existing = await app.db
        .select()
        .from(schema.journalEntries)
        .where(and(
          eq(schema.journalEntries.userId, session.user.id),
          eq(schema.journalEntries.entryDate, body.date)
        ))
        .limit(1);

      if (isContentEmpty) {
        // If content is empty, delete the entry if it exists
        if (existing.length > 0) {
          await app.db
            .delete(schema.journalEntries)
            .where(and(
              eq(schema.journalEntries.userId, session.user.id),
              eq(schema.journalEntries.entryDate, body.date)
            ));

          app.logger.info({ userId: session.user.id, entryId: existing[0].id, date: body.date }, 'Journal entry deleted (empty content)');
        } else {
          app.logger.info({ userId: session.user.id, date: body.date }, 'No journal entry to delete (empty content, no existing entry)');
        }
        return null;
      }

      // Content is not empty, create or update
      if (existing.length > 0) {
        // Update existing entry
        const updatedEntries = await app.db
          .update(schema.journalEntries)
          .set({
            content: body.content,
            updatedAt: new Date(),
          })
          .where(and(
            eq(schema.journalEntries.userId, session.user.id),
            eq(schema.journalEntries.entryDate, body.date)
          ))
          .returning();
        const updatedEntry = updatedEntries[0];

        app.logger.info({ userId: session.user.id, entryId: updatedEntry.id, date: body.date }, 'Journal entry updated');
        return updatedEntry;
      } else {
        // Create new entry
        const newEntries = await app.db
          .insert(schema.journalEntries)
          .values({
            userId: session.user.id,
            entryDate: body.date,
            content: body.content,
            mood: null,
          })
          .returning();
        const newEntry = newEntries[0];

        app.logger.info({ userId: session.user.id, entryId: newEntry.id, date: body.date }, 'Journal entry created');
        return newEntry;
      }
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, date: body.date }, 'Failed to create/update journal entry by date');
      throw error;
    }
  });

  // GET /api/journals/search?q=keyword - Search journals for keyword
  app.fastify.get('/api/journals/search', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { q } = request.query as { q: string };

    if (!q || q.length < 1) {
      app.logger.warn({ userId: session.user.id }, 'Missing search query');
      return reply.status(400).send({ error: 'Missing search query parameter' });
    }

    app.logger.info({ userId: session.user.id, query: q }, 'Searching journals');

    try {
      const entries = await app.db
        .select()
        .from(schema.journalEntries)
        .where(and(
          eq(schema.journalEntries.userId, session.user.id),
          ilike(schema.journalEntries.content, `%${q}%`)
        ))
        .orderBy((t) => t.entryDate);

      // Create excerpts showing context around the keyword
      const convertToISO = (date: Date | null) => date ? (date instanceof Date ? date.toISOString() : new Date(date).toISOString()) : null;
      const results = entries.map(entry => {
        const contentLower = entry.content.toLowerCase();
        const queryLower = q.toLowerCase();
        const index = contentLower.indexOf(queryLower);

        let excerpt = entry.content;
        if (index !== -1) {
          const start = Math.max(0, index - 50);
          const end = Math.min(entry.content.length, index + q.length + 50);
          const prefix = start > 0 ? '...' : '';
          const suffix = end < entry.content.length ? '...' : '';
          excerpt = prefix + entry.content.substring(start, end) + suffix;
        }

        return {
          id: entry.id,
          content: entry.content,
          entryDate: entry.entryDate,
          createdAt: convertToISO(entry.createdAt),
          excerpt,
        };
      });

      app.logger.info({ userId: session.user.id, query: q, resultCount: results.length }, 'Journal search completed');
      return results;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, query: q }, 'Failed to search journals');
      throw error;
    }
  });
}
