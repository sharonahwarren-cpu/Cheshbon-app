import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerCurrenciesTransactionsRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/currencies/:id/claim - Claim currency (add to balance)
  app.fastify.post('/api/currencies/:id/claim', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as {
      amount: number;
      reason?: string;
    };

    if (!body.amount || body.amount <= 0) {
      app.logger.warn({ userId: session.user.id, currencyId: id }, 'Invalid amount in claim request');
      return reply.status(400).send({ error: 'Amount must be greater than 0' });
    }

    app.logger.info({ userId: session.user.id, currencyId: id, amount: body.amount }, 'Claiming currency');

    try {
      // Check if currency exists and belongs to user
      const currencies = await app.db
        .select()
        .from(schema.currencies)
        .where(eq(schema.currencies.id, id))
        .limit(1);

      if (!currencies.length) {
        app.logger.warn({ userId: session.user.id, currencyId: id }, 'Currency not found');
        return reply.status(404).send({ error: 'Currency not found' });
      }

      if (currencies[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, currencyId: id, ownerId: currencies[0].userId },
          'Unauthorized access to currency'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Create a reflection entry to track the transaction
      const today = new Date().toISOString().split('T')[0];
      const reflections = await app.db
        .insert(schema.reflections)
        .values({
          userId: session.user.id,
          entryDate: today,
          outcome: 'success',
          type: 'Proactive',
          category: 'Action',
          description: `Claimed ${body.amount} ${currencies[0].name}${body.reason ? `: ${body.reason}` : ''}`,
          currencyChange: JSON.stringify({
            currencyId: id,
            amount: body.amount,
            operation: 'add',
          }),
        })
        .returning();

      if (!reflections.length) {
        throw new Error('Failed to create transaction reflection');
      }

      app.logger.info({ userId: session.user.id, currencyId: id, amount: body.amount, reflectionId: reflections[0].id }, 'Currency claimed successfully');
      return { success: true, amount: body.amount, transactionId: reflections[0].id };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, currencyId: id }, 'Failed to claim currency');
      throw error;
    }
  });

  // POST /api/currencies/:id/pay - Pay currency (subtract from balance)
  app.fastify.post('/api/currencies/:id/pay', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as {
      amount: number;
      reason?: string;
    };

    if (!body.amount || body.amount <= 0) {
      app.logger.warn({ userId: session.user.id, currencyId: id }, 'Invalid amount in pay request');
      return reply.status(400).send({ error: 'Amount must be greater than 0' });
    }

    app.logger.info({ userId: session.user.id, currencyId: id, amount: body.amount }, 'Paying currency');

    try {
      // Check if currency exists and belongs to user
      const currencies = await app.db
        .select()
        .from(schema.currencies)
        .where(eq(schema.currencies.id, id))
        .limit(1);

      if (!currencies.length) {
        app.logger.warn({ userId: session.user.id, currencyId: id }, 'Currency not found');
        return reply.status(404).send({ error: 'Currency not found' });
      }

      if (currencies[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, currencyId: id, ownerId: currencies[0].userId },
          'Unauthorized access to currency'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Create a reflection entry to track the transaction
      const today = new Date().toISOString().split('T')[0];
      const reflections = await app.db
        .insert(schema.reflections)
        .values({
          userId: session.user.id,
          entryDate: today,
          outcome: 'struggled',
          type: 'Restraint',
          category: 'Action',
          description: `Paid ${body.amount} ${currencies[0].name}${body.reason ? `: ${body.reason}` : ''}`,
          currencyChange: JSON.stringify({
            currencyId: id,
            amount: body.amount,
            operation: 'subtract',
          }),
        })
        .returning();

      if (!reflections.length) {
        throw new Error('Failed to create transaction reflection');
      }

      app.logger.info({ userId: session.user.id, currencyId: id, amount: body.amount, reflectionId: reflections[0].id }, 'Currency paid successfully');
      return { success: true, amount: body.amount, transactionId: reflections[0].id };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, currencyId: id }, 'Failed to pay currency');
      throw error;
    }
  });
}
