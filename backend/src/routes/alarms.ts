import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerAlarmsRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // Helper function to convert timestamps to ISO 8601 UTC strings
  const convertToISO = (timestamp: number | null) => {
    if (!timestamp) return null;
    return new Date(timestamp).toISOString();
  };

  // Helper function to convert alarm response with ISO timestamps
  const formatAlarmResponse = (alarm: any) => ({
    ...alarm,
    createdAt: convertToISO(Math.floor((alarm.createdAt as any instanceof Date ? alarm.createdAt : new Date(alarm.createdAt)).getTime())),
    updatedAt: convertToISO(Math.floor((alarm.updatedAt as any instanceof Date ? alarm.updatedAt : new Date(alarm.updatedAt)).getTime())),
    nextTriggerTimeUtc: alarm.nextTriggerTimeUtc,
  });

  // GET /api/alarms - Get all alarms for authenticated user
  app.fastify.get('/api/alarms', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching alarms');

    try {
      const alarms = await app.db
        .select()
        .from(schema.alarms)
        .where(eq(schema.alarms.userId, session.user.id))
        .orderBy(desc(schema.alarms.createdAt));

      const alarmsWithDates = alarms.map(alarm => formatAlarmResponse(alarm));

      app.logger.info({ userId: session.user.id, count: alarmsWithDates.length }, 'Alarms fetched successfully');
      return alarmsWithDates;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch alarms');
      throw error;
    }
  });

  // GET /api/alarms/:id - Get a single alarm by ID
  app.fastify.get('/api/alarms/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, alarmId: id }, 'Fetching alarm');

    try {
      const alarms = await app.db
        .select()
        .from(schema.alarms)
        .where(eq(schema.alarms.id, id))
        .limit(1);

      if (!alarms.length) {
        app.logger.warn({ userId: session.user.id, alarmId: id }, 'Alarm not found');
        return reply.status(404).send({ error: 'Alarm not found' });
      }

      if (alarms[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, alarmId: id, ownerId: alarms[0].userId },
          'Unauthorized access to alarm'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const alarmWithDates = formatAlarmResponse(alarms[0]);

      app.logger.info({ userId: session.user.id, alarmId: id }, 'Alarm retrieved successfully');
      return alarmWithDates;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, alarmId: id }, 'Failed to fetch alarm');
      throw error;
    }
  });

  // POST /api/alarms - Create a new alarm
  app.fastify.post('/api/alarms', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as {
      title: string;
      calendarType?: string;
      eventType?: string;
      triggers: Array<{ type: 'time' | 'astronomical' | 'location'; value: string; min?: string; max?: string; logic?: 'AND' | 'OR' }>;
      recurring: boolean;
      location?: { latitude: number; longitude: number; radius: number };
      timezone: string;
      nextTriggerTimeUtc?: number;
      notificationId?: string;
      enabled?: boolean;
    };

    if (!body.title || !body.triggers || !body.timezone) {
      app.logger.warn({ userId: session.user.id }, 'Missing required fields in POST alarm');
      return reply.status(400).send({ error: 'Missing required fields: title, triggers, timezone' });
    }

    app.logger.info(
      { userId: session.user.id, title: body.title, calendarType: body.calendarType, recurring: body.recurring },
      'Creating alarm'
    );

    try {
      const createdAlarms = await app.db
        .insert(schema.alarms)
        .values({
          userId: session.user.id,
          title: body.title,
          calendarType: body.calendarType || null,
          eventType: body.eventType || null,
          triggers: JSON.stringify(body.triggers),
          recurring: body.recurring,
          location: body.location ? JSON.stringify(body.location) : null,
          timezone: body.timezone,
          nextTriggerTimeUtc: body.nextTriggerTimeUtc || null,
          notificationId: body.notificationId || null,
          enabled: body.enabled ?? true,
        })
        .returning();

      const alarm = createdAlarms[0];
      const alarmWithDates = formatAlarmResponse(alarm);

      app.logger.info({ userId: session.user.id, alarmId: alarm.id, title: body.title }, 'Alarm created successfully');
      return alarmWithDates;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, title: body.title },
        'Failed to create alarm'
      );
      throw error;
    }
  });

  // PUT /api/alarms/:id - Update an alarm
  app.fastify.put('/api/alarms/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as {
      title?: string;
      calendarType?: string;
      eventType?: string;
      triggers?: Array<{ type: 'time' | 'astronomical' | 'location'; value: string; min?: string; max?: string; logic?: 'AND' | 'OR' }>;
      recurring?: boolean;
      location?: { latitude: number; longitude: number; radius: number };
      timezone?: string;
      nextTriggerTimeUtc?: number;
      notificationId?: string;
      enabled?: boolean;
    };

    app.logger.info({ userId: session.user.id, alarmId: id }, 'Updating alarm');

    try {
      // Check if alarm exists and belongs to user
      const existingAlarms = await app.db
        .select()
        .from(schema.alarms)
        .where(eq(schema.alarms.id, id))
        .limit(1);

      if (!existingAlarms.length) {
        app.logger.warn({ userId: session.user.id, alarmId: id }, 'Alarm not found');
        return reply.status(404).send({ error: 'Alarm not found' });
      }

      if (existingAlarms[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, alarmId: id, ownerId: existingAlarms[0].userId },
          'Unauthorized access to alarm'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const updateData: Record<string, unknown> = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.calendarType !== undefined) updateData.calendarType = body.calendarType || null;
      if (body.eventType !== undefined) updateData.eventType = body.eventType || null;
      if (body.triggers !== undefined) updateData.triggers = JSON.stringify(body.triggers);
      if (body.recurring !== undefined) updateData.recurring = body.recurring;
      if (body.location !== undefined) updateData.location = body.location ? JSON.stringify(body.location) : null;
      if (body.timezone !== undefined) updateData.timezone = body.timezone;
      if (body.nextTriggerTimeUtc !== undefined) updateData.nextTriggerTimeUtc = body.nextTriggerTimeUtc;
      if (body.notificationId !== undefined) updateData.notificationId = body.notificationId || null;
      if (body.enabled !== undefined) updateData.enabled = body.enabled;
      updateData.updatedAt = new Date();

      const updatedAlarms = await app.db
        .update(schema.alarms)
        .set(updateData)
        .where(eq(schema.alarms.id, id))
        .returning();

      const alarm = updatedAlarms[0];
      const alarmWithDates = formatAlarmResponse(alarm);

      app.logger.info({ userId: session.user.id, alarmId: id }, 'Alarm updated successfully');
      return alarmWithDates;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, alarmId: id },
        'Failed to update alarm'
      );
      throw error;
    }
  });

  // DELETE /api/alarms/:id - Delete an alarm
  app.fastify.delete('/api/alarms/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, alarmId: id }, 'Deleting alarm');

    try {
      // Check if alarm exists and belongs to user
      const existingAlarms = await app.db
        .select()
        .from(schema.alarms)
        .where(eq(schema.alarms.id, id))
        .limit(1);

      if (!existingAlarms.length) {
        app.logger.warn({ userId: session.user.id, alarmId: id }, 'Alarm not found');
        return reply.status(404).send({ error: 'Alarm not found' });
      }

      if (existingAlarms[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, alarmId: id, ownerId: existingAlarms[0].userId },
          'Unauthorized access to alarm'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      await app.db
        .delete(schema.alarms)
        .where(eq(schema.alarms.id, id));

      app.logger.info({ userId: session.user.id, alarmId: id }, 'Alarm deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, alarmId: id }, 'Failed to delete alarm');
      throw error;
    }
  });
}
