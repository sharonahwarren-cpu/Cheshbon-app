import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerReportsRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/reports/currency-balances - Calculate currency balances based on goal completions
  app.fastify.get('/api/reports/currency-balances', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching currency balances report');

    try {
      // Get all currencies for the user
      const userCurrencies = await app.db
        .select()
        .from(schema.currencies)
        .where(eq(schema.currencies.userId, session.user.id));

      // Get all goals for the user
      const userGoals = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.userId, session.user.id));

      // Get all completions for the user
      const completions = await app.db
        .select()
        .from(schema.goalCompletions)
        .where(eq(schema.goalCompletions.userId, session.user.id));

      // Build a map of goals for quick lookup
      const goalMap = new Map(userGoals.map(g => [g.id, g]));

      // Calculate balances for each currency
      const balances = userCurrencies.map(currency => {
        let earned = 0;
        let lost = 0;
        let debtAdded = 0;
        let debtReduced = 0;

        // Process all completions
        for (const completion of completions) {
          const goal = goalMap.get(completion.goalId);
          if (!goal) continue;

          if (completion.isSuccess) {
            // Success: check reward currency
            if (goal.rewardCurrencyId === currency.id && goal.rewardAmount) {
              if (currency.onSuccess === 'ADD') {
                earned += goal.rewardAmount;
              } else if (currency.onSuccess === 'SUBTRACT') {
                lost += goal.rewardAmount;
              }
            }
          } else {
            // Failure: check consequence currency
            if (goal.consequenceCurrencyId === currency.id && goal.consequenceAmount) {
              if (currency.onFailure === 'ADD') {
                debtAdded += goal.consequenceAmount;
              } else if (currency.onFailure === 'SUBTRACT') {
                debtReduced += goal.consequenceAmount;
              }
            }
          }
        }

        const netBalance = earned - lost - debtAdded + debtReduced;

        return {
          currencyId: currency.id,
          currencyName: currency.name,
          symbol: currency.symbol,
          earned,
          lost,
          debtAdded,
          debtReduced,
          netBalance,
        };
      });

      app.logger.info({ userId: session.user.id, currencyCount: balances.length }, 'Currency balances report generated successfully');
      return balances;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate currency balances report');
      throw error;
    }
  });

  // GET /api/reports/reflection-worth-it-tallies - Get reflection worth-it tallies
  app.fastify.get('/api/reports/reflection-worth-it-tallies', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching reflection worth-it tallies');

    try {
      // Get all reflections for the user with wasWorthIt value
      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(eq(schema.reflections.userId, session.user.id));

      // Count worth it vs not worth it
      let worthIt = 0;
      let notWorthIt = 0;

      for (const reflection of reflections) {
        if (reflection.wasWorthIt === true) {
          worthIt++;
        } else if (reflection.wasWorthIt === false) {
          notWorthIt++;
        }
      }

      const total = worthIt + notWorthIt;

      app.logger.info({ userId: session.user.id, worthIt, notWorthIt, total }, 'Reflection worth-it tallies generated successfully');
      return { worthIt, notWorthIt, total };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate reflection worth-it tallies');
      throw error;
    }
  });
}
