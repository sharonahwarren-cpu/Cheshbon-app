import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';

// Helper function to calculate current balance for a currency
async function calculateCurrencyBalance(
  app: any,
  userId: string,
  currencyId: string
): Promise<number> {
  const reflections = await app.db
    .select()
    .from(schema.reflections)
    .where(eq(schema.reflections.userId, userId));

  let balance = 0;
  for (const reflection of reflections) {
    if (!reflection.currencyChange) continue;

    try {
      const change = typeof reflection.currencyChange === 'string'
        ? JSON.parse(reflection.currencyChange)
        : reflection.currencyChange;

      if (change.currencyId === currencyId) {
        if (change.operation === 'add') {
          balance += change.amount;
        } else if (change.operation === 'subtract') {
          balance -= change.amount;
        }
      }
    } catch (e) {
      // Skip invalid currencyChange entries
      continue;
    }
  }
  return balance;
}

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

      // Create a currency transaction record
      await app.db
        .insert(schema.currencyTransactions)
        .values({
          userId: session.user.id,
          currencyId: id,
          reflectionId: reflections[0].id,
          amount: -body.amount, // Negative because claiming reduces balance
          transactionType: 'MANUAL_CLAIM',
          description: `Claimed ${body.amount} ${currencies[0].name}${body.reason ? `: ${body.reason}` : ''}`,
        });

      // Update goal_currency_balances proportionally
      const goalBalances = await app.db
        .select()
        .from(schema.goalCurrencyBalances)
        .where(eq(schema.goalCurrencyBalances.currencyId, id));

      // Calculate total balance across all goals for this currency
      let totalBalance = 0;
      for (const gb of goalBalances) {
        totalBalance += gb.balance;
      }

      // Distribute the claim amount proportionally across goals
      if (goalBalances.length > 0 && totalBalance !== 0) {
        for (const gb of goalBalances) {
          if (totalBalance === 0) continue;
          // Calculate proportional share of the claim
          const proportion = gb.balance / totalBalance;
          const amountToReduce = Math.round(body.amount * proportion);

          // Update the balance (reduce by claimed amount)
          const newBalance = gb.balance - amountToReduce;
          await app.db
            .update(schema.goalCurrencyBalances)
            .set({ balance: newBalance, updatedAt: new Date() })
            .where(eq(schema.goalCurrencyBalances.id, gb.id));
        }
      }

      // Calculate updated total balance
      let updatedBalance = 0;
      const updatedGoalBalances = await app.db
        .select()
        .from(schema.goalCurrencyBalances)
        .where(eq(schema.goalCurrencyBalances.currencyId, id));

      for (const gb of updatedGoalBalances) {
        updatedBalance += gb.balance;
      }

      app.logger.info({ userId: session.user.id, currencyId: id, amount: body.amount, reflectionId: reflections[0].id, updatedBalance }, 'Currency claimed successfully');
      return { success: true, amount: body.amount, transactionId: reflections[0].id, balance: updatedBalance };
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

      // Create a currency transaction record
      await app.db
        .insert(schema.currencyTransactions)
        .values({
          userId: session.user.id,
          currencyId: id,
          reflectionId: reflections[0].id,
          amount: body.amount, // Positive because paying off reduces debt
          transactionType: 'MANUAL_PAY',
          description: `Paid ${body.amount} ${currencies[0].name}${body.reason ? `: ${body.reason}` : ''}`,
        });

      // Update goal_currency_balances proportionally
      const goalBalances = await app.db
        .select()
        .from(schema.goalCurrencyBalances)
        .where(eq(schema.goalCurrencyBalances.currencyId, id));

      // Calculate total balance across all goals for this currency
      let totalBalance = 0;
      for (const gb of goalBalances) {
        totalBalance += gb.balance;
      }

      // Distribute the payment amount proportionally across goals
      if (goalBalances.length > 0 && totalBalance !== 0) {
        for (const gb of goalBalances) {
          if (totalBalance === 0) continue;
          // Calculate proportional share of the payment
          const proportion = gb.balance / totalBalance;
          const amountToPay = Math.round(body.amount * proportion);

          // Update the balance (add to balance, which reduces debt toward zero)
          const newBalance = gb.balance + amountToPay;
          await app.db
            .update(schema.goalCurrencyBalances)
            .set({ balance: newBalance, updatedAt: new Date() })
            .where(eq(schema.goalCurrencyBalances.id, gb.id));
        }
      }

      // Calculate updated total balance
      let updatedBalance = 0;
      const updatedGoalBalances = await app.db
        .select()
        .from(schema.goalCurrencyBalances)
        .where(eq(schema.goalCurrencyBalances.currencyId, id));

      for (const gb of updatedGoalBalances) {
        updatedBalance += gb.balance;
      }

      app.logger.info({ userId: session.user.id, currencyId: id, amount: body.amount, reflectionId: reflections[0].id, updatedBalance }, 'Currency paid successfully');
      return { success: true, amount: body.amount, transactionId: reflections[0].id, balance: updatedBalance };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, currencyId: id }, 'Failed to pay currency');
      throw error;
    }
  });
}
