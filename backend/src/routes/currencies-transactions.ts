import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, asc, desc, and, gte, lte } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { createAuthWrapper } from '../utils/auth-wrapper.js';

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
  const requireAuth = createAuthWrapper(app);

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

      // Update goal_currency_balances using FIFO (oldest first)
      // For claiming rewards, we ADD to the balance (oldest first)
      const goalBalances = await app.db
        .select()
        .from(schema.goalCurrencyBalances)
        .where(eq(schema.goalCurrencyBalances.currencyId, id))
        .orderBy(asc(schema.goalCurrencyBalances.createdAt)); // FIFO - oldest first

      // Distribute the claim amount across goals starting with oldest (FIFO)
      // Claiming means taking/redeeming, so we SUBTRACT from the balance
      let remainingAmount = body.amount;
      if (goalBalances.length > 0 && remainingAmount > 0) {
        for (const gb of goalBalances) {
          if (remainingAmount <= 0) break;

          // Subtract claim amount from this goal's balance (taking it)
          const amountToClaim = Math.min(Math.abs(gb.balance), remainingAmount);
          const newBalance = gb.balance - amountToClaim;

          await app.db
            .update(schema.goalCurrencyBalances)
            .set({ balance: newBalance, updatedAt: new Date() })
            .where(eq(schema.goalCurrencyBalances.id, gb.id));

          remainingAmount -= amountToClaim;
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

      // Update goal_currency_balances using FIFO (oldest first)
      // For paying/redeeming, we SUBTRACT from the balance (oldest first)
      const goalBalances = await app.db
        .select()
        .from(schema.goalCurrencyBalances)
        .where(eq(schema.goalCurrencyBalances.currencyId, id))
        .orderBy(asc(schema.goalCurrencyBalances.createdAt)); // FIFO - oldest first

      // Distribute the payment amount across goals starting with oldest
      let remainingAmount = body.amount;
      if (goalBalances.length > 0 && remainingAmount > 0) {
        for (const gb of goalBalances) {
          if (remainingAmount <= 0) break;

          // Reduce this goal's balance by the amount paid
          const amountToPay = Math.min(Math.abs(gb.balance), remainingAmount);
          const newBalance = gb.balance - amountToPay;

          await app.db
            .update(schema.goalCurrencyBalances)
            .set({ balance: newBalance, updatedAt: new Date() })
            .where(eq(schema.goalCurrencyBalances.id, gb.id));

          remainingAmount -= amountToPay;
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

  // GET /api/currencies/:currencyId/transactions?startDate=...&endDate=... - Get all transactions for a currency
  app.fastify.get('/api/currencies/:currencyId/transactions', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { currencyId } = request.params as { currencyId: string };
    const query = request.query as {
      startDate?: string;
      endDate?: string;
    };

    app.logger.info({ userId: session.user.id, currencyId, filters: query }, 'Fetching currency transactions');

    try {
      // Verify currency exists and belongs to user
      const currencies = await app.db
        .select()
        .from(schema.currencies)
        .where(eq(schema.currencies.id, currencyId))
        .limit(1);

      if (!currencies.length) {
        app.logger.warn({ userId: session.user.id, currencyId }, 'Currency not found');
        return reply.status(404).send({ error: 'Currency not found' });
      }

      if (currencies[0].userId !== session.user.id) {
        app.logger.warn({ userId: session.user.id, currencyId }, 'Unauthorized access to currency');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Get all reflections for the user
      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(eq(schema.reflections.userId, session.user.id));

      // Get all currency transactions for this currency
      const transactions = await app.db
        .select()
        .from(schema.currencyTransactions)
        .where(eq(schema.currencyTransactions.currencyId, currencyId));

      // Get all goals to map goal IDs to titles
      const goals = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.userId, session.user.id));

      const goalMap = new Map(goals.map(g => [g.id, g]));
      const convertToISO = (date: Date | null) => date ? (date instanceof Date ? date.toISOString() : new Date(date).toISOString()) : null;

      // Filter reflections that affected this currency
      const currencyReflections = reflections
        .filter(reflection => {
          // Check if reflection has currencyChange for this currency
          if (reflection.currencyChange) {
            try {
              const change = typeof reflection.currencyChange === 'string'
                ? JSON.parse(reflection.currencyChange)
                : reflection.currencyChange;
              if (change.currencyId === currencyId) {
                return true;
              }
            } catch (e) {
              // Skip invalid currencyChange
            }
          }
          return false;
        })
        .map(reflection => {
          const goal = reflection.linkedGoalId ? goalMap.get(reflection.linkedGoalId) : null;
          const change = reflection.currencyChange
            ? (typeof reflection.currencyChange === 'string'
              ? JSON.parse(reflection.currencyChange)
              : reflection.currencyChange)
            : null;

          return {
            id: reflection.id,
            entryDate: reflection.entryDate,
            type: 'reflection',
            description: reflection.description,
            amount: change?.amount || 0,
            operation: change?.operation || 'add',
            linkedGoalId: reflection.linkedGoalId,
            linkedGoalTitle: goal?.title || null,
            outcome: reflection.outcome,
            createdAt: convertToISO(reflection.createdAt),
          };
        });

      // Transform currency transactions
      const currencyTransactionEntries = transactions
        .map(transaction => {
          const goal = transaction.goalId ? goalMap.get(transaction.goalId) : null;
          const isManualClaim = transaction.transactionType === 'MANUAL_CLAIM';
          const isManualPay = transaction.transactionType === 'MANUAL_PAY';

          return {
            id: transaction.id,
            entryDate: transaction.createdAt instanceof Date
              ? transaction.createdAt.toISOString().split('T')[0]
              : new Date(transaction.createdAt).toISOString().split('T')[0],
            type: 'transaction',
            description: transaction.description || '',
            amount: Math.abs(transaction.amount),
            operation: isManualClaim ? 'add' : isManualPay ? 'subtract' : 'add',
            transactionType: isManualClaim ? 'claim' : isManualPay ? 'pay' : transaction.transactionType,
            linkedGoalId: transaction.goalId,
            linkedGoalTitle: goal?.title || null,
            createdAt: convertToISO(transaction.createdAt),
          };
        });

      // Apply date range filters
      const allEntries = [...currencyReflections, ...currencyTransactionEntries];
      const filteredEntries = allEntries.filter(entry => {
        if (query.startDate) {
          const startDateStr = new Date(query.startDate).toISOString().split('T')[0];
          if (entry.entryDate < startDateStr) return false;
        }

        if (query.endDate) {
          const endDateStr = new Date(query.endDate).toISOString().split('T')[0];
          if (entry.entryDate > endDateStr) return false;
        }

        return true;
      });

      // Sort by entryDate descending (most recent first)
      filteredEntries.sort((a, b) => {
        return new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime();
      });

      app.logger.info({ userId: session.user.id, currencyId, count: filteredEntries.length }, 'Currency transactions fetched');
      return filteredEntries;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, currencyId }, 'Failed to fetch currency transactions');
      throw error;
    }
  });
}
