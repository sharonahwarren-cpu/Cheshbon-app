import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

export function registerAuthRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/auth/oauth-test - Test OAuth configuration and endpoints
  app.fastify.get('/api/auth/oauth-test', {
    schema: {
      description: 'Test OAuth configuration and endpoints (development endpoint)',
      tags: ['auth'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            providers: { type: 'array' },
            endpoints: { type: 'array' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    const providers = [];
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      providers.push('google');
    }
    if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY) {
      providers.push('apple');
    }

    return {
      status: 'ok',
      providers,
      endpoints: [
        'POST /api/auth/sign-in/social (Better Auth automatic OAuth)',
        'POST /api/auth/sign-in/social-v1 (OAuth wrapper with error handling)',
        'POST /api/auth/initiate-social (OAuth initiation for mobile/web)',
        'POST /api/auth/sign-in/email (Email/password sign-in)',
        'POST /api/auth/sign-up/email (Email/password registration)',
        'POST /api/auth/callback (OAuth callback)',
        'POST /api/auth/oauth-start (OAuth flow start)',
        'POST /api/auth/oauth-redirect (OAuth redirect handler)',
        'GET /api/auth/me (Get authenticated user)',
        'GET /api/auth/get-session (Get current session)',
        'POST /api/auth/sign-out (Sign out)',
        'GET /api/auth/health (Health check)',
        'GET /api/auth/debug-session (Debug auth headers)',
      ],
      message: `OAuth configured for: ${providers.length > 0 ? providers.join(', ') : 'NONE - check environment variables'}`,
      configuration: {
        baseUrl: process.env.BASE_URL || 'not set',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        googleOAuthConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        appleOAuthConfigured: !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY),
      },
    };
  });

  // POST /api/auth/initiate-social - Initiate social OAuth sign-in with proper redirection
  app.fastify.post('/api/auth/initiate-social', {
    schema: {
      description: 'Initiate social OAuth sign-in (Google or Apple)',
      tags: ['auth'],
      body: {
        type: 'object',
        properties: {
          provider: { type: 'string', enum: ['google', 'apple'], description: 'OAuth provider' },
          callbackURL: { type: 'string', description: 'Callback URL after OAuth (optional, for mobile deep links)' },
          redirectURL: { type: 'string', description: 'Web redirect URL after authentication (optional)' },
        },
        required: ['provider'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            provider: { type: 'string' },
            authorizationUrl: { type: 'string' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    const { provider, callbackURL, redirectURL } = request.body as any;
    const origin = request.headers.origin || request.headers.host || 'http://localhost';

    app.logger.info(
      { provider, callbackURL: callbackURL ? 'provided' : 'not provided', origin },
      'OAuth sign-in initiated'
    );

    if (!provider || !['google', 'apple'].includes(provider)) {
      app.logger.warn({ provider, origin }, 'Invalid provider');
      return reply.status(400).send({
        error: 'INVALID_PROVIDER',
        message: 'Provider must be "google" or "apple"',
      });
    }

    // Check if OAuth credentials are configured
    const hasGoogleOAuth = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
    const hasAppleOAuth = process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY;

    if (provider === 'google' && !hasGoogleOAuth) {
      app.logger.warn({ origin }, 'Google OAuth not configured');
      return reply.status(400).send({
        error: 'OAUTH_NOT_CONFIGURED',
        message: 'Google OAuth not configured',
      });
    }

    if (provider === 'apple' && !hasAppleOAuth) {
      app.logger.warn({ origin }, 'Apple OAuth not configured');
      return reply.status(400).send({
        error: 'OAUTH_NOT_CONFIGURED',
        message: 'Apple OAuth not configured',
      });
    }

    const baseUrl = process.env.BASE_URL || `http://${request.headers.host}`;
    // Better Auth handles the actual OAuth redirect at /api/auth/sign-in/social
    const authorizationUrl = `${baseUrl}/api/auth/sign-in/social?provider=${provider}${callbackURL ? `&callbackURL=${encodeURIComponent(callbackURL)}` : ''}${redirectURL ? `&redirectURL=${encodeURIComponent(redirectURL)}` : ''}`;

    app.logger.info(
      { provider, origin, isMobile: !!callbackURL },
      `${provider} OAuth authorization URL prepared`
    );

    return {
      provider,
      authorizationUrl,
      message: `Redirect to this URL to sign in with ${provider}`,
    };
  });

  // POST /api/auth/sign-in/social - Handle OAuth sign-in (wrapper with error handling)
  app.fastify.post('/api/auth/sign-in/social-v1', {
    schema: {
      description: 'Sign in with OAuth provider (wrapper endpoint)',
      tags: ['auth'],
      querystring: {
        type: 'object',
        properties: {
          provider: { type: 'string', enum: ['google', 'apple'], description: 'OAuth provider' },
          callbackURL: { type: 'string', description: 'Callback URL after OAuth (optional)' },
        },
        required: ['provider'],
      },
      body: {
        type: 'object',
        properties: {
          provider: { type: 'string' },
          callbackURL: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            authorizationUrl: { type: 'string' },
            provider: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    const queryProvider = (request.query as any)?.provider;
    const queryCallbackURL = (request.query as any)?.callbackURL;
    const bodyProvider = (request.body as any)?.provider;
    const bodyCallbackURL = (request.body as any)?.callbackURL;

    const provider = queryProvider || bodyProvider;
    const callbackURL = queryCallbackURL || bodyCallbackURL;

    app.logger.info(
      { provider, callbackURL: callbackURL ? 'provided' : 'not provided', origin: request.headers.origin },
      'OAuth sign-in requested'
    );

    if (!provider || !['google', 'apple'].includes(provider)) {
      app.logger.warn({ provider, origin: request.headers.origin }, 'Invalid or missing provider');
      return reply.status(400).send({
        error: 'INVALID_PROVIDER',
        message: 'Provider must be "google" or "apple"',
      });
    }

    // Check if OAuth credentials are configured
    const hasGoogleOAuth = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
    const hasAppleOAuth = process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY;

    if (provider === 'google' && !hasGoogleOAuth) {
      app.logger.warn({ origin: request.headers.origin }, 'Google OAuth not configured');
      return reply.status(400).send({
        error: 'OAUTH_NOT_CONFIGURED',
        message: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.',
      });
    }

    if (provider === 'apple' && !hasAppleOAuth) {
      app.logger.warn({ origin: request.headers.origin }, 'Apple OAuth not configured');
      return reply.status(400).send({
        error: 'OAUTH_NOT_CONFIGURED',
        message: 'Apple OAuth is not configured. Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY environment variables.',
      });
    }

    // Build the authorization URL
    // Better Auth handles the OAuth flow automatically at /api/auth/sign-in/social
    const authorizationUrl = `/api/auth/sign-in/social?provider=${provider}${callbackURL ? `&callbackURL=${encodeURIComponent(callbackURL)}` : ''}`;

    app.logger.info(
      { provider, authorizationUrl: authorizationUrl.split('?')[0], hasCallbackURL: !!callbackURL },
      `${provider} OAuth authorization URL prepared`
    );

    return {
      provider,
      authorizationUrl,
    };
  });

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
            redirectUrl: { type: 'string' },
            message: { type: 'string' },
          },
        },
        400: {
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

    // Build the final redirect URL with the token
    let finalRedirectUrl = redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/`;
    const separator = finalRedirectUrl.includes('?') ? '&' : '?';
    finalRedirectUrl = `${finalRedirectUrl}${separator}token=${encodeURIComponent(token)}`;

    app.logger.info(
      { provider, tokenLength: token.length, origin, redirectUrlBase: finalRedirectUrl.split('?')[0] },
      'OAuth session token received, session established, redirecting to app'
    );

    return {
      success: true,
      token,
      redirectUrl: finalRedirectUrl,
      message: 'Session established',
    };
  });

  // POST /api/auth/oauth-start - Initiate OAuth flow with provider and callback URL
  app.fastify.post('/api/auth/oauth-start', {
    schema: {
      description: 'Initiate OAuth sign-in with provider and callback URL for mobile apps',
      tags: ['auth'],
      body: {
        type: 'object',
        properties: {
          provider: { type: 'string', enum: ['google', 'apple'], description: 'OAuth provider' },
          callbackUrl: { type: 'string', description: 'Mobile app callback URL (e.g., cheshbon://auth-callback)' },
        },
        required: ['provider'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            provider: { type: 'string' },
            authorizationUrl: { type: 'string' },
            message: { type: 'string' },
          },
        },
        400: {
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
  ): Promise<any> => {
    const { provider, callbackUrl } = request.body as any;
    const origin = request.headers.origin;

    app.logger.info(
      { provider, origin, callbackUrl: callbackUrl ? 'provided' : 'not provided' },
      'OAuth sign-in initiated'
    );

    if (!provider || !['google', 'apple'].includes(provider)) {
      app.logger.warn({ origin, provider }, 'Invalid OAuth provider');
      return reply.status(400).send({ error: 'Invalid provider. Must be google or apple.' });
    }

    const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // The OAuth authorization URL will be generated by Better Auth
    // The /api/auth/sign-in/social endpoint handles the actual OAuth flow
    const authorizationUrl = `${frontendUrl}/api/auth/sign-in/social?provider=${provider}${callbackUrl ? `&callbackURL=${encodeURIComponent(callbackUrl)}` : ''}`;

    app.logger.info(
      { provider, authorizationUrl: authorizationUrl.split('?')[0] },
      `${providerName} OAuth authorization URL prepared`
    );

    return {
      provider,
      authorizationUrl,
      message: `Redirect user to this URL to sign in with ${providerName}`,
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
        400: {
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
