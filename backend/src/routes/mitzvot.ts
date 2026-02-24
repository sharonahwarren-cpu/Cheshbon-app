import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, inArray } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { getNextActivations, type ScheduleConfig } from '../utils/goal-scheduler.js';

export function registerMitzvotRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/mitzvot - Get all mitzvot for the user
  app.fastify.get('/api/mitzvot', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching mitzvot');

    try {
      const mitzvotData = await app.db
        .select()
        .from(schema.mitzvot)
        .where(eq(schema.mitzvot.userId, session.user.id))
        .orderBy(desc(schema.mitzvot.createdAt));

      // Fetch categories for category names
      const categoryIds = [...new Set(mitzvotData.map(m => m.categoryId).filter(Boolean))];
      const categoriesMap = new Map();

      if (categoryIds.length > 0) {
        const categories = await app.db
          .select()
          .from(schema.mitzvotCategories)
          .where(inArray(schema.mitzvotCategories.id, categoryIds as string[]));

        categories.forEach(cat => categoriesMap.set(cat.id, cat.name));
      }

      // Fetch completion counts for each mitzvah
      const mitzvahIds = mitzvotData.map(m => m.id);
      const completionCounts = new Map();

      if (mitzvahIds.length > 0) {
        const completions = await app.db
          .select()
          .from(schema.mitzvotCompletions)
          .where(inArray(schema.mitzvotCompletions.mitzvahId, mitzvahIds));

        completions.forEach(comp => {
          const key = `${comp.mitzvahId}-${comp.isSuccess ? 'success' : 'struggle'}`;
          completionCounts.set(key, (completionCounts.get(key) || 0) + 1);
        });
      }

      const mitzvotWithCounts = mitzvotData.map(mitzvah => ({
        ...mitzvah,
        categoryName: mitzvah.categoryId ? categoriesMap.get(mitzvah.categoryId) : null,
        successCount: completionCounts.get(`${mitzvah.id}-success`) || 0,
        struggleCount: completionCounts.get(`${mitzvah.id}-struggle`) || 0,
      }));

      app.logger.info({ userId: session.user.id, count: mitzvotWithCounts.length }, 'Mitzvot fetched successfully');
      return mitzvotWithCounts;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch mitzvot');
      throw error;
    }
  });

  // GET /api/mitzvot/activated-today - Get mitzvot scheduled for a specific date
  app.fastify.get('/api/mitzvot/activated-today', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { date } = request.query as { date?: string };
    const targetDate = date ? new Date(date) : new Date();

    app.logger.info({ userId: session.user.id, date: targetDate.toISOString() }, 'Fetching activated mitzvot for date');

    try {
      // Get user preferences for timezone
      const prefs = await app.db
        .select()
        .from(schema.userPreferences)
        .where(eq(schema.userPreferences.userId, session.user.id))
        .limit(1);

      const timezone = prefs[0]?.timezone || 'UTC';

      // Get all active mitzvot
      const mitzvotData = await app.db
        .select()
        .from(schema.mitzvot)
        .where(and(eq(schema.mitzvot.userId, session.user.id), eq(schema.mitzvot.status, 'ACTIVE')));

      // Filter by schedule
      const activatedMitzvot = [];

      for (const mitzvah of mitzvotData) {
        const scheduleConfig: ScheduleConfig = {
          calendarType: (mitzvah.calendarType as any) || 'gregorian',
          recurrenceType: (mitzvah.scheduleRecurrenceType as any) || 'daily',
          scheduleType: (mitzvah.scheduleType as any) || 'always_active',
          startDate: mitzvah.startDate || undefined,
          endDate: mitzvah.endDate || undefined,
          timezone,
          daysOfWeek: mitzvah.scheduleDaysOfWeek || undefined,
          monthlyDates: mitzvah.scheduleDatesOfMonth || undefined,
          nthDayOfMonth: mitzvah.scheduleNthDayOfMonth as any,
          monthlyRange: mitzvah.scheduleMonthlyRange as any,
          fortnightEvenOdd: (mitzvah.scheduleFortnightEvenOdd as any),
          yearlyMonths: mitzvah.scheduleDateOfYearMonths ? mitzvah.scheduleDateOfYearMonths.map(m => parseInt(m)) : undefined,
          yearlyDatesOrRanges: mitzvah.scheduleDatesOfYear ? (mitzvah.scheduleDatesOfYear as any[]).map((d: any) => {
            try {
              return typeof d === 'string' ? JSON.parse(d) : d;
            } catch {
              return null;
            }
          }).filter(Boolean) : undefined,
          weekendsOnly: mitzvah.scheduleWeekendsOnly || false,
          weekdaysOnly: mitzvah.scheduleWeekdaysOnly || false,
          exclusions: mitzvah.scheduleExclusions as any,
        };

        // Check if date matches schedule
        const activations = getNextActivations(scheduleConfig, targetDate, 1);
        if (activations.length > 0 && (activations[0] as any).split('T')[0] === targetDate.toISOString().split('T')[0]) {
          // Get today's completion counts
          const startOfDay = new Date(targetDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(targetDate);
          endOfDay.setHours(23, 59, 59, 999);

          const todayCompletions = await app.db
            .select()
            .from(schema.mitzvotCompletions)
            .where(and(
              eq(schema.mitzvotCompletions.mitzvahId, mitzvah.id),
              inArray(schema.mitzvotCompletions.isSuccess, [true, false])
            ));

          const todaySuccesses = todayCompletions.filter(c => c.isSuccess && c.completedAt >= startOfDay && c.completedAt <= endOfDay).length;
          const todayStruggles = todayCompletions.filter(c => !c.isSuccess && c.completedAt >= startOfDay && c.completedAt <= endOfDay).length;

          activatedMitzvot.push({
            ...mitzvah,
            todaySuccessCount: todaySuccesses,
            todayStruggleCount: todayStruggles,
          });
        }
      }

      app.logger.info({ userId: session.user.id, count: activatedMitzvot.length }, 'Activated mitzvot fetched successfully');
      return activatedMitzvot;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch activated mitzvot');
      throw error;
    }
  });

  // POST /api/mitzvot - Create a new mitzvah
  app.fastify.post('/api/mitzvot', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as {
      title: string;
      description?: string;
      categoryId?: string;
      type: string;
      status?: string;
      scheduleType?: string;
      scheduleDaysOfWeek?: number[];
      scheduleDatesOfMonth?: number[];
      scheduleNthDayOfMonth?: any;
      scheduleTimesPerMonth?: number;
      schedulePeriodOfYear?: any;
      scheduleDatesOfYear?: Array<{ month: number; day: number; endMonth?: number; endDay?: number }>;
      scheduleRecurrenceType?: string;
      scheduleTimesPerDayDetails?: any;
      scheduleWeekendsOnly?: boolean;
      scheduleWeekdaysOnly?: boolean;
      scheduleFortnightEvenOdd?: string;
      scheduleMonthlyRange?: any;
      scheduleMonthlyRandomCount?: number;
      scheduleExclusions?: any;
      scheduleDateOfYearMonths?: string[];
      calendarType?: string;
      startDate?: string;
      endDate?: string;
      rewardCurrencyId?: string;
      rewardSuccesses?: number;
      rewardAmount?: number;
      consequenceCurrencyId?: string;
      consequenceFailures?: number;
      consequenceAmount?: number;
    };

    app.logger.info({ userId: session.user.id, title: body.title, type: body.type }, 'Creating mitzvah');

    try {
      const mitzvahType = body.type || 'PROACTIVE';
      const scheduleType = body.scheduleType || 'always_active';

      // Validate schedule type
      const validScheduleTypes = ['always_active', 'weekly', 'fortnightly', 'monthly', 'yearly'];
      if (!validScheduleTypes.includes(scheduleType.toLowerCase())) {
        app.logger.warn({ userId: session.user.id, scheduleType }, 'Invalid schedule type');
        return reply.status(400).send({ error: `Invalid schedule type. Must be one of: ${validScheduleTypes.join(', ')}` });
      }

      // Parse dates
      const startDate = body.startDate ? new Date(body.startDate) : null;
      const endDate = body.endDate ? new Date(body.endDate) : null;

      const mitzvotData = await app.db
        .insert(schema.mitzvot)
        .values({
          userId: session.user.id,
          title: body.title,
          description: body.description || null,
          categoryId: body.categoryId || null,
          type: mitzvahType,
          status: body.status || 'ACTIVE',
          isSystem: false,
          scheduleType,
          scheduleDaysOfWeek: body.scheduleDaysOfWeek?.length ? body.scheduleDaysOfWeek : null,
          scheduleDatesOfMonth: body.scheduleDatesOfMonth?.length ? body.scheduleDatesOfMonth : null,
          scheduleNthDayOfMonth: body.scheduleNthDayOfMonth ? (typeof body.scheduleNthDayOfMonth === 'string' ? JSON.parse(body.scheduleNthDayOfMonth) : body.scheduleNthDayOfMonth) : null,
          scheduleTimesPerMonth: body.scheduleTimesPerMonth || null,
          schedulePeriodOfYear: body.schedulePeriodOfYear ? (typeof body.schedulePeriodOfYear === 'string' ? JSON.parse(body.schedulePeriodOfYear) : body.schedulePeriodOfYear) : null,
          scheduleDatesOfYear: body.scheduleDatesOfYear?.length ? body.scheduleDatesOfYear : null,
          scheduleRecurrenceType: body.scheduleRecurrenceType || 'daily',
          scheduleTimesPerDayDetails: body.scheduleTimesPerDayDetails ? (typeof body.scheduleTimesPerDayDetails === 'string' ? JSON.parse(body.scheduleTimesPerDayDetails) : body.scheduleTimesPerDayDetails) : null,
          scheduleWeekendsOnly: body.scheduleWeekendsOnly || false,
          scheduleWeekdaysOnly: body.scheduleWeekdaysOnly || false,
          scheduleFortnightEvenOdd: body.scheduleFortnightEvenOdd || null,
          scheduleMonthlyRange: body.scheduleMonthlyRange ? (typeof body.scheduleMonthlyRange === 'string' ? JSON.parse(body.scheduleMonthlyRange) : body.scheduleMonthlyRange) : null,
          scheduleMonthlyRandomCount: body.scheduleMonthlyRandomCount || null,
          scheduleExclusions: body.scheduleExclusions ? (typeof body.scheduleExclusions === 'string' ? JSON.parse(body.scheduleExclusions) : body.scheduleExclusions) : null,
          scheduleDateOfYearMonths: body.scheduleDateOfYearMonths?.length ? body.scheduleDateOfYearMonths : null,
          calendarType: body.calendarType || null,
          startDate,
          endDate,
          rewardCurrencyId: body.rewardCurrencyId || null,
          rewardSuccesses: body.rewardSuccesses || null,
          rewardAmount: body.rewardAmount || null,
          consequenceCurrencyId: body.consequenceCurrencyId || null,
          consequenceFailures: body.consequenceFailures || null,
          consequenceAmount: body.consequenceAmount || null,
        })
        .returning();

      const mitzvah = mitzvotData[0];

      app.logger.info({ userId: session.user.id, mitzvahId: mitzvah.id }, 'Mitzvah created successfully');
      return mitzvah;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, title: body.title }, 'Failed to create mitzvah');
      throw error;
    }
  });

  // PUT /api/mitzvot/:id - Update a mitzvah
  app.fastify.put('/api/mitzvot/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as any;

    app.logger.info({ userId: session.user.id, mitzvahId: id }, 'Updating mitzvah');

    try {
      const existingMitzvot = await app.db
        .select()
        .from(schema.mitzvot)
        .where(eq(schema.mitzvot.id, id))
        .limit(1);

      if (!existingMitzvot.length) {
        app.logger.warn({ userId: session.user.id, mitzvahId: id }, 'Mitzvah not found');
        return reply.status(404).send({ error: 'Mitzvah not found' });
      }

      if (existingMitzvot[0].userId !== session.user.id) {
        app.logger.warn({ userId: session.user.id, mitzvahId: id }, 'Unauthorized access to mitzvah');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const updateData: Record<string, unknown> = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.description !== undefined) updateData.description = body.description || null;
      if (body.categoryId !== undefined) updateData.categoryId = body.categoryId || null;
      if (body.type !== undefined) updateData.type = body.type;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.scheduleType !== undefined) {
        const validScheduleTypes = ['always_active', 'weekly', 'fortnightly', 'monthly', 'yearly'];
        if (!validScheduleTypes.includes(body.scheduleType.toLowerCase())) {
          return reply.status(400).send({ error: `Invalid schedule type. Must be one of: ${validScheduleTypes.join(', ')}` });
        }
        updateData.scheduleType = body.scheduleType;
      }
      if (body.scheduleDaysOfWeek !== undefined) updateData.scheduleDaysOfWeek = body.scheduleDaysOfWeek?.length ? body.scheduleDaysOfWeek : null;
      if (body.scheduleDatesOfMonth !== undefined) updateData.scheduleDatesOfMonth = body.scheduleDatesOfMonth?.length ? body.scheduleDatesOfMonth : null;
      if (body.scheduleNthDayOfMonth !== undefined) updateData.scheduleNthDayOfMonth = body.scheduleNthDayOfMonth ? (typeof body.scheduleNthDayOfMonth === 'string' ? JSON.parse(body.scheduleNthDayOfMonth) : body.scheduleNthDayOfMonth) : null;
      if (body.scheduleTimesPerMonth !== undefined) updateData.scheduleTimesPerMonth = body.scheduleTimesPerMonth || null;
      if (body.schedulePeriodOfYear !== undefined) updateData.schedulePeriodOfYear = body.schedulePeriodOfYear ? (typeof body.schedulePeriodOfYear === 'string' ? JSON.parse(body.schedulePeriodOfYear) : body.schedulePeriodOfYear) : null;
      if (body.scheduleDatesOfYear !== undefined) updateData.scheduleDatesOfYear = body.scheduleDatesOfYear?.length ? body.scheduleDatesOfYear : null;
      if (body.scheduleRecurrenceType !== undefined) updateData.scheduleRecurrenceType = body.scheduleRecurrenceType;
      if (body.scheduleTimesPerDayDetails !== undefined) updateData.scheduleTimesPerDayDetails = body.scheduleTimesPerDayDetails ? (typeof body.scheduleTimesPerDayDetails === 'string' ? JSON.parse(body.scheduleTimesPerDayDetails) : body.scheduleTimesPerDayDetails) : null;
      if (body.scheduleWeekendsOnly !== undefined) updateData.scheduleWeekendsOnly = body.scheduleWeekendsOnly;
      if (body.scheduleWeekdaysOnly !== undefined) updateData.scheduleWeekdaysOnly = body.scheduleWeekdaysOnly;
      if (body.scheduleFortnightEvenOdd !== undefined) updateData.scheduleFortnightEvenOdd = body.scheduleFortnightEvenOdd || null;
      if (body.scheduleMonthlyRange !== undefined) updateData.scheduleMonthlyRange = body.scheduleMonthlyRange ? (typeof body.scheduleMonthlyRange === 'string' ? JSON.parse(body.scheduleMonthlyRange) : body.scheduleMonthlyRange) : null;
      if (body.scheduleMonthlyRandomCount !== undefined) updateData.scheduleMonthlyRandomCount = body.scheduleMonthlyRandomCount || null;
      if (body.scheduleExclusions !== undefined) updateData.scheduleExclusions = body.scheduleExclusions ? (typeof body.scheduleExclusions === 'string' ? JSON.parse(body.scheduleExclusions) : body.scheduleExclusions) : null;
      if (body.scheduleDateOfYearMonths !== undefined) updateData.scheduleDateOfYearMonths = body.scheduleDateOfYearMonths?.length ? body.scheduleDateOfYearMonths : null;
      if (body.calendarType !== undefined) updateData.calendarType = body.calendarType || null;
      if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null;
      if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;
      if (body.rewardCurrencyId !== undefined) updateData.rewardCurrencyId = body.rewardCurrencyId || null;
      if (body.rewardSuccesses !== undefined) updateData.rewardSuccesses = body.rewardSuccesses || null;
      if (body.rewardAmount !== undefined) updateData.rewardAmount = body.rewardAmount || null;
      if (body.consequenceCurrencyId !== undefined) updateData.consequenceCurrencyId = body.consequenceCurrencyId || null;
      if (body.consequenceFailures !== undefined) updateData.consequenceFailures = body.consequenceFailures || null;
      if (body.consequenceAmount !== undefined) updateData.consequenceAmount = body.consequenceAmount || null;
      updateData.updatedAt = new Date();

      const updatedMitzvot = await app.db
        .update(schema.mitzvot)
        .set(updateData)
        .where(eq(schema.mitzvot.id, id))
        .returning();

      const mitzvah = updatedMitzvot[0];

      app.logger.info({ userId: session.user.id, mitzvahId: id }, 'Mitzvah updated successfully');
      return mitzvah;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, mitzvahId: id }, 'Failed to update mitzvah');
      throw error;
    }
  });

  // DELETE /api/mitzvot/:id - Delete a mitzvah (only if not system)
  app.fastify.delete('/api/mitzvot/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, mitzvahId: id }, 'Deleting mitzvah');

    try {
      const existingMitzvot = await app.db
        .select()
        .from(schema.mitzvot)
        .where(eq(schema.mitzvot.id, id))
        .limit(1);

      if (!existingMitzvot.length) {
        app.logger.warn({ userId: session.user.id, mitzvahId: id }, 'Mitzvah not found');
        return reply.status(404).send({ error: 'Mitzvah not found' });
      }

      if (existingMitzvot[0].userId !== session.user.id) {
        app.logger.warn({ userId: session.user.id, mitzvahId: id }, 'Unauthorized access to mitzvah');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      if (existingMitzvot[0].isSystem) {
        app.logger.warn({ userId: session.user.id, mitzvahId: id }, 'Cannot delete system mitzvah');
        return reply.status(400).send({ error: 'Cannot delete system mitzvot' });
      }

      await app.db.delete(schema.mitzvot).where(eq(schema.mitzvot.id, id));

      app.logger.info({ userId: session.user.id, mitzvahId: id }, 'Mitzvah deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, mitzvahId: id }, 'Failed to delete mitzvah');
      throw error;
    }
  });

  // POST /api/mitzvot/upload-csv - Upload system mitzvot from CSV
  app.fastify.post('/api/mitzvot/upload-csv', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Uploading mitzvot from CSV');

    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file provided' });
      }

      const buffer = await data.toBuffer();
      const csvContent = buffer.toString('utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        return reply.status(400).send({ error: 'CSV must have header and at least one data row' });
      }

      // Parse CSV
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const mitzvot = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length < 1 || !values[0]) continue;

        const titleIndex = headers.indexOf('title');
        const descIndex = headers.indexOf('description');
        const categoryIndex = headers.indexOf('category');
        const typeIndex = headers.indexOf('type');

        if (titleIndex === -1 || typeIndex === -1) {
          app.logger.warn({ userId: session.user.id }, 'CSV missing title or type column');
          continue;
        }

        // Find category by name
        let categoryId = null;
        if (categoryIndex !== -1 && values[categoryIndex]) {
          const cats = await app.db
            .select()
            .from(schema.mitzvotCategories)
            .where(and(
              eq(schema.mitzvotCategories.userId, session.user.id),
              eq(schema.mitzvotCategories.name, values[categoryIndex])
            ))
            .limit(1);
          if (cats.length) {
            categoryId = cats[0].id;
          }
        }

        mitzvot.push({
          userId: session.user.id,
          title: values[titleIndex],
          description: descIndex !== -1 ? values[descIndex] : null,
          categoryId,
          type: values[typeIndex] || 'PROACTIVE',
          status: 'ACTIVE',
          isSystem: true,
          scheduleType: 'always_active',
        });
      }

      if (mitzvot.length === 0) {
        return reply.status(400).send({ error: 'No valid mitzvot found in CSV' });
      }

      const inserted = await app.db
        .insert(schema.mitzvot)
        .values(mitzvot as any)
        .returning();

      app.logger.info({ userId: session.user.id, count: inserted.length }, 'Mitzvot uploaded successfully');
      return { count: inserted.length, mitzvot: inserted };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to upload mitzvot from CSV');
      throw error;
    }
  });

  // POST /api/mitzvot/:id/success - Record success completion
  app.fastify.post('/api/mitzvot/:id/success', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as { timestamp?: string };

    app.logger.info({ userId: session.user.id, mitzvahId: id }, 'Recording success for mitzvah');

    try {
      const mitzvotCheck = await app.db
        .select()
        .from(schema.mitzvot)
        .where(eq(schema.mitzvot.id, id))
        .limit(1);

      if (!mitzvotCheck.length) {
        app.logger.warn({ userId: session.user.id, mitzvahId: id }, 'Mitzvah not found');
        return reply.status(404).send({ error: 'Mitzvah not found' });
      }

      if (mitzvotCheck[0].userId !== session.user.id) {
        app.logger.warn({ userId: session.user.id, mitzvahId: id }, 'Unauthorized access to mitzvah');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const completedAt = body.timestamp ? new Date(body.timestamp) : new Date();

      const entries = await app.db
        .insert(schema.mitzvotCompletions)
        .values({
          mitzvahId: id,
          userId: session.user.id,
          isSuccess: true,
          completedAt,
        })
        .returning();

      const entry = entries[0];

      // Count completions for today and total
      const startOfDay = new Date(completedAt);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(completedAt);
      endOfDay.setHours(23, 59, 59, 999);

      const todayCompletions = await app.db
        .select()
        .from(schema.mitzvotCompletions)
        .where(and(
          eq(schema.mitzvotCompletions.mitzvahId, id),
          eq(schema.mitzvotCompletions.isSuccess, true)
        ));

      const todaySuccessCount = todayCompletions.filter(c => c.completedAt >= startOfDay && c.completedAt <= endOfDay).length;
      const successCount = todayCompletions.length;

      app.logger.info(
        { userId: session.user.id, mitzvahId: id, todaySuccessCount, successCount },
        'Success recorded for mitzvah'
      );
      return { entryId: entry.id, todaySuccessCount, successCount };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, mitzvahId: id }, 'Failed to record success');
      throw error;
    }
  });

  // POST /api/mitzvot/:id/struggle - Record struggle completion
  app.fastify.post('/api/mitzvot/:id/struggle', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as { timestamp?: string };

    app.logger.info({ userId: session.user.id, mitzvahId: id }, 'Recording struggle for mitzvah');

    try {
      const mitzvotCheck = await app.db
        .select()
        .from(schema.mitzvot)
        .where(eq(schema.mitzvot.id, id))
        .limit(1);

      if (!mitzvotCheck.length) {
        app.logger.warn({ userId: session.user.id, mitzvahId: id }, 'Mitzvah not found');
        return reply.status(404).send({ error: 'Mitzvah not found' });
      }

      if (mitzvotCheck[0].userId !== session.user.id) {
        app.logger.warn({ userId: session.user.id, mitzvahId: id }, 'Unauthorized access to mitzvah');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const completedAt = body.timestamp ? new Date(body.timestamp) : new Date();

      const entries = await app.db
        .insert(schema.mitzvotCompletions)
        .values({
          mitzvahId: id,
          userId: session.user.id,
          isSuccess: false,
          completedAt,
        })
        .returning();

      const entry = entries[0];

      // Count completions for today and total
      const startOfDay = new Date(completedAt);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(completedAt);
      endOfDay.setHours(23, 59, 59, 999);

      const todayCompletions = await app.db
        .select()
        .from(schema.mitzvotCompletions)
        .where(and(
          eq(schema.mitzvotCompletions.mitzvahId, id),
          eq(schema.mitzvotCompletions.isSuccess, false)
        ));

      const todayStruggleCount = todayCompletions.filter(c => c.completedAt >= startOfDay && c.completedAt <= endOfDay).length;
      const struggleCount = todayCompletions.length;

      app.logger.info(
        { userId: session.user.id, mitzvahId: id, todayStruggleCount, struggleCount },
        'Struggle recorded for mitzvah'
      );
      return { entryId: entry.id, todayStruggleCount, struggleCount };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, mitzvahId: id }, 'Failed to record struggle');
      throw error;
    }
  });

  // DELETE /api/mitzvot/:id/entries/:entryId - Delete a completion entry
  app.fastify.delete('/api/mitzvot/:id/entries/:entryId', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id, entryId } = request.params as { id: string; entryId: string };

    app.logger.info({ userId: session.user.id, mitzvahId: id, entryId }, 'Deleting mitzvah completion entry');

    try {
      const entryCheck = await app.db
        .select()
        .from(schema.mitzvotCompletions)
        .where(eq(schema.mitzvotCompletions.id, entryId))
        .limit(1);

      if (!entryCheck.length) {
        app.logger.warn({ userId: session.user.id, entryId }, 'Completion entry not found');
        return reply.status(404).send({ error: 'Entry not found' });
      }

      if (entryCheck[0].userId !== session.user.id) {
        app.logger.warn({ userId: session.user.id, entryId }, 'Unauthorized access to entry');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      await app.db.delete(schema.mitzvotCompletions).where(eq(schema.mitzvotCompletions.id, entryId));

      app.logger.info({ userId: session.user.id, mitzvahId: id, entryId }, 'Completion entry deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, entryId }, 'Failed to delete completion entry');
      throw error;
    }
  });

  // POST /api/mitzvot/import-csv - Import mitzvot from CSV file
  app.fastify.post('/api/mitzvot/import-csv', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Importing mitzvot from CSV');

    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file provided' });
      }

      // Validate file type
      if (!data.mimetype.includes('csv') && !data.filename.endsWith('.csv')) {
        app.logger.warn({ userId: session.user.id, filename: data.filename }, 'Invalid file type');
        return reply.status(400).send({ error: 'File must be a CSV file' });
      }

      // Validate file size (max 5MB)
      const buffer = await data.toBuffer();
      if (buffer.length > 5 * 1024 * 1024) {
        app.logger.warn({ userId: session.user.id, size: buffer.length }, 'File too large');
        return reply.status(400).send({ error: 'File size exceeds 5MB limit' });
      }

      const csvContent = buffer.toString('utf-8');
      const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);

      if (lines.length < 2) {
        return reply.status(400).send({ error: 'CSV must have header row and at least one data row' });
      }

      // Parse CSV headers (flexible matching)
      const headerLine = lines[0];
      const headers = headerLine.split(',').map(h => h.trim().toLowerCase());

      // Map common column names
      const columnMap = {
        number: headers.findIndex(h => ['number', 'mitzvah number', 'mitzvah_number', 'num', 'id'].includes(h)),
        title: headers.findIndex(h => ['title', 'name', 'mitzvah', 'mitzvah name', 'mitzvah_name'].includes(h)),
        description: headers.findIndex(h => ['description', 'desc', 'details', 'detail'].includes(h)),
        type: headers.findIndex(h => ['type', 'category type', 'category_type'].includes(h)),
        category: headers.findIndex(h => ['category', 'category name', 'category_name'].includes(h)),
        source: headers.findIndex(h => ['source', 'reference', 'source reference', 'source_reference'].includes(h)),
        hebrew: headers.findIndex(h => ['hebrew', 'hebrew name', 'hebrew_name', 'hebrew text', 'hebrew_text'].includes(h)),
        appliesTo: headers.findIndex(h => ['applies to', 'applies_to', 'who', 'applicable to', 'applicable_to'].includes(h)),
        location: headers.findIndex(h => ['location', 'place', 'where', 'location type', 'location_type'].includes(h)),
        timePeriod: headers.findIndex(h => ['time', 'time period', 'time_period', 'when', 'period'].includes(h)),
      };

      // Validate required columns
      if (columnMap.title === -1) {
        return reply.status(400).send({ error: 'CSV must have a "title" or "name" column' });
      }

      const errors: string[] = [];
      let imported = 0;
      let skipped = 0;

      // Get all categories for the user
      const categories = await app.db
        .select()
        .from(schema.mitzvotCategories)
        .where(eq(schema.mitzvotCategories.userId, session.user.id));

      const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

      // Get existing mitzvah numbers to prevent duplicates
      const existingMitzvot = await app.db
        .select()
        .from(schema.mitzvot)
        .where(and(
          eq(schema.mitzvot.userId, session.user.id),
          eq(schema.mitzvot.isSystem, true)
        ));

      const existingNumbers = new Set(existingMitzvot.map(m => m.mitzvahNumber).filter(Boolean));

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(v => v.trim());

          if (values.length < columnMap.title + 1 || !values[columnMap.title]) {
            skipped++;
            continue;
          }

          const mitzvahNumber = columnMap.number !== -1 && values[columnMap.number] ? parseInt(values[columnMap.number]) : null;

          // Skip if duplicate mitzvah number
          if (mitzvahNumber && existingNumbers.has(mitzvahNumber)) {
            skipped++;
            continue;
          }

          const title = values[columnMap.title];
          const description = columnMap.description !== -1 ? values[columnMap.description] || null : null;
          const type = columnMap.type !== -1 ? values[columnMap.type] || 'PROACTIVE' : 'PROACTIVE';
          const source = columnMap.source !== -1 ? values[columnMap.source] || null : null;
          const hebrewName = columnMap.hebrew !== -1 ? values[columnMap.hebrew] || null : null;
          const appliesToCat = columnMap.appliesTo !== -1 ? values[columnMap.appliesTo] || null : null;
          const location = columnMap.location !== -1 ? values[columnMap.location] || null : null;
          const timePeriod = columnMap.timePeriod !== -1 ? values[columnMap.timePeriod] || null : null;

          // Find or use category
          let categoryId = null;
          if (columnMap.category !== -1 && values[columnMap.category]) {
            const categoryName = values[columnMap.category];
            categoryId = categoryMap.get(categoryName.toLowerCase()) || null;
          }

          const mitzvahValues = {
            userId: session.user.id,
            title,
            description,
            categoryId,
            type,
            status: 'ACTIVE',
            isSystem: true,
            scheduleType: 'always_active',
            mitzvahNumber,
            source,
            hebrewName,
            appliesToCat,
            location,
            timePeriod,
          };

          await app.db
            .insert(schema.mitzvot)
            .values(mitzvahValues as any);

          imported++;
        } catch (error) {
          app.logger.warn({ userId: session.user.id, rowIndex: i, error }, 'Failed to import mitzvah row');
          errors.push(`Row ${i + 1}: ${(error as Error).message}`);
        }
      }

      app.logger.info({ userId: session.user.id, imported, skipped, errors: errors.length }, 'Mitzvot imported from CSV');
      return { success: true, imported, skipped, errors };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to import mitzvot from CSV');
      throw error;
    }
  });

  // GET /api/mitzvot/import-status - Get CSV import status
  app.fastify.get('/api/mitzvot/import-status', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching mitzvot import status');

    try {
      const systemMitzvot = await app.db
        .select()
        .from(schema.mitzvot)
        .where(and(
          eq(schema.mitzvot.userId, session.user.id),
          eq(schema.mitzvot.isSystem, true)
        ));

      const totalSystemMitzvot = systemMitzvot.length;
      const userHasImported = totalSystemMitzvot > 0;

      app.logger.info({ userId: session.user.id, totalSystemMitzvot, userHasImported }, 'Import status fetched successfully');
      return { totalSystemMitzvot, userHasImported };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch import status');
      throw error;
    }
  });
}
