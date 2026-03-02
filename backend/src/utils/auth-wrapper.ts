import type { FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';
import { user, session } from '../db/auth-schema.js';
import { eq } from 'drizzle-orm';

/**
 * Enhanced authentication wrapper for iOS and custom sign-in compatibility
 *
 * Priority order:
 * 1. Database session lookup FIRST (for custom sign-in endpoints)
 * 2. Framework auth as fallback (for Better Auth endpoints)
 * 3. Validates session expiry
 * 4. Logs all steps for debugging
 *
 * This ensures valid sessions created by custom sign-in methods (Apple native, email)
 * are recognized immediately without needing framework-level auth validation.
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
      // FIRST: Try direct database lookup (for sessions created by custom sign-in endpoints)
      // Extract Bearer token from Authorization header
      let tokenFromHeader = null;
      if (authHeader?.startsWith('Bearer ')) {
        tokenFromHeader = authHeader.substring(7);
        app.logger.debug(
          { tokenTruncated: `${tokenFromHeader.substring(0, 30)}...` },
          'Bearer token extracted from header'
        );
      } else if (authHeader) {
        app.logger.warn(
          { authFormat: authHeader.substring(0, 15) },
          'Authorization header present but not in Bearer format'
        );
        // Continue to framework auth as fallback
      }

      // If we have a token, try database lookup first
      if (tokenFromHeader) {
        app.logger.debug(
          { tokenTruncated: `${tokenFromHeader.substring(0, 30)}...` },
          'Attempting direct DB session lookup'
        );

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

        if (dbSession) {
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
          } else {
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

            if (sessionUser) {
              app.logger.info(
                { userId: sessionUser.id, email: sessionUser.email, source: 'database' },
                'Auth validation succeeded via database lookup'
              );

              // Return session immediately - database lookup succeeded
              return {
                user: sessionUser,
                session: dbSession,
              };
            } else {
              app.logger.warn(
                { userId: dbSession.userId },
                'Session valid but user not found in database'
              );
            }
          }
        } else {
          app.logger.debug(
            { tokenTruncated: `${tokenFromHeader.substring(0, 30)}...` },
            'Session not found in database, will try framework auth'
          );
        }
      } else {
        app.logger.debug({}, 'No Bearer token to check in database');
      }

      // SECOND: Fall back to framework auth validation
      app.logger.debug({}, 'Attempting framework authentication');

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

      // Framework auth also failed
      if (reply.sent) {
        app.logger.debug(
          { statusCode: reply.statusCode },
          'Response already sent by framework auth'
        );
      } else {
        app.logger.warn(
          { authHeaderPresent: !!authHeader },
          'Auth validation failed - no valid session found'
        );
      }

      return null;
    } catch (error) {
      app.logger.error(
        { err: error, authHeaderPresent: !!authHeader },
        'Unexpected error during auth validation'
      );
      return null;
    }
  };
}
