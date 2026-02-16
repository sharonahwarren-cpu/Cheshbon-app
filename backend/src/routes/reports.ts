import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerReportsRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/reports/currency-balances - Calculate currency balances from reflection currencyChange
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

      // Get all reflections for the user
      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(eq(schema.reflections.userId, session.user.id));

      // Calculate balances for each currency from reflection currencyChange
      const balances = userCurrencies.map(currency => {
        let earned = 0;
        let lost = 0;
        const reflectionIds: string[] = [];

        // Process all reflections with currencyChange
        for (const reflection of reflections) {
          if (!reflection.currencyChange) continue;

          try {
            const change = typeof reflection.currencyChange === 'string'
              ? JSON.parse(reflection.currencyChange)
              : reflection.currencyChange;

            if (change.currencyId === currency.id) {
              reflectionIds.push(reflection.id);
              if (change.operation === 'add') {
                earned += change.amount;
              } else if (change.operation === 'subtract') {
                lost += change.amount;
              }
            }
          } catch (e) {
            // Skip invalid currencyChange entries
            continue;
          }
        }

        const netBalance = earned - lost;

        return {
          currencyId: currency.id,
          currencyName: currency.name,
          symbol: currency.symbol,
          earned,
          lost,
          netBalance,
          reflectionIds,
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

  // GET /api/reports/wins-vs-losses - Get wins vs losses from reflections
  app.fastify.get('/api/reports/wins-vs-losses', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching wins vs losses report');

    try {
      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(eq(schema.reflections.userId, session.user.id));

      let wins = 0;
      let losses = 0;

      for (const reflection of reflections) {
        if (reflection.outcome === 'success') wins++;
        else if (reflection.outcome === 'struggled') losses++;
      }

      const totalReflections = wins + losses;

      app.logger.info({ userId: session.user.id, wins, losses, total: totalReflections }, 'Wins vs losses report generated');
      return { wins, losses, totalReflections };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate wins vs losses report');
      throw error;
    }
  });

  // GET /api/reports/success-vs-struggles - Get success vs struggle counts from reflections
  app.fastify.get('/api/reports/success-vs-struggles', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching success vs struggles report');

    try {
      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(eq(schema.reflections.userId, session.user.id));

      let successes = 0;
      let struggles = 0;
      const reflectionIds = [];

      for (const reflection of reflections) {
        if (reflection.outcome === 'success') {
          successes++;
          reflectionIds.push(reflection.id);
        } else if (reflection.outcome === 'struggled') {
          struggles++;
          reflectionIds.push(reflection.id);
        }
      }

      const total = successes + struggles;

      app.logger.info({ userId: session.user.id, successes, struggles, total }, 'Success vs struggles report generated');
      return { successes, struggles, total, reflectionIds };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate success vs struggles report');
      throw error;
    }
  });

  // GET /api/reports/reflection-stats - Get reflection statistics
  app.fastify.get('/api/reports/reflection-stats', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching reflection stats');

    try {
      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(eq(schema.reflections.userId, session.user.id));

      const totalReflections = reflections.length;
      let totalRestraints = 0;
      let totalProactive = 0;
      let worthItCount = 0;

      for (const reflection of reflections) {
        if (reflection.type === 'Restraint') totalRestraints++;
        else if (reflection.type === 'Proactive') totalProactive++;
        if (reflection.wasWorthIt === true) worthItCount++;
      }

      const worthItPercentage = totalReflections > 0 ? (worthItCount / totalReflections * 100) : 0;

      app.logger.info({ userId: session.user.id, totalReflections, totalRestraints, totalProactive, worthItPercentage }, 'Reflection stats generated');
      return { totalReflections, totalRestraints, totalProactive, worthItPercentage };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate reflection stats');
      throw error;
    }
  });

  // GET /api/reports/journal-count - Get total journal count
  app.fastify.get('/api/reports/journal-count', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching journal count');

    try {
      const entries = await app.db
        .select()
        .from(schema.journalEntries)
        .where(eq(schema.journalEntries.userId, session.user.id));

      const count = entries.length;

      app.logger.info({ userId: session.user.id, count }, 'Journal count generated');
      return { count };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate journal count');
      throw error;
    }
  });

  // GET /api/reports/gains-losses-summary - Get gains and losses summary
  app.fastify.get('/api/reports/gains-losses-summary', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching gains losses summary');

    try {
      const gainsLosses = await app.db
        .select()
        .from(schema.gainsLosses)
        .where(eq(schema.gainsLosses.userId, session.user.id));

      let totalGains = 0;
      let totalLosses = 0;
      const byCategoryMap = new Map<string, { gains: number; losses: number }>();
      const gainsCounts = new Map<string, number>();
      const lossesCounts = new Map<string, number>();

      for (const item of gainsLosses) {
        if (item.type === 'Gain') {
          totalGains++;
          gainsCounts.set(item.id, (gainsCounts.get(item.id) || 0) + 1);
        } else {
          totalLosses++;
          lossesCounts.set(item.id, (lossesCounts.get(item.id) || 0) + 1);
        }

        const cat = item.category || 'Uncategorized';
        const current = byCategoryMap.get(cat) || { gains: 0, losses: 0 };
        if (item.type === 'Gain') current.gains++;
        else current.losses++;
        byCategoryMap.set(cat, current);
      }

      const byCategory = Array.from(byCategoryMap.entries()).map(([category, counts]) => ({
        category,
        ...counts,
      }));

      const topGains = Array.from(gainsCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, count]) => {
          const item = gainsLosses.find(g => g.id === id);
          return { id, name: item?.name || '', count };
        });

      const topLosses = Array.from(lossesCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, count]) => {
          const item = gainsLosses.find(g => g.id === id);
          return { id, name: item?.name || '', count };
        });

      app.logger.info({ userId: session.user.id, totalGains, totalLosses }, 'Gains losses summary generated');
      return { totalGains, totalLosses, byCategory, topGains, topLosses };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate gains losses summary');
      throw error;
    }
  });

  // GET /api/reports/behavior-counts - Get behavior category counts
  app.fastify.get('/api/reports/behavior-counts', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching behavior counts');

    try {
      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(eq(schema.reflections.userId, session.user.id));

      let actionEntries = 0;
      let speechEntries = 0;
      let thoughtEntries = 0;

      for (const reflection of reflections) {
        if (reflection.category === 'Action') actionEntries++;
        else if (reflection.category === 'Speech') speechEntries++;
        else if (reflection.category === 'Thought') thoughtEntries++;
      }

      app.logger.info({ userId: session.user.id, actionEntries, speechEntries, thoughtEntries }, 'Behavior counts generated');
      return { actionEntries, speechEntries, thoughtEntries };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate behavior counts');
      throw error;
    }
  });

  // GET /api/reports/goal-progress - Get progress for all goals
  app.fastify.get('/api/reports/goal-progress', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching goal progress');

    try {
      const goals = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.userId, session.user.id));

      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(eq(schema.reflections.userId, session.user.id));

      const currencies = await app.db
        .select()
        .from(schema.currencies)
        .where(eq(schema.currencies.userId, session.user.id));

      // Calculate currency balances from reflection currencyChange field
      const currencyBalances = new Map<string, { earned: number; lost: number }>();

      for (const currency of currencies) {
        let earned = 0;
        let lost = 0;

        for (const reflection of reflections) {
          if (!reflection.currencyChange) continue;

          try {
            const change = typeof reflection.currencyChange === 'string'
              ? JSON.parse(reflection.currencyChange)
              : reflection.currencyChange;

            if (change.currencyId === currency.id) {
              if (change.operation === 'add') {
                earned += change.amount;
              } else if (change.operation === 'subtract') {
                lost += change.amount;
              }
            }
          } catch (e) {
            // Skip invalid currencyChange entries
            continue;
          }
        }

        currencyBalances.set(currency.id, { earned, lost });
      }

      const result = goals.map(goal => {
        let successCount = 0;
        let struggleCount = 0;
        const successReflectionIds: string[] = [];
        const struggleReflectionIds: string[] = [];

        for (const reflection of reflections) {
          if (reflection.linkedGoalId === goal.id) {
            if (reflection.outcome === 'success') {
              successCount++;
              successReflectionIds.push(reflection.id);
            } else if (reflection.outcome === 'struggled') {
              struggleCount++;
              struggleReflectionIds.push(reflection.id);
            }
          }
        }

        // Get currency balances for this goal
        let rewardCurrencyBalance = 0;
        let rewardCurrencySymbol = '';
        let consequenceCurrencyBalance = 0;
        let consequenceCurrencySymbol = '';

        if (goal.rewardCurrencyId) {
          const rewardCurrency = currencies.find(c => c.id === goal.rewardCurrencyId);
          if (rewardCurrency) {
            const balance = currencyBalances.get(goal.rewardCurrencyId);
            if (balance) {
              rewardCurrencyBalance = balance.earned - balance.lost;
            }
            rewardCurrencySymbol = rewardCurrency.symbol || '';
          }
        }

        if (goal.consequenceCurrencyId) {
          const consequenceCurrency = currencies.find(c => c.id === goal.consequenceCurrencyId);
          if (consequenceCurrency) {
            const balance = currencyBalances.get(goal.consequenceCurrencyId);
            if (balance) {
              consequenceCurrencyBalance = balance.earned - balance.lost;
            }
            consequenceCurrencySymbol = consequenceCurrency.symbol || '';
          }
        }

        return {
          goalId: goal.id,
          goalTitle: goal.title,
          progress: goal.progress,
          successCount,
          struggleCount,
          successReflectionIds,
          struggleReflectionIds,
          rewardCurrencyBalance,
          rewardCurrencySymbol,
          consequenceCurrencyBalance,
          consequenceCurrencySymbol,
        };
      });

      app.logger.info({ userId: session.user.id, count: result.length }, 'Goal progress report generated');
      return result;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate goal progress report');
      throw error;
    }
  });
}
