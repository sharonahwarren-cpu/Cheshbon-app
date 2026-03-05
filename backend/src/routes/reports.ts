import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lte } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { createAuthWrapper } from '../utils/auth-wrapper.js';

export function registerReportsRoutes(app: App) {
  const requireAuth = createAuthWrapper(app);

  // GET /api/reports/currency-balances - Calculate total currency balances from currency_transactions
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

      // Get all goal_currency_balances for the user's goals
      const goals = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.userId, session.user.id));

      const goalBalances = await app.db
        .select()
        .from(schema.goalCurrencyBalances)
        .where(eq(schema.goalCurrencyBalances.userId, session.user.id));

      // Calculate balances for each currency from ONLY goal_currency_balances
      // (currency_transactions are manual operations, not included in total)
      const balances = userCurrencies
        .map(currency => {
          let totalBalance = 0;

          // Sum all goal_currency_balances for this currency
          for (const goalBalance of goalBalances) {
            if (goalBalance.currencyId === currency.id) {
              totalBalance += goalBalance.balance;
            }
          }

          // Build goal breakdown - only include non-zero balances
          const goalBreakdown = goals
            .filter(goal => {
              // Check if this goal has this currency
              return goal.rewardCurrencyId === currency.id || goal.consequenceCurrencyId === currency.id;
            })
            .map(goal => {
              // Find the balance for this goal and currency
              const balance = goalBalances.find(gb => gb.goalId === goal.id && gb.currencyId === currency.id);
              return {
                goalId: goal.id,
                goalTitle: goal.title,
                balance: balance?.balance || 0,
              };
            })
            .filter(gb => gb.balance !== 0); // Only include non-zero balances

          return {
            currencyId: currency.id,
            currencyName: currency.name,
            symbol: currency.symbol,
            totalBalance,
            goalBreakdown,
          };
        })
        .filter(cb => cb.totalBalance !== 0); // Only include currencies with non-zero total balance

      app.logger.info({ userId: session.user.id, currencyCount: balances.length }, 'Currency balances report generated successfully');
      return balances;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate currency balances report');
      throw error;
    }
  });

  // GET /api/reports/currency-reflections/:currencyId - Get all reflections and transactions affecting a currency
  app.fastify.get('/api/reports/currency-reflections/:currencyId', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { currencyId } = request.params as { currencyId: string };

    app.logger.info({ userId: session.user.id, currencyId }, 'Fetching currency reflections and transactions');

    try {
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

      // Filter reflections that affected this currency
      const convertToISO = (date: Date | null) => date ? (date instanceof Date ? date.toISOString() : new Date(date).toISOString()) : null;
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

          // Or check if linked goal uses this currency
          if (reflection.linkedGoalId) {
            const goal = goalMap.get(reflection.linkedGoalId);
            if (goal && (goal.rewardCurrencyId === currencyId || goal.consequenceCurrencyId === currencyId)) {
              return true;
            }
          }

          return false;
        })
        .map(reflection => {
          const goal = reflection.linkedGoalId ? goalMap.get(reflection.linkedGoalId) : null;
          return {
            id: reflection.id,
            entryDate: reflection.entryDate,
            type: 'reflection',
            description: reflection.description,
            linkedGoalId: reflection.linkedGoalId,
            linkedGoalTitle: goal?.title || null,
            outcome: reflection.outcome,
            currencyChange: reflection.currencyChange,
            createdAt: convertToISO(reflection.createdAt),
          };
        });

      // Transform currency transactions
      const currencyTransactionEntries = transactions.map(transaction => {
        const goal = transaction.goalId ? goalMap.get(transaction.goalId) : null;
        const isManualClaim = transaction.transactionType === 'MANUAL_CLAIM';
        const isManualPay = transaction.transactionType === 'MANUAL_PAY';

        return {
          id: transaction.id,
          entryDate: transaction.createdAt instanceof Date ? transaction.createdAt.toISOString() : new Date(transaction.createdAt).toISOString(),
          type: 'transaction',
          transactionType: isManualClaim ? 'claim' : isManualPay ? 'pay' : transaction.transactionType,
          amount: transaction.amount,
          description: transaction.description,
          linkedGoalId: transaction.goalId,
          linkedGoalTitle: goal?.title || null,
          createdAt: transaction.createdAt instanceof Date ? transaction.createdAt.toISOString() : new Date(transaction.createdAt).toISOString(),
        };
      });

      // Merge and sort by appropriate date field descending (newest first)
      // For reflections: use entryDate, for transactions: use createdAt
      const allEntries = [...currencyReflections, ...currencyTransactionEntries].sort((a, b) => {
        const aDate = a.type === 'reflection'
          ? new Date(a.entryDate).getTime()
          : new Date((a as typeof currencyTransactionEntries[0]).createdAt).getTime();
        const bDate = b.type === 'reflection'
          ? new Date(b.entryDate).getTime()
          : new Date((b as typeof currencyTransactionEntries[0]).createdAt).getTime();
        return bDate - aDate;
      });

      app.logger.info({ userId: session.user.id, currencyId, reflectionCount: currencyReflections.length, transactionCount: currencyTransactionEntries.length }, 'Currency reflections and transactions fetched');
      return allEntries;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, currencyId }, 'Failed to fetch currency reflections and transactions');
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

  // GET /api/reports/wins-vs-losses?startDate=...&endDate=...&excludePureCurrencyTransactions=true - Get wins vs losses from reflections
  app.fastify.get('/api/reports/wins-vs-losses', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const query = request.query as {
      startDate?: string;
      endDate?: string;
      excludePureCurrencyTransactions?: string;
    };

    app.logger.info({ userId: session.user.id, filters: query }, 'Fetching wins vs losses report');

    try {
      const conditions: any[] = [eq(schema.reflections.userId, session.user.id)];

      // Add date range filters
      if (query.startDate) {
        const startDateStr = new Date(query.startDate).toISOString().split('T')[0];
        conditions.push(gte(schema.reflections.entryDate, startDateStr));
      }

      if (query.endDate) {
        const endDateStr = new Date(query.endDate).toISOString().split('T')[0];
        conditions.push(lte(schema.reflections.entryDate, endDateStr));
      }

      // Exclude pure currency transactions if requested
      if (query.excludePureCurrencyTransactions === 'true') {
        conditions.push(eq(schema.reflections.isPureCurrencyTransaction, false));
      }

      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(and(...conditions));

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

  // GET /api/reports/success-vs-struggles?startDate=...&endDate=...&excludePureCurrencyTransactions=true - Get success vs struggle counts from reflections
  app.fastify.get('/api/reports/success-vs-struggles', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const query = request.query as {
      startDate?: string;
      endDate?: string;
      excludePureCurrencyTransactions?: string;
    };

    app.logger.info({ userId: session.user.id, filters: query }, 'Fetching success vs struggles report');

    try {
      const conditions: any[] = [eq(schema.reflections.userId, session.user.id)];

      // Add date range filters
      if (query.startDate) {
        const startDateStr = new Date(query.startDate).toISOString().split('T')[0];
        conditions.push(gte(schema.reflections.entryDate, startDateStr));
      }

      if (query.endDate) {
        const endDateStr = new Date(query.endDate).toISOString().split('T')[0];
        conditions.push(lte(schema.reflections.entryDate, endDateStr));
      }

      // Exclude pure currency transactions if requested
      if (query.excludePureCurrencyTransactions === 'true') {
        conditions.push(eq(schema.reflections.isPureCurrencyTransaction, false));
      }

      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(and(...conditions));

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

  // GET /api/reports/reflection-stats?startDate=...&endDate=...&excludePureCurrencyTransactions=true - Get reflection statistics
  app.fastify.get('/api/reports/reflection-stats', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const query = request.query as {
      startDate?: string;
      endDate?: string;
      excludePureCurrencyTransactions?: string;
    };

    app.logger.info({ userId: session.user.id, filters: query }, 'Fetching reflection stats');

    try {
      const conditions: any[] = [eq(schema.reflections.userId, session.user.id)];

      // Add date range filters
      if (query.startDate) {
        const startDateStr = new Date(query.startDate).toISOString().split('T')[0];
        conditions.push(gte(schema.reflections.entryDate, startDateStr));
      }

      if (query.endDate) {
        const endDateStr = new Date(query.endDate).toISOString().split('T')[0];
        conditions.push(lte(schema.reflections.entryDate, endDateStr));
      }

      // Exclude pure currency transactions if requested
      if (query.excludePureCurrencyTransactions === 'true') {
        conditions.push(eq(schema.reflections.isPureCurrencyTransaction, false));
      }

      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(and(...conditions));

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

  // GET /api/reports/journal-count?startDate=...&endDate=... - Get total journal count
  app.fastify.get('/api/reports/journal-count', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const query = request.query as {
      startDate?: string;
      endDate?: string;
    };

    app.logger.info({ userId: session.user.id, filters: query }, 'Fetching journal count');

    try {
      const conditions: any[] = [eq(schema.journalEntries.userId, session.user.id)];

      // Add date range filters
      if (query.startDate) {
        const startDateStr = new Date(query.startDate).toISOString().split('T')[0];
        conditions.push(gte(schema.journalEntries.entryDate, startDateStr));
      }

      if (query.endDate) {
        const endDateStr = new Date(query.endDate).toISOString().split('T')[0];
        conditions.push(lte(schema.journalEntries.entryDate, endDateStr));
      }

      const entries = await app.db
        .select()
        .from(schema.journalEntries)
        .where(and(...conditions));

      const count = entries.length;

      app.logger.info({ userId: session.user.id, count }, 'Journal count generated');
      return { count };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate journal count');
      throw error;
    }
  });

  // GET /api/reports/gains-losses-summary?startDate=...&endDate=... - Get gains and losses summary
  app.fastify.get('/api/reports/gains-losses-summary', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const query = request.query as {
      startDate?: string;
      endDate?: string;
    };

    app.logger.info({ userId: session.user.id, filters: query }, 'Fetching gains losses summary');

    try {
      // Get all gains/losses definitions for name lookup
      const allGainsLosses = await app.db
        .select()
        .from(schema.gainsLosses)
        .where(eq(schema.gainsLosses.userId, session.user.id));

      const gainsLossesMap = new Map(allGainsLosses.map(gl => [gl.id, gl]));

      // Get reflections with date filters
      const conditions: any[] = [eq(schema.reflections.userId, session.user.id)];

      if (query.startDate) {
        const startDateStr = new Date(query.startDate).toISOString().split('T')[0];
        conditions.push(gte(schema.reflections.entryDate, startDateStr));
      }

      if (query.endDate) {
        const endDateStr = new Date(query.endDate).toISOString().split('T')[0];
        conditions.push(lte(schema.reflections.entryDate, endDateStr));
      }

      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(and(...conditions));

      // Count gain/loss occurrences from reflections
      let totalGains = 0;
      let totalLosses = 0;
      const byCategoryMap = new Map<string, { gains: number; losses: number }>();
      const gainsCounts = new Map<string, number>();
      const lossesCounts = new Map<string, number>();

      reflections.forEach(reflection => {
        // Process gained IDs
        if (reflection.gainedIds && Array.isArray(reflection.gainedIds)) {
          reflection.gainedIds.forEach((gainId: any) => {
            totalGains++;
            gainsCounts.set(gainId, (gainsCounts.get(gainId) || 0) + 1);

            const gainItem = gainsLossesMap.get(gainId);
            if (gainItem) {
              const cat = gainItem.category || 'Uncategorized';
              const current = byCategoryMap.get(cat) || { gains: 0, losses: 0 };
              current.gains++;
              byCategoryMap.set(cat, current);
            }
          });
        }

        // Process lost IDs
        if (reflection.lostIds && Array.isArray(reflection.lostIds)) {
          reflection.lostIds.forEach((lossId: any) => {
            totalLosses++;
            lossesCounts.set(lossId, (lossesCounts.get(lossId) || 0) + 1);

            const lossItem = gainsLossesMap.get(lossId);
            if (lossItem) {
              const cat = lossItem.category || 'Uncategorized';
              const current = byCategoryMap.get(cat) || { gains: 0, losses: 0 };
              current.losses++;
              byCategoryMap.set(cat, current);
            }
          });
        }
      });

      const byCategory = Array.from(byCategoryMap.entries()).map(([category, counts]) => ({
        category,
        ...counts,
      }));

      const topGains = Array.from(gainsCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, count]) => {
          const item = gainsLossesMap.get(id);
          return { id, name: item?.name || '', count };
        });

      const topLosses = Array.from(lossesCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, count]) => {
          const item = gainsLossesMap.get(id);
          return { id, name: item?.name || '', count };
        });

      app.logger.info({ userId: session.user.id, totalGains, totalLosses }, 'Gains losses summary generated');
      return { totalGains, totalLosses, byCategory, topGains, topLosses };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate gains losses summary');
      throw error;
    }
  });

  // GET /api/reports/behavior-counts?startDate=...&endDate=...&excludePureCurrencyTransactions=true - Get behavior category counts
  app.fastify.get('/api/reports/behavior-counts', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const query = request.query as {
      startDate?: string;
      endDate?: string;
      excludePureCurrencyTransactions?: string;
    };

    app.logger.info({ userId: session.user.id, filters: query }, 'Fetching behavior counts');

    try {
      const conditions: any[] = [eq(schema.reflections.userId, session.user.id)];

      // Add date range filters
      if (query.startDate) {
        const startDateStr = new Date(query.startDate).toISOString().split('T')[0];
        conditions.push(gte(schema.reflections.entryDate, startDateStr));
      }

      if (query.endDate) {
        const endDateStr = new Date(query.endDate).toISOString().split('T')[0];
        conditions.push(lte(schema.reflections.entryDate, endDateStr));
      }

      // Exclude pure currency transactions if requested
      if (query.excludePureCurrencyTransactions === 'true') {
        conditions.push(eq(schema.reflections.isPureCurrencyTransaction, false));
      }

      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(and(...conditions));

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

      // Get per-goal currency balances from goal_currency_balances table
      const goalCurrencyBalances = await app.db
        .select()
        .from(schema.goalCurrencyBalances)
        .where(eq(schema.goalCurrencyBalances.userId, session.user.id));

      const result = goals
        .map(goal => {
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

          // Get currency balances for this goal from goal_currency_balances table
          let rewardCurrencyBalance = 0;
          let rewardCurrencySymbol = '';
          let consequenceCurrencyBalance = 0;
          let consequenceCurrencySymbol = '';

          if (goal.rewardCurrencyId) {
            const rewardCurrency = currencies.find(c => c.id === goal.rewardCurrencyId);
            if (rewardCurrency) {
              const balance = goalCurrencyBalances.find(gcb => gcb.goalId === goal.id && gcb.currencyId === goal.rewardCurrencyId);
              if (balance) {
                rewardCurrencyBalance = balance.balance;
              }
              rewardCurrencySymbol = rewardCurrency.symbol || '';
            }
          }

          if (goal.consequenceCurrencyId) {
            const consequenceCurrency = currencies.find(c => c.id === goal.consequenceCurrencyId);
            if (consequenceCurrency) {
              const balance = goalCurrencyBalances.find(gcb => gcb.goalId === goal.id && gcb.currencyId === goal.consequenceCurrencyId);
              if (balance) {
                consequenceCurrencyBalance = balance.balance;
              }
              consequenceCurrencySymbol = consequenceCurrency.symbol || '';
            }
          }

          return {
            goalId: goal.id,
            goalTitle: goal.title,
            progress: goal.progress,
            status: goal.status || 'ACTIVE',
            successCount,
            struggleCount,
            successReflectionIds,
            struggleReflectionIds,
            currentStreak: goal.currentStreak || 0,
            bestStreak: goal.bestStreak || 0,
            rewardCurrencyBalance,
            rewardCurrencySymbol,
            consequenceCurrencyBalance,
            consequenceCurrencySymbol,
          };
        })
        .sort((a, b) => {
          // Sort by status (ACTIVE first, DEACTIVATED last)
          if (a.status !== b.status) {
            return a.status === 'ACTIVE' ? -1 : 1;
          }
          // Then sort by title alphabetically
          return a.goalTitle.localeCompare(b.goalTitle);
        });

      app.logger.info({ userId: session.user.id, count: result.length }, 'Goal progress report generated');
      return result;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate goal progress report');
      throw error;
    }
  });

  // GET /api/reports/gains-losses-distribution?startDate=...&endDate=... - Get gains and losses distribution analysis
  app.fastify.get('/api/reports/gains-losses-distribution', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const query = request.query as {
      startDate?: string;
      endDate?: string;
    };

    app.logger.info({ userId: session.user.id, filters: query }, 'Fetching gains losses distribution');

    try {
      // Get all gains/losses definitions for metadata
      const allGainsLosses = await app.db
        .select()
        .from(schema.gainsLosses)
        .where(eq(schema.gainsLosses.userId, session.user.id));

      const gainsLossesMap = new Map(allGainsLosses.map(gl => [gl.id, gl]));

      // Get reflections with date filters
      const conditions: any[] = [eq(schema.reflections.userId, session.user.id)];

      if (query.startDate) {
        const startDateStr = new Date(query.startDate).toISOString().split('T')[0];
        conditions.push(gte(schema.reflections.entryDate, startDateStr));
      }

      if (query.endDate) {
        const endDateStr = new Date(query.endDate).toISOString().split('T')[0];
        conditions.push(lte(schema.reflections.entryDate, endDateStr));
      }

      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(and(...conditions));

      // Count gains and losses from reflections
      const gainIdCounts = new Map<string, number>();
      const lossIdCounts = new Map<string, number>();

      reflections.forEach(reflection => {
        if (reflection.gainedIds && Array.isArray(reflection.gainedIds)) {
          reflection.gainedIds.forEach((gainId: any) => {
            gainIdCounts.set(gainId, (gainIdCounts.get(gainId) || 0) + 1);
          });
        }
        if (reflection.lostIds && Array.isArray(reflection.lostIds)) {
          reflection.lostIds.forEach((lossId: any) => {
            lossIdCounts.set(lossId, (lossIdCounts.get(lossId) || 0) + 1);
          });
        }
      });

      // Convert counts to gain/loss items with metadata
      const gains = Array.from(gainIdCounts.entries()).map(([id, count]) => {
        const item = gainsLossesMap.get(id);
        return { ...item, id, count } as any;
      });

      const losses = Array.from(lossIdCounts.entries()).map(([id, count]) => {
        const item = gainsLossesMap.get(id);
        return { ...item, id, count } as any;
      });

      // Calculate total counts from gain/loss occurrences in reflections
      const totalGains = gains.reduce((sum, g) => sum + (g.count || 0), 0);
      const totalLosses = losses.reduce((sum, l) => sum + (l.count || 0), 0);

      // Helper function to calculate percentage
      const getPercentage = (count: number, total: number): number => {
        return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
      };

      // Calculate term distribution for gains
      const gainsTermDist = {
        short: {
          count: gains.filter(g => g.term === 'short').reduce((sum, g) => sum + (g.count || 0), 0),
          percentage: 0,
        },
        medium: {
          count: gains.filter(g => g.term === 'medium').reduce((sum, g) => sum + (g.count || 0), 0),
          percentage: 0,
        },
        long: {
          count: gains.filter(g => g.term === 'long').reduce((sum, g) => sum + (g.count || 0), 0),
          percentage: 0,
        },
      };

      // Calculate percentages for gains terms
      Object.keys(gainsTermDist).forEach(key => {
        gainsTermDist[key as keyof typeof gainsTermDist].percentage = getPercentage(
          gainsTermDist[key as keyof typeof gainsTermDist].count,
          totalGains
        );
      });

      // Calculate term distribution for losses
      const lossesTermDist = {
        short: {
          count: losses.filter(l => l.term === 'short').reduce((sum, l) => sum + (l.count || 0), 0),
          percentage: 0,
        },
        medium: {
          count: losses.filter(l => l.term === 'medium').reduce((sum, l) => sum + (l.count || 0), 0),
          percentage: 0,
        },
        long: {
          count: losses.filter(l => l.term === 'long').reduce((sum, l) => sum + (l.count || 0), 0),
          percentage: 0,
        },
      };

      // Calculate percentages for losses terms
      Object.keys(lossesTermDist).forEach(key => {
        lossesTermDist[key as keyof typeof lossesTermDist].percentage = getPercentage(
          lossesTermDist[key as keyof typeof lossesTermDist].count,
          totalLosses
        );
      });

      // Calculate category distribution for gains
      const gainsCategoryMap = new Map<string, number>();
      gains.forEach(g => {
        const cat = g.category || 'Uncategorized';
        gainsCategoryMap.set(cat, (gainsCategoryMap.get(cat) || 0) + (g.count || 0));
      });

      const gainsCategoryDist = Array.from(gainsCategoryMap.entries())
        .map(([category, count]) => ({
          category,
          count,
          percentage: getPercentage(count, totalGains),
        }))
        .sort((a, b) => b.count - a.count);

      // Calculate category distribution for losses
      const lossesCategoryMap = new Map<string, number>();
      losses.forEach(l => {
        const cat = l.category || 'Uncategorized';
        lossesCategoryMap.set(cat, (lossesCategoryMap.get(cat) || 0) + (l.count || 0));
      });

      const lossesCategoryDist = Array.from(lossesCategoryMap.entries())
        .map(([category, count]) => ({
          category,
          count,
          percentage: getPercentage(count, totalLosses),
        }))
        .sort((a, b) => b.count - a.count);

      // Get top 5 categories for gains
      const topGains = gainsCategoryDist.slice(0, 5);

      // Get top 5 categories for losses
      const topLosses = lossesCategoryDist.slice(0, 5);

      const result = {
        totalGains,
        totalLosses,
        termDistribution: {
          gains: gainsTermDist,
          losses: lossesTermDist,
        },
        categoryDistribution: {
          gains: gainsCategoryDist,
          losses: lossesCategoryDist,
        },
        topCategories: {
          gains: topGains,
          losses: topLosses,
        },
      };

      app.logger.info({ userId: session.user.id, totalGains, totalLosses }, 'Gains losses distribution report generated');
      return result;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate gains losses distribution report');
      throw error;
    }
  });

  // GET /api/reports/top-motivations-by-type?startDate=...&endDate=... - Get top motivations by reflection type
  app.fastify.get('/api/reports/top-motivations-by-type', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const query = request.query as {
      startDate?: string;
      endDate?: string;
    };

    app.logger.info({ userId: session.user.id, filters: query }, 'Fetching top motivations by type');

    try {
      const conditions: any[] = [eq(schema.reflections.userId, session.user.id)];

      // Add date range filters
      if (query.startDate) {
        const startDateStr = new Date(query.startDate).toISOString().split('T')[0];
        conditions.push(gte(schema.reflections.entryDate, startDateStr));
      }

      if (query.endDate) {
        const endDateStr = new Date(query.endDate).toISOString().split('T')[0];
        conditions.push(lte(schema.reflections.entryDate, endDateStr));
      }

      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(and(...conditions));

      const motivations = await app.db
        .select()
        .from(schema.reflectionMotivations)
        .where(eq(schema.reflectionMotivations.userId, session.user.id));

      // Create motivation map for name lookup
      const motivationMap = new Map(motivations.map(m => [m.id, m.name]));

      // Count motivations by type
      const proactiveCounts = new Map<string, { id: string; name: string; count: number }>();
      const restraintCounts = new Map<string, { id: string; name: string; count: number }>();

      reflections.forEach(reflection => {
        if (reflection.motivationIds && Array.isArray(reflection.motivationIds)) {
          reflection.motivationIds.forEach((motivationId: any) => {
            const motivationName = motivationMap.get(motivationId);
            if (motivationName) {
              if (reflection.type === 'Proactive') {
                const current = proactiveCounts.get(motivationId) || { id: motivationId, name: motivationName, count: 0 };
                current.count++;
                proactiveCounts.set(motivationId, current);
              } else if (reflection.type === 'Restraint') {
                const current = restraintCounts.get(motivationId) || { id: motivationId, name: motivationName, count: 0 };
                current.count++;
                restraintCounts.set(motivationId, current);
              }
            }
          });
        }
      });

      // Convert to arrays and sort by count
      const proactiveResult = Array.from(proactiveCounts.values())
        .sort((a, b) => b.count - a.count)
        .map(({ id, name, count }) => ({
          motivationId: id,
          motivationName: name,
          count,
        }));

      const restraintResult = Array.from(restraintCounts.values())
        .sort((a, b) => b.count - a.count)
        .map(({ id, name, count }) => ({
          motivationId: id,
          motivationName: name,
          count,
        }));

      const result = {
        proactive: proactiveResult,
        restraint: restraintResult,
      };

      app.logger.info({ userId: session.user.id, proactiveCount: proactiveResult.length, restraintCount: restraintResult.length }, 'Top motivations by type generated');
      return result;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate top motivations by type');
      throw error;
    }
  });

  // GET /api/reports/top-motivations-by-outcome?startDate=...&endDate=... - Get top motivations by outcome
  app.fastify.get('/api/reports/top-motivations-by-outcome', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const query = request.query as {
      startDate?: string;
      endDate?: string;
    };

    app.logger.info({ userId: session.user.id, filters: query }, 'Fetching top motivations by outcome');

    try {
      const conditions: any[] = [eq(schema.reflections.userId, session.user.id)];

      // Add date range filters
      if (query.startDate) {
        const startDateStr = new Date(query.startDate).toISOString().split('T')[0];
        conditions.push(gte(schema.reflections.entryDate, startDateStr));
      }

      if (query.endDate) {
        const endDateStr = new Date(query.endDate).toISOString().split('T')[0];
        conditions.push(lte(schema.reflections.entryDate, endDateStr));
      }

      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(and(...conditions));

      const motivations = await app.db
        .select()
        .from(schema.reflectionMotivations)
        .where(eq(schema.reflectionMotivations.userId, session.user.id));

      // Create motivation map for name lookup
      const motivationMap = new Map(motivations.map(m => [m.id, m.name]));

      // Count motivations by outcome (only for reflections with linkedGoalId)
      const successCounts = new Map<string, { id: string; name: string; count: number }>();
      const struggleCounts = new Map<string, { id: string; name: string; count: number }>();

      reflections.forEach(reflection => {
        // Only process reflections with linkedGoalId
        if (reflection.linkedGoalId && reflection.motivationIds && Array.isArray(reflection.motivationIds)) {
          reflection.motivationIds.forEach((motivationId: any) => {
            const motivationName = motivationMap.get(motivationId);
            if (motivationName) {
              if (reflection.outcome === 'success') {
                const current = successCounts.get(motivationId) || { id: motivationId, name: motivationName, count: 0 };
                current.count++;
                successCounts.set(motivationId, current);
              } else if (reflection.outcome === 'struggled') {
                const current = struggleCounts.get(motivationId) || { id: motivationId, name: motivationName, count: 0 };
                current.count++;
                struggleCounts.set(motivationId, current);
              }
            }
          });
        }
      });

      // Convert to arrays and sort by count
      const successResult = Array.from(successCounts.values())
        .sort((a, b) => b.count - a.count)
        .map(({ id, name, count }) => ({
          motivationId: id,
          motivationName: name,
          count,
        }));

      const struggleResult = Array.from(struggleCounts.values())
        .sort((a, b) => b.count - a.count)
        .map(({ id, name, count }) => ({
          motivationId: id,
          motivationName: name,
          count,
        }));

      const result = {
        success: successResult,
        struggle: struggleResult,
      };

      app.logger.info({ userId: session.user.id, successCount: successResult.length, struggleCount: struggleResult.length }, 'Top motivations by outcome generated');
      return result;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate top motivations by outcome');
      throw error;
    }
  });
}
