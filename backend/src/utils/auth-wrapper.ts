import type { FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';
import { user, session } from '../db/auth-schema.js';
import { eq } from 'drizzle-orm';

/**
 * Enhanced authentication wrapper for iOS compatibility
 * Provides fallback session validation when framework auth fails
 *
 * 1. Tries standard framework auth validation first
 * 2. If that fails, does direct database lookup
 * 3. Validates session expiry
 * 4. Logs all steps for debugging
 */
export function createAuthWrapper(app: App) {
  const baseRequireAuth = app.requireAuth();

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    const authHeaderTruncated = authHeader ? `${authHeader.substring(0, 30)}...` : 'none';

    app.logger.debug(
      { authHeader: authHeaderTruncated, url: request.url },
      'Auth validation starting'
    );

    try {
      // First, try the standard framework auth validation
      const authResult = await baseRequireAuth(request, reply).catch((err) => {
        app.logger.debug(
          { err, authHeader: authHeaderTruncated },
          'Framework requireAuth threw an error'
        );
        return null;
      });

      // If framework auth succeeded, return it
      if (authResult) {
        app.logger.debug(
          { userId: authResult.user?.id, source: 'framework' },
          'Auth validation succeeded via framework'
        );
        return authResult;
      }

      // If framework auth failed or response already sent, try direct DB lookup
      if (reply.sent) {
        app.logger.debug(
          { statusCode: reply.statusCode },
          'Response already sent by framework auth'
        );
        return null;
      }

      // Try direct database lookup as fallback
      app.logger.debug({ authHeader: authHeaderTruncated }, 'Attempting direct DB session lookup');

      let tokenFromHeader = null;
      if (authHeader?.startsWith('Bearer ')) {
        tokenFromHeader = authHeader.substring(7);
        app.logger.debug(
          { tokenTruncated: `${tokenFromHeader.substring(0, 30)}...` },
          'Bearer token extracted for DB lookup'
        );
      } else if (authHeader) {
        app.logger.warn(
          { authFormat: authHeader.substring(0, 15) },
          'Authorization header present but not in Bearer format'
        );
        return null;
      } else {
        app.logger.warn({ url: request.url }, 'No authorization header provided');
        return null;
      }

      if (!tokenFromHeader) {
        app.logger.warn({}, 'Could not extract token from Bearer header');
        return null;
      }

      // Look up session in database
      const dbSession = await app.db.query.session.findFirst({
        where: eq(session.token, tokenFromHeader),
      }).catch((err) => {
        app.logger.error(
          { err, tokenTruncated: `${tokenFromHeader.substring(0, 30)}...` },
          'Error querying session from database'
        );
        return null;
      });

      if (!dbSession) {
        app.logger.warn(
          { tokenTruncated: `${tokenFromHeader.substring(0, 30)}...` },
          'Session not found in database'
        );
        return null;
      }

      app.logger.debug(
        { sessionId: dbSession.id, userId: dbSession.userId, expiresAt: dbSession.expiresAt },
        'Session found in database'
      );

      // Check if session is expired
      const now = new Date();
      if (dbSession.expiresAt < now) {
        app.logger.warn(
          { sessionId: dbSession.id, expiresAt: dbSession.expiresAt, now: now.toISOString() },
          'Session found but is expired'
        );
        return null;
      }

      app.logger.debug(
        { sessionId: dbSession.id, expiresAtMs: dbSession.expiresAt.getTime() - now.getTime() },
        'Session is valid and not expired'
      );

      // Get the user associated with this session
      const sessionUser = await app.db.query.user.findFirst({
        where: eq(user.id, dbSession.userId),
      }).catch((err) => {
        app.logger.error(
          { err, userId: dbSession.userId },
          'Error querying user for valid session'
        );
        return null;
      });

      if (!sessionUser) {
        app.logger.warn(
          { userId: dbSession.userId },
          'Session valid but user not found'
        );
        return null;
      }

      app.logger.info(
        { userId: sessionUser.id, email: sessionUser.email, source: 'database' },
        'Auth validation succeeded via database lookup'
      );

      // Return a session object in the format expected by the application
      return {
        user: sessionUser,
        session: dbSession,
      };
    } catch (error) {
      app.logger.error(
        { err: error, authHeaderPresent: !!authHeader },
        'Unexpected error during auth validation'
      );
      return null;
    }
  };
}
