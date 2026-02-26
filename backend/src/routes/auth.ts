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
    try {
      const session = await requireAuth(request, reply);
      if (!session) {
        app.logger.debug({ headers: request.headers }, 'No session found in request');
        return;
      }

      app.logger.info({ userId: session.user.id, email: session.user.email }, 'User session retrieved');
      return {
        user: session.user,
        session: session.session,
      };
    } catch (error) {
      app.logger.error({ err: error }, 'Error retrieving user session');
      throw error;
    }
  });

  // Health check endpoint
  app.fastify.get('/api/auth/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['auth'],
      response: {
        200: {
          description: 'Service is healthy',
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok'] },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    return { status: 'ok' };
  });

  // GET /api/auth/debug-session - Debug session information (development only)
  app.fastify.get('/api/auth/debug-session', {
    schema: {
      description: 'Debug session information (development only)',
      tags: ['auth'],
      response: {
        200: {
          description: 'Session debug information',
          type: 'object',
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    const authHeader = request.headers.authorization;
    const origin = request.headers.origin;
    const cookieHeader = request.headers.cookie;

    app.logger.info(
      { authHeader: authHeader ? 'present' : 'missing', origin, cookieHeader: cookieHeader ? 'present' : 'missing' },
      'Debug session request'
    );

    return {
      hasAuthHeader: !!authHeader,
      hasCookie: !!cookieHeader,
      origin,
      environment: {
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        nodeEnv: process.env.NODE_ENV || 'development',
      },
      trustedOrigins: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'https://*.newly.dev',
        'https://*.app.specular.dev',
        'cheshbon://',
        'Cheshbon://',
        'exp://',
      ],
    };
  });

  // POST /api/auth/callback - Handle OAuth callback with session token
  app.fastify.post('/api/auth/callback', {
    schema: {
      description: 'Handle OAuth callback and establish session for mobile apps',
      tags: ['auth'],
      body: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'Session token from OAuth callback' },
          provider: { type: 'string', description: 'OAuth provider (google, apple)' },
          redirectUrl: { type: 'string', description: 'URL to redirect to after session establishment' },
        },
      },
      response: {
        200: {
          description: 'Session established',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            token: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    const { token, provider, redirectUrl } = request.body as any;
    const origin = request.headers.origin;

    app.logger.info(
      { provider, origin, redirectUrl: redirectUrl ? 'provided' : 'not provided', tokenLength: token ? token.length : 0 },
      'OAuth callback received'
    );

    if (!token) {
      app.logger.warn({ origin, provider }, 'OAuth callback missing session token');
      return reply.status(400).send({ error: 'Session token required' });
    }

    app.logger.info(
      { provider, tokenLength: token.length, origin },
      'OAuth session token received, session will be established'
    );

    return {
      success: true,
      token,
      message: 'Session established',
      redirectUrl: redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/`,
    };
  });

  // POST /api/auth/oauth-redirect - Handle OAuth redirect with query parameters
  app.fastify.post('/api/auth/oauth-redirect', {
    schema: {
      description: 'Handle OAuth redirect with token and callback URL',
      tags: ['auth'],
      body: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          callbackUrl: { type: 'string' },
          provider: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            redirectUrl: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    const { token, callbackUrl, provider } = request.body as any;
    const origin = request.headers.origin;

    app.logger.info(
      { provider, origin, hasToken: !!token, callbackUrl },
      'OAuth redirect request received'
    );

    if (!token) {
      app.logger.warn({ origin, provider, callbackUrl }, 'OAuth redirect missing token');
      return reply.status(400).send({ error: 'Token required' });
    }

    // Build the redirect URL with the token
    let redirectUrl = callbackUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/`;
    const separator = redirectUrl.includes('?') ? '&' : '?';
    redirectUrl = `${redirectUrl}${separator}token=${encodeURIComponent(token)}`;

    app.logger.info(
      { provider, origin, redirectUrl: redirectUrl.split('?')[0] },
      'OAuth redirect prepared'
    );

    return {
      token,
      redirectUrl,
    };
  });
}
