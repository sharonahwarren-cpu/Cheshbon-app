import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lte } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { user } from '../db/auth-schema.js';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

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

  // GET /api/user/data/export - Export user data in CSV or PDF format
  app.fastify.get('/api/user/data/export', {
    schema: {
      description: 'Export user data in CSV or PDF format',
      tags: ['user'],
      querystring: {
        type: 'object',
        required: ['dataType', 'format'],
        properties: {
          dataType: {
            type: 'string',
            enum: ['all', 'journals', 'reflections', 'goals', 'strategies', 'currencies', 'life-areas'],
            description: 'Type of data to export',
          },
          format: {
            type: 'string',
            enum: ['csv', 'pdf'],
            description: 'Export format',
          },
          startDate: {
            type: 'string',
            format: 'date-time',
            description: 'ISO 8601 start date for filtering',
          },
          endDate: {
            type: 'string',
            format: 'date-time',
            description: 'ISO 8601 end date for filtering',
          },
        },
      },
      response: {
        200: {
          description: 'File download',
          type: 'string',
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
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
    const { dataType, format, startDate, endDate } = request.query as any;

    // Validate required parameters
    if (!dataType || !['all', 'journals', 'reflections', 'goals', 'strategies', 'currencies', 'life-areas'].includes(dataType)) {
      return reply.status(400).send({
        error: 'Invalid dataType parameter',
      });
    }

    if (!format || !['csv', 'pdf'].includes(format)) {
      return reply.status(400).send({
        error: 'Invalid format parameter',
      });
    }

    app.logger.info(
      { userId, dataType, format, startDate, endDate },
      'User initiated data export'
    );

    try {
      const db = app.db;
      let csvData = '';
      const exportDate = new Date().toISOString();

      // Helper function to build date filters for a specific table
      const buildDateFilters = (dateField: any): any[] => {
        const filters: any[] = [];
        if (startDate) {
          filters.push(gte(dateField, new Date(startDate)));
        }
        if (endDate) {
          filters.push(lte(dateField, new Date(endDate)));
        }
        return filters;
      };

      // Export based on dataType
      if (dataType === 'journals' || dataType === 'all') {
        const journalFilters = buildDateFilters(schema.journalEntries.createdAt);
        const journalData = await db
          .select()
          .from(schema.journalEntries)
          .where(and(eq(schema.journalEntries.userId, userId), ...journalFilters));

        const journalCsv = generateJournalsCsv(journalData);
        if (dataType === 'journals') {
          csvData = journalCsv;
        } else {
          csvData += '=== JOURNALS ===\n' + journalCsv + '\n\n';
        }
      }

      if (dataType === 'reflections' || dataType === 'all') {
        const reflectionFilters = buildDateFilters(schema.reflections.createdAt);
        const reflectionData = await db
          .select()
          .from(schema.reflections)
          .where(and(eq(schema.reflections.userId, userId), ...reflectionFilters));

        const reflectionCsv = generateReflectionsCsv(reflectionData);
        if (dataType === 'reflections') {
          csvData = reflectionCsv;
        } else {
          csvData += '=== REFLECTIONS ===\n' + reflectionCsv + '\n\n';
        }
      }

      if (dataType === 'goals' || dataType === 'all') {
        const goalData = await db
          .select()
          .from(schema.goals)
          .where(eq(schema.goals.userId, userId));

        const goalCsv = generateGoalsCsv(goalData);
        if (dataType === 'goals') {
          csvData = goalCsv;
        } else {
          csvData += '=== GOALS ===\n' + goalCsv + '\n\n';
        }
      }

      if (dataType === 'strategies' || dataType === 'all') {
        const strategyData = await db
          .select()
          .from(schema.strategies)
          .where(eq(schema.strategies.userId, userId));

        const strategyCsv = generateStrategiesCsv(strategyData);
        if (dataType === 'strategies') {
          csvData = strategyCsv;
        } else {
          csvData += '=== STRATEGIES ===\n' + strategyCsv + '\n\n';
        }
      }

      if (dataType === 'currencies' || dataType === 'all') {
        const currencyData = await db
          .select()
          .from(schema.currencies)
          .where(eq(schema.currencies.userId, userId));

        const currencyCsv = generateCurrenciesCsv(currencyData);
        if (dataType === 'currencies') {
          csvData = currencyCsv;
        } else {
          csvData += '=== CURRENCIES ===\n' + currencyCsv + '\n\n';
        }
      }

      if (dataType === 'life-areas' || dataType === 'all') {
        const lifeAreaData = await db
          .select()
          .from(schema.lifeAreas)
          .where(eq(schema.lifeAreas.userId, userId));

        const lifeAreaCsv = generateLifeAreasCsv(lifeAreaData);
        if (dataType === 'life-areas') {
          csvData = lifeAreaCsv;
        } else {
          csvData += '=== LIFE AREAS ===\n' + lifeAreaCsv + '\n\n';
        }
      }

      // Return based on format
      if (format === 'csv') {
        reply.type('text/csv; charset=utf-8');
        reply.header('Content-Disposition', `attachment; filename="cheshbon-export-${dataType}-${new Date().toISOString().split('T')[0]}.csv"`);

        // Add BOM for Excel compatibility
        const bom = '\uFEFF';
        return reply.send(bom + csvData);
      } else if (format === 'pdf') {
        // Generate PDF
        const pdfBuffer = await generatePdf(csvData, dataType, exportDate);

        reply.type('application/pdf');
        reply.header('Content-Disposition', `attachment; filename="cheshbon-export-${dataType}-${new Date().toISOString().split('T')[0]}.pdf"`);

        return reply.send(pdfBuffer);
      }
    } catch (error) {
      app.logger.error(
        { userId, dataType, format, err: error },
        'Failed to export user data'
      );

      return reply.status(500).send({
        error: 'Failed to export data',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  });
}

// Helper function to escape CSV fields
function escapeCsvField(field: any): string {
  if (field === null || field === undefined) return '';

  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Helper function to generate CSV row
function generateCsvRow(fields: any[]): string {
  return fields.map(escapeCsvField).join(',');
}

// CSV generators for different data types
function generateJournalsCsv(journals: any[]): string {
  let csv = generateCsvRow(['Date', 'Content', 'Mood', 'Created At']) + '\n';

  for (const journal of journals) {
    csv += generateCsvRow([
      journal.entryDate,
      journal.content,
      journal.mood || '',
      new Date(journal.createdAt).toLocaleString(),
    ]) + '\n';
  }

  return csv;
}

function generateReflectionsCsv(reflections: any[]): string {
  let csv = generateCsvRow([
    'Date', 'Category', 'Type', 'Description', 'Outcome', 'Linked Goal',
    'Gains', 'Losses', 'Was Worth It', 'Additional Thoughts', 'Created At'
  ]) + '\n';

  for (const reflection of reflections) {
    csv += generateCsvRow([
      reflection.entryDate,
      reflection.category || '',
      reflection.reflectionType || '',
      reflection.description || '',
      reflection.outcome || '',
      reflection.linkedGoalId || '',
      reflection.currencyChange?.gains || '',
      reflection.currencyChange?.losses || '',
      reflection.wasWorthIt || '',
      reflection.additionalThoughts || '',
      new Date(reflection.createdAt).toLocaleString(),
    ]) + '\n';
  }

  return csv;
}

function generateGoalsCsv(goals: any[]): string {
  let csv = generateCsvRow([
    'Title', 'Description', 'Type', 'Status', 'Completed', 'Progress',
    'Life Area', 'Created At'
  ]) + '\n';

  for (const goal of goals) {
    csv += generateCsvRow([
      goal.title,
      goal.description || '',
      goal.type || '',
      goal.status || '',
      goal.completed ? 'Yes' : 'No',
      goal.progress || '0',
      goal.lifeAreaId || '',
      new Date(goal.createdAt).toLocaleString(),
    ]) + '\n';
  }

  return csv;
}

function generateStrategiesCsv(strategies: any[]): string {
  let csv = generateCsvRow([
    'Name', 'Description', 'Category', 'Success Count', 'Failure Count',
    'Times Used', 'Success Rate', 'Created At'
  ]) + '\n';

  for (const strategy of strategies) {
    const total = strategy.successCount + strategy.failureCount;
    const successRate = total > 0 ? ((strategy.successCount / total) * 100).toFixed(2) : '0';

    csv += generateCsvRow([
      strategy.name,
      strategy.description || '',
      strategy.category || '',
      strategy.successCount,
      strategy.failureCount,
      strategy.timesUsed,
      `${successRate}%`,
      new Date(strategy.createdAt).toLocaleString(),
    ]) + '\n';
  }

  return csv;
}

function generateCurrenciesCsv(currencies: any[]): string {
  let csv = generateCsvRow(['Name', 'Symbol', 'Type', 'On Success', 'On Failure']) + '\n';

  for (const currency of currencies) {
    csv += generateCsvRow([
      currency.name,
      currency.symbol || '',
      currency.type || '',
      currency.onSuccess || '',
      currency.onFailure || '',
    ]) + '\n';
  }

  return csv;
}

function generateLifeAreasCsv(areas: any[]): string {
  let csv = generateCsvRow(['Name', 'Parent Name', 'Icon', 'Color', 'Display Order', 'Show Progress']) + '\n';

  for (const area of areas) {
    csv += generateCsvRow([
      area.name,
      area.parentId || '',
      area.icon || '',
      area.color || '',
      area.displayOrder,
      area.showProgress ? 'Yes' : 'No',
    ]) + '\n';
  }

  return csv;
}

// PDF generator
async function generatePdf(csvData: string, dataType: string, exportDate: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      bufferPages: true,
      autoFirstPage: true,
    });

    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on('error', reject);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Cheshbon Export', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Data Type: ${dataType.toUpperCase()}`, { align: 'center' });
    doc.fontSize(10).text(`Export Date: ${new Date(exportDate).toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);

    // Content
    doc.fontSize(9).font('Helvetica');

    const lines = csvData.split('\n');
    let pageNumber = 1;
    let lineCount = 0;
    const linesPerPage = 40;

    for (const line of lines) {
      if (lineCount >= linesPerPage) {
        doc.addPage();
        pageNumber++;
        lineCount = 0;

        // Add page number
        doc.fontSize(8).text(`Page ${pageNumber}`, { align: 'right' });
      }

      if (line.trim()) {
        doc.text(line);
        lineCount++;
      }
    }

    // Footer with page numbers
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).text(`Page ${i + 1} of ${pageCount}`, 50, doc.page.height - 50, { align: 'center' });
    }

    doc.end();
  });
}
