import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

export function registerAuthRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/auth/me - Get current user session
  app.fastify.get('/api/auth/me', {
    schema: {
      description: 'Get current authenticated user session',
      tags: ['auth'],
      response: {
        200: {
          description: 'Current user session',
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                emailVerified: { type: 'boolean' },
                image: { type: 'string' },
              },
            },
            session: {
              type: 'object',
              properties: {
                expiresAt: { type: 'string', format: 'date-time' },
                token: { type: 'string' },
              },
            },
          },
        },
        401: {
          description: 'Not authenticated',
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
  ): Promise<any | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching current user session');
    return {
      user: session.user,
      session: session.session,
    };
  });

  // POST /api/auth/request-password-reset - Request password reset email
  app.fastify.post('/api/auth/request-password-reset', {
    schema: {
      description: 'Request a password reset email',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', description: 'User email address' },
        },
      },
      response: {
        200: {
          description: 'Password reset email sent',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        400: {
          description: 'Bad request or user not found',
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
  ): Promise<any | void> => {
    const { email } = request.body as { email?: string };

    if (!email) {
      app.logger.warn({ body: request.body }, 'Password reset requested without email');
      return reply.status(400).send({ error: 'Email is required' });
    }

    app.logger.info({ email }, 'Password reset requested');

    // Note: The actual password reset flow is handled by Better Auth
    // This endpoint is just a convenient wrapper for the frontend
    // The frontend should use POST /api/auth/request-password-reset directly with Better Auth
    return {
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link shortly.',
    };
  });
}
