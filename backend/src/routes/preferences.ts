import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { createAuthWrapper } from '../utils/auth-wrapper.js';

export function registerPreferencesRoutes(app: App) {
  const requireAuth = createAuthWrapper(app);

  // GET /api/preferences - Get user preferences (simple response with reflection settings only)
  app.fastify.get('/api/preferences', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching user preferences');

    try {
      const preferences = await app.db
        .select()
        .from(schema.userPreferences)
        .where(eq(schema.userPreferences.userId, session.user.id))
        .limit(1);

      if (preferences.length === 0) {
        app.logger.info({ userId: session.user.id }, 'No preferences found, returning defaults');
        return {
          reflectionCategoriesEnabled: true,
          reflectionCategories: [],
        };
      }

      const pref = preferences[0];
      const categories = pref.reflectionCategories
        ? (typeof pref.reflectionCategories === 'string'
          ? JSON.parse(pref.reflectionCategories)
          : pref.reflectionCategories)
        : [];

      app.logger.info({ userId: session.user.id }, 'Preferences retrieved');

      return {
        reflectionCategoriesEnabled: pref.reflectionCategoriesEnabled,
        reflectionCategories: categories,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch preferences');
      throw error;
    }
  });

  // GET /api/user-preferences - Get user's preferences
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
            reflectionCategoriesEnabled: true,
            reflectionCategories: JSON.stringify(['Action', 'Speech', 'Thought']),
            preferredHomeScreen: 'reflect',
            alternativeCalendar: 'gregorian',
            timezone: 'UTC',
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

  // PUT /api/user-preferences - Update user's preferences
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
      reflectionCategoriesEnabled?: boolean;
      reflectionCategories?: string[];
      preferredHomeScreen?: 'reflect' | 'goals-detailed' | 'goals-concise';
      alternativeCalendar?: 'gregorian' | 'hebrew' | 'chinese';
      timezone?: string;
    };

    app.logger.info(
      { userId: session.user.id, notificationsEnabled: body.notificationsEnabled, preferredHomeScreen: body.preferredHomeScreen },
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
            reflectionCategoriesEnabled: body.reflectionCategoriesEnabled ?? true,
            reflectionCategories: body.reflectionCategories ? JSON.stringify(body.reflectionCategories) : JSON.stringify(['Action', 'Speech', 'Thought']),
            preferredHomeScreen: body.preferredHomeScreen || 'reflect',
            alternativeCalendar: body.alternativeCalendar || 'gregorian',
            timezone: body.timezone || 'UTC',
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
      if (body.reflectionCategoriesEnabled !== undefined) updateData.reflectionCategoriesEnabled = body.reflectionCategoriesEnabled;
      if (body.reflectionCategories !== undefined) updateData.reflectionCategories = body.reflectionCategories ? JSON.stringify(body.reflectionCategories) : null;
      if (body.preferredHomeScreen !== undefined) updateData.preferredHomeScreen = body.preferredHomeScreen;
      if (body.alternativeCalendar !== undefined) updateData.alternativeCalendar = body.alternativeCalendar;
      if (body.timezone !== undefined) updateData.timezone = body.timezone;
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
