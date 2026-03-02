import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { createAuthWrapper } from '../utils/auth-wrapper.js';

// Trigger type definitions
interface TimeTrigger {
  type: 'time';
  time: string; // HH:MM format with AM/PM
  conditions?: string;
}

interface AstronomicalTrigger {
  type: 'astronomical';
  value: 'sunrise' | 'sunset' | 'dawn';
  offsetMinutes?: number;
}

interface LocationTrigger {
  type: 'location';
  mode: 'enterHome' | 'exitHome' | 'specificLocation';
  locationId?: string; // For home location reference
  latitude?: number;
  longitude?: number;
  radius?: number;
}

type Trigger = TimeTrigger | AstronomicalTrigger | LocationTrigger;

// Validation helper for time format (HH:MM AM/PM)
function validateTimeFormat(time: string): boolean {
  const timeRegex = /^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/i;
  return timeRegex.test(time);
}

// Helper to parse time string and convert to 24-hour format
function parseTime12to24(time: string): { hour: number; minute: number } | null {
  const match = time.match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;

  return { hour, minute };
}

// Helper to convert 24-hour to 12-hour AM/PM format
function format24to12(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

export function registerAlarmsRoutes(app: App) {
  const requireAuth = createAuthWrapper(app);

  // Helper function to convert timestamps to ISO 8601 UTC strings
  const convertToISO = (timestamp: number | null) => {
    if (!timestamp) return null;
    return new Date(timestamp).toISOString();
  };

  // Helper function to convert alarm response with ISO timestamps
  const formatAlarmResponse = (alarm: any) => {
    const triggers = typeof alarm.triggers === 'string' ? JSON.parse(alarm.triggers) : alarm.triggers;
    const location = alarm.location ? (typeof alarm.location === 'string' ? JSON.parse(alarm.location) : alarm.location) : null;

    return {
      ...alarm,
      triggers,
      location,
      createdAt: convertToISO(Math.floor((alarm.createdAt as any instanceof Date ? alarm.createdAt : new Date(alarm.createdAt)).getTime())),
      updatedAt: convertToISO(Math.floor((alarm.updatedAt as any instanceof Date ? alarm.updatedAt : new Date(alarm.updatedAt)).getTime())),
      nextTriggerTimeUtc: alarm.nextTriggerTimeUtc,
    };
  };

  // GET /api/alarms - Get all alarms for authenticated user, optionally filtered by goalId
  app.fastify.get('/api/alarms', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { goalId } = request.query as { goalId?: string };

    app.logger.info({ userId: session.user.id, goalId }, 'Fetching alarms');

    try {
      let query = app.db
        .select()
        .from(schema.alarms)
        .where(eq(schema.alarms.userId, session.user.id));

      if (goalId) {
        query = app.db
          .select()
          .from(schema.alarms)
          .where(and(eq(schema.alarms.userId, session.user.id), eq(schema.alarms.goalId, goalId)));
      }

      const alarms = await query.orderBy(desc(schema.alarms.createdAt));
      const alarmsWithDates = alarms.map(alarm => formatAlarmResponse(alarm));

      app.logger.info({ userId: session.user.id, count: alarmsWithDates.length, goalId }, 'Alarms fetched successfully');
      return alarmsWithDates;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, goalId }, 'Failed to fetch alarms');
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
      goalId?: string;
      calendarType?: string;
      eventType?: string;
      triggers: any[];
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

    // Validate all time triggers
    const timeTriggers = body.triggers.filter((t: any) => t.type === 'time');
    for (const trigger of timeTriggers) {
      if (!validateTimeFormat(trigger.time)) {
        app.logger.warn({ userId: session.user.id, invalidTime: trigger.time }, 'Invalid time format in trigger');
        return reply.status(400).send({ error: `Invalid time format: ${trigger.time}. Use HH:MM AM/PM format (e.g., 2:30 PM)` });
      }
    }

    // Validate location triggers if present
    const locationTriggers = body.triggers.filter((t: any) => t.type === 'location');
    for (const trigger of locationTriggers) {
      if (trigger.mode === 'enterHome' || trigger.mode === 'exitHome') {
        // Check if user has home location configured
        const homeLocation = await app.db
          .select()
          .from(schema.userLocations)
          .where(and(eq(schema.userLocations.userId, session.user.id), eq(schema.userLocations.locationType, 'home')))
          .limit(1);

        if (!homeLocation.length) {
          app.logger.warn({ userId: session.user.id }, 'Home location not configured for home-based trigger');
          return reply.status(400).send({ error: 'Home location must be configured before using home-based triggers' });
        }
      }
    }

    // Validate goal exists if goalId provided
    if (body.goalId) {
      const goal = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.id, body.goalId))
        .limit(1);

      if (!goal.length || goal[0].userId !== session.user.id) {
        app.logger.warn({ userId: session.user.id, goalId: body.goalId }, 'Goal not found or unauthorized');
        return reply.status(404).send({ error: 'Goal not found' });
      }
    }

    app.logger.info(
      { userId: session.user.id, title: body.title, goalId: body.goalId, recurring: body.recurring },
      'Creating alarm'
    );

    try {
      const createdAlarms = await app.db
        .insert(schema.alarms)
        .values({
          userId: session.user.id,
          goalId: body.goalId || null,
          title: body.title,
          calendarType: body.calendarType || 'gregorian',
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

      app.logger.info({ userId: session.user.id, alarmId: alarm.id, title: body.title, goalId: body.goalId }, 'Alarm created successfully');
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
      goalId?: string;
      calendarType?: string;
      eventType?: string;
      triggers?: any[];
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

      // Validate time triggers if provided
      if (body.triggers) {
        const timeTriggers = body.triggers.filter((t: any) => t.type === 'time');
        for (const trigger of timeTriggers) {
          if (!validateTimeFormat(trigger.time)) {
            app.logger.warn({ userId: session.user.id, invalidTime: trigger.time }, 'Invalid time format in trigger');
            return reply.status(400).send({ error: `Invalid time format: ${trigger.time}. Use HH:MM AM/PM format (e.g., 2:30 PM)` });
          }
        }

        // Validate location triggers
        const locationTriggers = body.triggers.filter((t: any) => t.type === 'location');
        for (const trigger of locationTriggers) {
          if (trigger.mode === 'enterHome' || trigger.mode === 'exitHome') {
            const homeLocation = await app.db
              .select()
              .from(schema.userLocations)
              .where(and(eq(schema.userLocations.userId, session.user.id), eq(schema.userLocations.locationType, 'home')))
              .limit(1);

            if (!homeLocation.length) {
              app.logger.warn({ userId: session.user.id }, 'Home location not configured for home-based trigger');
              return reply.status(400).send({ error: 'Home location must be configured before using home-based triggers' });
            }
          }
        }
      }

      // Validate goal if updating goalId
      if (body.goalId !== undefined && body.goalId) {
        const goal = await app.db
          .select()
          .from(schema.goals)
          .where(eq(schema.goals.id, body.goalId))
          .limit(1);

        if (!goal.length || goal[0].userId !== session.user.id) {
          app.logger.warn({ userId: session.user.id, goalId: body.goalId }, 'Goal not found or unauthorized');
          return reply.status(404).send({ error: 'Goal not found' });
        }
      }

      const updateData: Record<string, unknown> = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.goalId !== undefined) updateData.goalId = body.goalId || null;
      if (body.calendarType !== undefined) updateData.calendarType = body.calendarType || 'gregorian';
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

  // GET /api/user-locations - Get user's saved locations
  app.fastify.get('/api/user-locations', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching user locations');

    try {
      const locations = await app.db
        .select()
        .from(schema.userLocations)
        .where(eq(schema.userLocations.userId, session.user.id))
        .orderBy(desc(schema.userLocations.createdAt));

      const locationsWithDates = locations.map(loc => ({
        ...loc,
        createdAt: loc.createdAt instanceof Date ? loc.createdAt.toISOString() : new Date(loc.createdAt).toISOString(),
        updatedAt: loc.updatedAt instanceof Date ? loc.updatedAt.toISOString() : new Date(loc.updatedAt).toISOString(),
      }));

      app.logger.info({ userId: session.user.id, count: locationsWithDates.length }, 'User locations fetched successfully');
      return locationsWithDates;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch user locations');
      throw error;
    }
  });

  // POST /api/user-locations - Create or update user location
  app.fastify.post('/api/user-locations', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as {
      locationType: 'home' | 'other';
      name?: string;
      latitude: number;
      longitude: number;
      radius: number;
    };

    if (body.locationType === undefined || body.latitude === undefined || body.longitude === undefined || body.radius === undefined) {
      app.logger.warn({ userId: session.user.id }, 'Missing required fields in POST user location');
      return reply.status(400).send({ error: 'Missing required fields: locationType, latitude, longitude, radius' });
    }

    app.logger.info(
      { userId: session.user.id, locationType: body.locationType, name: body.name },
      'Creating user location'
    );

    try {
      // If creating a home location, remove any existing home location
      if (body.locationType === 'home') {
        const existingHome = await app.db
          .select()
          .from(schema.userLocations)
          .where(and(eq(schema.userLocations.userId, session.user.id), eq(schema.userLocations.locationType, 'home')))
          .limit(1);

        if (existingHome.length) {
          await app.db
            .delete(schema.userLocations)
            .where(eq(schema.userLocations.id, existingHome[0].id));
        }
      }

      // Store latitude/longitude as integers (degrees * 1000000 for precision)
      const locations = await app.db
        .insert(schema.userLocations)
        .values({
          userId: session.user.id,
          locationType: body.locationType,
          name: body.name || (body.locationType === 'home' ? 'Home' : 'Location'),
          latitude: Math.round(body.latitude * 1000000),
          longitude: Math.round(body.longitude * 1000000),
          radius: body.radius,
        })
        .returning();

      const location = locations[0];
      const locationWithDates = {
        ...location,
        latitude: location.latitude / 1000000,
        longitude: location.longitude / 1000000,
        createdAt: location.createdAt instanceof Date ? location.createdAt.toISOString() : new Date(location.createdAt).toISOString(),
        updatedAt: location.updatedAt instanceof Date ? location.updatedAt.toISOString() : new Date(location.updatedAt).toISOString(),
      };

      app.logger.info({ userId: session.user.id, locationId: location.id, locationType: body.locationType }, 'User location created successfully');
      return locationWithDates;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id, locationType: body.locationType },
        'Failed to create user location'
      );
      throw error;
    }
  });

  // DELETE /api/user-locations/:id - Delete user location
  app.fastify.delete('/api/user-locations/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, locationId: id }, 'Deleting user location');

    try {
      // Check if location exists and belongs to user
      const existingLocations = await app.db
        .select()
        .from(schema.userLocations)
        .where(eq(schema.userLocations.id, id))
        .limit(1);

      if (!existingLocations.length) {
        app.logger.warn({ userId: session.user.id, locationId: id }, 'Location not found');
        return reply.status(404).send({ error: 'Location not found' });
      }

      if (existingLocations[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, locationId: id, ownerId: existingLocations[0].userId },
          'Unauthorized access to location'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      await app.db
        .delete(schema.userLocations)
        .where(eq(schema.userLocations.id, id));

      app.logger.info({ userId: session.user.id, locationId: id }, 'User location deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, locationId: id }, 'Failed to delete user location');
      throw error;
    }
  });
}
