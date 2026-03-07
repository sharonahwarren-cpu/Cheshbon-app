import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { user } from '../db/auth-schema.js';

export function registerUserRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // DELETE /api/user/data - Deletes all user data but keeps the account
  app.fastify.delete('/api/user/data', {
    schema: {
      description: 'Delete all user-specific data while keeping the account',
      tags: ['user'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            deletedRecords: {
              type: 'object',
              properties: {
                goals: { type: 'number' },
                reflections: { type: 'number' },
                journals: { type: 'number' },
                lifeAreas: { type: 'number' },
                strategies: { type: 'number' },
                currencies: { type: 'number' },
                gainsLosses: { type: 'number' },
                gainLossCategories: { type: 'number' },
                reflectionMotivations: { type: 'number' },
                alarms: { type: 'number' },
                mitzvot: { type: 'number' },
                mitzvotCategories: { type: 'number' },
                currencyTransactions: { type: 'number' },
                cheshbonSessions: { type: 'number' },
                cheshbonMessages: { type: 'number' },
                reflectionConversations: { type: 'number' },
                reflectionMessages: { type: 'number' },
                userPreferences: { type: 'number' },
                goalCompletions: { type: 'number' },
                goalCurrencyBalances: { type: 'number' },
                userLocations: { type: 'number' },
                mitzvotCompletions: { type: 'number' },
              },
            },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;

    app.logger.info(
      { userId, operation: 'DELETE_USER_DATA' },
      'User initiated data deletion'
    );

    try {
      const db = app.db;
      const deletedRecords: Record<string, number> = {};

      // Delete all user data from each table
      const tables = [
        { table: schema.goals, name: 'goals' },
        { table: schema.reflections, name: 'reflections' },
        { table: schema.journalEntries, name: 'journals' },
        { table: schema.lifeAreas, name: 'lifeAreas' },
        { table: schema.strategies, name: 'strategies' },
        { table: schema.currencies, name: 'currencies' },
        { table: schema.gainsLosses, name: 'gainsLosses' },
        { table: schema.gainLossCategories, name: 'gainLossCategories' },
        { table: schema.reflectionMotivations, name: 'reflectionMotivations' },
        { table: schema.alarms, name: 'alarms' },
        { table: schema.mitzvot, name: 'mitzvot' },
        { table: schema.mitzvotCategories, name: 'mitzvotCategories' },
        { table: schema.currencyTransactions, name: 'currencyTransactions' },
        { table: schema.cheshbonSessions, name: 'cheshbonSessions' },
        { table: schema.cheshbonMessages, name: 'cheshbonMessages' },
        { table: schema.reflectionConversations, name: 'reflectionConversations' },
        { table: schema.reflectionMessages, name: 'reflectionMessages' },
        { table: schema.userPreferences, name: 'userPreferences' },
        { table: schema.goalCompletions, name: 'goalCompletions' },
        { table: schema.goalCurrencyBalances, name: 'goalCurrencyBalances' },
        { table: schema.userLocations, name: 'userLocations' },
        { table: schema.mitzvotCompletions, name: 'mitzvotCompletions' },
      ];

      for (const { table, name } of tables) {
        try {
          await db.delete(table).where(
            eq(table.userId, userId)
          );
          deletedRecords[name] = 1;

          app.logger.info(
            { userId, table: name },
            `Deleted records from ${name}`
          );
        } catch (tableError) {
          app.logger.warn(
            { userId, table: name, err: tableError },
            `Error deleting from ${name} - may not exist or already empty`
          );
          deletedRecords[name] = 0;
        }
      }

      const totalDeleted = Object.values(deletedRecords).reduce((a, b) => a + b, 0);

      app.logger.info(
        { userId, operation: 'DELETE_USER_DATA', totalRecords: totalDeleted, deletedRecords },
        `User data deletion completed - ${totalDeleted} total records deleted`
      );

      return {
        success: true,
        message: `All user data deleted successfully (${totalDeleted} records removed)`,
        deletedRecords,
      };
    } catch (error) {
      app.logger.error(
        { userId, err: error, operation: 'DELETE_USER_DATA' },
        'Failed to delete user data'
      );

      return reply.status(500).send({
        error: 'Failed to delete user data',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  });

  // DELETE /api/user/account - Permanently deletes the user account and ALL associated data
  app.fastify.delete('/api/user/account', {
    schema: {
      description: 'Permanently delete the user account and all associated data',
      tags: ['user'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            deletedRecords: {
              type: 'object',
            },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;

    app.logger.warn(
      { userId, operation: 'DELETE_USER_ACCOUNT' },
      'User initiated account deletion - this is irreversible'
    );

    try {
      const db = app.db;
      const deletedRecords: Record<string, number> = {};

      // First, delete all user data from each table (same as DELETE /api/user/data)
      const tables = [
        { table: schema.goals, name: 'goals' },
        { table: schema.reflections, name: 'reflections' },
        { table: schema.journalEntries, name: 'journals' },
        { table: schema.lifeAreas, name: 'lifeAreas' },
        { table: schema.strategies, name: 'strategies' },
        { table: schema.currencies, name: 'currencies' },
        { table: schema.gainsLosses, name: 'gainsLosses' },
        { table: schema.gainLossCategories, name: 'gainLossCategories' },
        { table: schema.reflectionMotivations, name: 'reflectionMotivations' },
        { table: schema.alarms, name: 'alarms' },
        { table: schema.mitzvot, name: 'mitzvot' },
        { table: schema.mitzvotCategories, name: 'mitzvotCategories' },
        { table: schema.currencyTransactions, name: 'currencyTransactions' },
        { table: schema.cheshbonSessions, name: 'cheshbonSessions' },
        { table: schema.cheshbonMessages, name: 'cheshbonMessages' },
        { table: schema.reflectionConversations, name: 'reflectionConversations' },
        { table: schema.reflectionMessages, name: 'reflectionMessages' },
        { table: schema.userPreferences, name: 'userPreferences' },
        { table: schema.goalCompletions, name: 'goalCompletions' },
        { table: schema.goalCurrencyBalances, name: 'goalCurrencyBalances' },
        { table: schema.userLocations, name: 'userLocations' },
        { table: schema.mitzvotCompletions, name: 'mitzvotCompletions' },
      ];

      for (const { table, name } of tables) {
        try {
          await db.delete(table).where(
            eq(table.userId, userId)
          );
          deletedRecords[name] = 1;

          app.logger.info(
            { userId, table: name },
            `Deleted records from ${name}`
          );
        } catch (tableError) {
          app.logger.warn(
            { userId, table: name, err: tableError },
            `Error deleting from ${name} - may not exist or already empty`
          );
          deletedRecords[name] = 0;
        }
      }

      // Then delete the user account from auth tables
      try {
        await db.delete(user).where(
          eq(user.id, userId)
        );
        deletedRecords['userAccount'] = 1;

        app.logger.info(
          { userId, operation: 'DELETE_USER_ACCOUNT' },
          'User account deleted from auth system'
        );
      } catch (userDeleteError) {
        app.logger.error(
          { userId, err: userDeleteError, operation: 'DELETE_USER_ACCOUNT' },
          'Failed to delete user account from auth system'
        );
        throw userDeleteError;
      }

      const totalDeleted = Object.values(deletedRecords).reduce((a, b) => a + b, 0);

      app.logger.warn(
        { userId, operation: 'DELETE_USER_ACCOUNT', totalRecords: totalDeleted, deletedRecords },
        `User account permanently deleted - ${totalDeleted} total records removed`
      );

      return {
        success: true,
        message: `Account deleted successfully (${totalDeleted} records removed)`,
        deletedRecords,
      };
    } catch (error) {
      app.logger.error(
        { userId, err: error, operation: 'DELETE_USER_ACCOUNT' },
        'Failed to delete user account'
      );

      return reply.status(500).send({
        error: 'Failed to delete user account',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  });
}
