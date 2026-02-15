import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerPreferencesRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/user-preferences - Get user's notification preferences
  app.fastify.get('/api/user-preferences', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching user preferences');

    try {
      let preferences = await app.db
        .select()
        .from(schema.userPreferences)
        .where(eq(schema.userPreferences.userId, session.user.id))
        .limit(1);

      // If no preferences exist, create default ones
      if (!preferences.length) {
        app.logger.info({ userId: session.user.id }, 'Creating default user preferences');
        const newPreferences = await app.db
          .insert(schema.userPreferences)
          .values({
            userId: session.user.id,
            notificationsEnabled: false,
            notificationFrequency: null,
            notificationTime: null,
            notificationDays: null,
          })
          .returning();
        preferences = newPreferences;
      }

      app.logger.info({ userId: session.user.id }, 'User preferences fetched successfully');
      return preferences[0];
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch user preferences');
      throw error;
    }
  });

  // PUT /api/user-preferences - Update user's notification preferences
  app.fastify.put('/api/user-preferences', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as {
      notificationsEnabled?: boolean;
      notificationFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
      notificationTime?: string;
      notificationDays?: string[];
      notificationAlarms?: Array<{
        id?: string;
        name: string;
        time: string;
        frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
        dayOfWeek?: string;
        dayOfMonth?: number;
      }>;
    };

    app.logger.info(
      { userId: session.user.id, notificationsEnabled: body.notificationsEnabled, alarmCount: body.notificationAlarms?.length },
      'Updating user preferences'
    );

    try {
      // Get existing preferences or create default
      let existingPreferences = await app.db
        .select()
        .from(schema.userPreferences)
        .where(eq(schema.userPreferences.userId, session.user.id))
        .limit(1);

      if (!existingPreferences.length) {
        app.logger.info({ userId: session.user.id }, 'Creating user preferences for first time');
        const newPreferences = await app.db
          .insert(schema.userPreferences)
          .values({
            userId: session.user.id,
            notificationsEnabled: body.notificationsEnabled ?? false,
            notificationFrequency: body.notificationFrequency || null,
            notificationTime: body.notificationTime || null,
            notificationDays: (body.notificationDays?.length ? body.notificationDays : null) as string[] | null,
            notificationAlarms: body.notificationAlarms ? JSON.stringify(body.notificationAlarms) : null,
          })
          .returning();
        app.logger.info({ userId: session.user.id }, 'User preferences created successfully');
        return newPreferences[0];
      }

      const updateData: Record<string, unknown> = {};
      if (body.notificationsEnabled !== undefined) updateData.notificationsEnabled = body.notificationsEnabled;
      if (body.notificationFrequency !== undefined) updateData.notificationFrequency = body.notificationFrequency || null;
      if (body.notificationTime !== undefined) updateData.notificationTime = body.notificationTime || null;
      if (body.notificationDays !== undefined) updateData.notificationDays = (body.notificationDays?.length ? body.notificationDays : null) as string[] | null;
      if (body.notificationAlarms !== undefined) updateData.notificationAlarms = body.notificationAlarms ? JSON.stringify(body.notificationAlarms) : null;
      updateData.updatedAt = new Date();

      const updatedPreferences = await app.db
        .update(schema.userPreferences)
        .set(updateData)
        .where(eq(schema.userPreferences.userId, session.user.id))
        .returning();
      const updatedPreference = updatedPreferences[0];

      app.logger.info({ userId: session.user.id }, 'User preferences updated successfully');
      return updatedPreference;
    } catch (error) {
      app.logger.error(
        { err: error, userId: session.user.id },
        'Failed to update user preferences'
      );
      throw error;
    }
  });
}
