import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerCurrenciesRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/currencies - Get all currencies for authenticated user
  app.fastify.get('/api/currencies', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching currencies');

    try {
      const currencies = await app.db
        .select()
        .from(schema.currencies)
        .where(eq(schema.currencies.userId, session.user.id))
        .orderBy(desc(schema.currencies.createdAt));

      app.logger.info({ userId: session.user.id, count: currencies.length }, 'Currencies fetched successfully');
      return currencies;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch currencies');
      throw error;
    }
  });

  // POST /api/currencies - Create a new currency
  app.fastify.post('/api/currencies', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as {
      name: string;
      symbol?: string;
    };

    app.logger.info(
      { userId: session.user.id, name: body.name },
      'Creating currency'
    );

    try {
      const currencies = await app.db
        .insert(schema.currencies)
        .values({
          userId: session.user.id,
          name: body.name,
          symbol: body.symbol || null,
        })
        .returning();
      const currency = currencies[0];

      app.logger.info({ userId: session.user.id, currencyId: currency.id }, 'Currency created successfully');
      return currency;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, name: body.name },
        'Failed to create currency'
      );
      throw error;
    }
  });

  // PUT /api/currencies/:id - Update a currency
  app.fastify.put('/api/currencies/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      symbol?: string;
    };

    app.logger.info({ userId: session.user.id, currencyId: id }, 'Updating currency');

    try {
      // Check if currency exists and belongs to user
      const existingCurrency = await app.db
        .select()
        .from(schema.currencies)
        .where(eq(schema.currencies.id, id))
        .limit(1);

      if (!existingCurrency.length) {
        app.logger.warn({ userId: session.user.id, currencyId: id }, 'Currency not found');
        return reply.status(404).send({ error: 'Currency not found' });
      }

      if (existingCurrency[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, currencyId: id, ownerId: existingCurrency[0].userId },
          'Unauthorized access to currency'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.symbol !== undefined) updateData.symbol = body.symbol || null;
      updateData.updatedAt = new Date();

      const updatedCurrencies = await app.db
        .update(schema.currencies)
        .set(updateData)
        .where(eq(schema.currencies.id, id))
        .returning();
      const updatedCurrency = updatedCurrencies[0];

      app.logger.info({ userId: session.user.id, currencyId: id }, 'Currency updated successfully');
      return updatedCurrency;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, currencyId: id },
        'Failed to update currency'
      );
      throw error;
    }
  });

  // DELETE /api/currencies/:id - Delete a currency
  app.fastify.delete('/api/currencies/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, currencyId: id }, 'Deleting currency');

    try {
      // Check if currency exists and belongs to user
      const existingCurrency = await app.db
        .select()
        .from(schema.currencies)
        .where(eq(schema.currencies.id, id))
        .limit(1);

      if (!existingCurrency.length) {
        app.logger.warn({ userId: session.user.id, currencyId: id }, 'Currency not found');
        return reply.status(404).send({ error: 'Currency not found' });
      }

      if (existingCurrency[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, currencyId: id, ownerId: existingCurrency[0].userId },
          'Unauthorized access to currency'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      await app.db.delete(schema.currencies).where(eq(schema.currencies.id, id));

      app.logger.info({ userId: session.user.id, currencyId: id }, 'Currency deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, currencyId: id },
        'Failed to delete currency'
      );
      throw error;
    }
  });
}
