import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';

// Helper function to check if a goal is active today
function isGoalActiveTodayHelper(goal: any): boolean {
  if (goal.scheduleType === 'Always Active') return true;

  const today = new Date();
  const dayOfWeek = today.getDay();
  const dateOfMonth = today.getDate();
  const month = today.getMonth() + 1;

  switch (goal.scheduleType) {
    case 'Daily':
      return true;

    case 'Weekly':
      if (goal.scheduleDaysOfWeek && Array.isArray(goal.scheduleDaysOfWeek)) {
        return goal.scheduleDaysOfWeek.includes(dayOfWeek);
      }
      return true;

    case 'Fortnightly':
      if (goal.scheduleDaysOfWeek && Array.isArray(goal.scheduleDaysOfWeek)) {
        return goal.scheduleDaysOfWeek.includes(dayOfWeek);
      }
      return true;

    case 'Monthly':
      if (goal.scheduleDatesOfMonth && Array.isArray(goal.scheduleDatesOfMonth)) {
        return goal.scheduleDatesOfMonth.includes(dateOfMonth);
      }
      return true;

    case 'Yearly':
      if (goal.scheduleDatesOfYear && Array.isArray(goal.scheduleDatesOfYear)) {
        const monthDay = `${String(month).padStart(2, '0')}-${String(dateOfMonth).padStart(2, '0')}`;
        return goal.scheduleDatesOfYear.includes(monthDay);
      }
      return true;

    default:
      return false;
  }
}

export function registerGoalsTrackingRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/goals/activated-today - Get goals that are active for today
  app.fastify.get('/api/goals/activated-today', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching goals activated today');

    try {
      const goals = await app.db
        .select()
        .from(schema.goals)
        .where(and(eq(schema.goals.userId, session.user.id), eq(schema.goals.isActive, true)));

      const reflections = await app.db
        .select()
        .from(schema.reflections)
        .where(eq(schema.reflections.userId, session.user.id));

      const lifeAreasData = await app.db
        .select()
        .from(schema.lifeAreas)
        .where(eq(schema.lifeAreas.userId, session.user.id));

      const lifeAreaMap = new Map(lifeAreasData.map(la => [la.id, la]));

      // Get today's date
      const today = new Date().toISOString().split('T')[0];

      // Filter goals that are active today
      const activatedToday = goals
        .filter(goal => isGoalActiveTodayHelper(goal))
        .map(goal => {
          // Count successes and struggles for today
          let todaySuccessCount = 0;
          let todayStruggleCount = 0;

          for (const reflection of reflections) {
            if (reflection.linkedGoalId === goal.id && reflection.entryDate === today) {
              if (reflection.outcome === 'success') todaySuccessCount++;
              else if (reflection.outcome === 'struggled') todayStruggleCount++;
            }
          }

          const lifeArea = goal.lifeAreaId ? lifeAreaMap.get(goal.lifeAreaId) : null;

          return {
            id: goal.id,
            title: goal.title,
            description: goal.description,
            type: goal.type === 'Restraint' ? 'RESTRAINING' : 'PROACTIVE',
            lifeArea: lifeArea
              ? { id: lifeArea.id, name: lifeArea.name }
              : null,
            behaviorCategories: goal.behaviorCategories || [],
            todaySuccessCount,
            todayStruggleCount,
          };
        });

      app.logger.info({ userId: session.user.id, count: activatedToday.length }, 'Goals activated today fetched');
      return activatedToday;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch goals activated today');
      throw error;
    }
  });

  // POST /api/goals/:id/success - Record a success for a goal today
  app.fastify.post('/api/goals/:id/success', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as { timestamp: string };

    app.logger.info({ userId: session.user.id, goalId: id }, 'Recording goal success');

    try {
      // Check if goal exists and belongs to user
      const goals = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.id, id))
        .limit(1);

      if (!goals.length) {
        app.logger.warn({ userId: session.user.id, goalId: id }, 'Goal not found');
        return reply.status(404).send({ error: 'Goal not found' });
      }

      if (goals[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, goalId: id, ownerId: goals[0].userId },
          'Unauthorized access to goal'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Get today's date
      const today = new Date().toISOString().split('T')[0];

      // Count today's successes
      const todayReflections = await app.db
        .select()
        .from(schema.reflections)
        .where(and(
          eq(schema.reflections.userId, session.user.id),
          eq(schema.reflections.linkedGoalId, id),
          eq(schema.reflections.entryDate, today),
          eq(schema.reflections.outcome, 'success')
        ));

      const todaySuccessCount = todayReflections.length;

      app.logger.info({ userId: session.user.id, goalId: id, todaySuccessCount }, 'Goal success recorded');
      return { success: true, todaySuccessCount };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, goalId: id }, 'Failed to record goal success');
      throw error;
    }
  });

  // POST /api/goals/:id/struggle - Record a struggle for a goal today
  app.fastify.post('/api/goals/:id/struggle', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as { timestamp: string };

    app.logger.info({ userId: session.user.id, goalId: id }, 'Recording goal struggle');

    try {
      // Check if goal exists and belongs to user
      const goals = await app.db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.id, id))
        .limit(1);

      if (!goals.length) {
        app.logger.warn({ userId: session.user.id, goalId: id }, 'Goal not found');
        return reply.status(404).send({ error: 'Goal not found' });
      }

      if (goals[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, goalId: id, ownerId: goals[0].userId },
          'Unauthorized access to goal'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Get today's date
      const today = new Date().toISOString().split('T')[0];

      // Count today's struggles
      const todayReflections = await app.db
        .select()
        .from(schema.reflections)
        .where(and(
          eq(schema.reflections.userId, session.user.id),
          eq(schema.reflections.linkedGoalId, id),
          eq(schema.reflections.entryDate, today),
          eq(schema.reflections.outcome, 'struggled')
        ));

      const todayStruggleCount = todayReflections.length;

      app.logger.info({ userId: session.user.id, goalId: id, todayStruggleCount }, 'Goal struggle recorded');
      return { success: true, todayStruggleCount };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, goalId: id }, 'Failed to record goal struggle');
      throw error;
    }
  });
}
