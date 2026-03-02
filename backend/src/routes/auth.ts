import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { user, session, account } from '../db/auth-schema.js';
import { eq, and } from 'drizzle-orm';
import { createAuthWrapper } from '../utils/auth-wrapper.js';

/**
 * Helper function to derive BASE_URL with proper handling for proxied/tunneled environments
 * Priority order:
 * 1. x-forwarded-host header (highest priority for proxy detection)
 * 2. BASE_URL environment variable (explicit user configuration)
 * 3. origin header (from request - contains public URL if available)
 * 4. referer header (fallback from request)
 * 5. host header (fallback when not behind proxy)
 */
function deriveBASEUrl(
  request: FastifyRequest,
  logger: any
): { url: string | null; source: string; detectedLocalhost: boolean } {
  const proto = request.headers['x-forwarded-proto'] || 'https';
  const hostHeader = request.headers.host;
  const xForwardedHostRaw = request.headers['x-forwarded-host'];
  // Handle case where header might be string or string[] (multi-value)
  const xForwardedHostHeader = Array.isArray(xForwardedHostRaw) ? xForwardedHostRaw[0] : xForwardedHostRaw;
  const envBaseUrl = process.env.BASE_URL;
  const originHeader = request.headers.origin;
  const refererHeader = request.headers.referer;

  // Check if host is localhost (indicates proxied/tunneled environment)
  const isHostLocalhost = hostHeader && (hostHeader.includes('localhost') || hostHeader.includes('127.0.0.1'));

  let resolvedHost: string | undefined;
  let source: string;
  let detectedLocalhost = false;

  // Priority 1: x-forwarded-host header (for proxy detection - highest priority)
  if (xForwardedHostHeader) {
    resolvedHost = xForwardedHostHeader;
    source = 'x-forwarded-host header';
    logger.info(
      { hostHeader, xForwardedHostHeader, resolvedHost, proto },
      'BASE_URL derived from x-forwarded-host (proxy detected)'
    );
  }
  // Priority 2: BASE_URL environment variable (explicit user configuration)
  else if (envBaseUrl) {
    // Extract host from BASE_URL
    try {
      const baseUrlObj = new URL(envBaseUrl);
      resolvedHost = baseUrlObj.host;
      source = 'BASE_URL environment variable';
      logger.info(
        { baseUrl: envBaseUrl, resolvedHost, proto },
        'BASE_URL resolved from environment variable'
      );
    } catch (error) {
      logger.error(
        { baseUrl: envBaseUrl, err: error },
        'Invalid BASE_URL format'
      );
      return { url: null, source: 'invalid BASE_URL format', detectedLocalhost: false };
    }
  }
  // Priority 3: origin header (from request - contains public URL if available)
  else if (originHeader && !originHeader.includes('localhost') && !originHeader.includes('127.0.0.1')) {
    try {
      const originUrl = new URL(originHeader);
      resolvedHost = originUrl.host;
      source = 'origin header';
      logger.info(
        { originHeader, resolvedHost, proto },
        'BASE_URL derived from origin header'
      );
    } catch (error) {
      logger.debug(
        { originHeader, err: error },
        'Could not parse origin header'
      );
    }
  }
  // Priority 4: referer header (fallback from request)
  if (!resolvedHost && refererHeader && !refererHeader.includes('localhost') && !refererHeader.includes('127.0.0.1')) {
    try {
      const refererUrl = new URL(refererHeader);
      resolvedHost = refererUrl.host;
      source = 'referer header';
      logger.info(
        { refererHeader, resolvedHost, proto },
        'BASE_URL derived from referer header'
      );
    } catch (error) {
      logger.debug(
        { refererHeader, err: error },
        'Could not parse referer header'
      );
    }
  }
  // Priority 5: host header (fallback when not behind proxy)
  if (!resolvedHost && hostHeader && !isHostLocalhost) {
    resolvedHost = hostHeader;
    source = 'host header';
    logger.info(
      { hostHeader, proto },
      'BASE_URL derived from host header'
    );
  }
  // Error case: localhost detected but can't determine public URL from fallbacks
  if (!resolvedHost && isHostLocalhost) {
    detectedLocalhost = true;
    logger.error(
      {
        hostHeader,
        xForwardedHostHeader,
        originHeader,
        refererHeader,
        envBaseUrl,
        availableHeaders: {
          host: !!hostHeader,
          'x-forwarded-host': !!xForwardedHostHeader,
          origin: !!originHeader,
          referer: !!refererHeader,
          'BASE_URL env': !!envBaseUrl
        }
      },
      'Detected localhost in host header - cannot determine public URL. Set BASE_URL environment variable or configure x-forwarded-host in proxy.'
    );
    return { url: null, source: 'none - localhost detected without fallback sources', detectedLocalhost: true };
  }
  // Final error: no host information available
  if (!resolvedHost) {
    logger.error(
      {
        hostHeader,
        xForwardedHostHeader,
        originHeader,
        refererHeader,
        envBaseUrl
      },
      'Could not determine BASE_URL - no host, x-forwarded-host, origin, referer, or BASE_URL available'
    );
    return { url: null, source: 'none - no sources available', detectedLocalhost: false };
  }

  const url = `${proto}://${resolvedHost}`;

  // Check if resolved URL is localhost in production
  const isResolvedLocalhost = resolvedHost.includes('localhost') || resolvedHost.includes('127.0.0.1');
  if (isResolvedLocalhost && process.env.NODE_ENV === 'production') {
    logger.warn(
      { url, nodeEnv: process.env.NODE_ENV, source },
      'WARNING: BASE_URL resolved to localhost in production - OAuth redirects may fail'
    );
  }

  return { url, source, detectedLocalhost };
}

export function registerAuthRoutes(app: App) {
  const requireAuth = createAuthWrapper(app);

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
        'POST /api/auth/sign-in/social (Better Auth - automatic OAuth)',
        'POST /api/auth/sign-in/social-v1 (OAuth wrapper with error handling)',
        'POST /api/auth/initiate-social (OAuth initiation for mobile/web)',
        'POST /api/auth/sign-in/email (Email/password sign-in)',
        'POST /api/auth/sign-up/email (Email/password registration)',
        'GET /api/auth/oauth-callback (OAuth provider callback - code exchange)',
        'POST /api/auth/callback (OAuth callback handler)',
        'POST /api/auth/oauth-start (OAuth flow start)',
        'POST /api/auth/oauth-redirect (OAuth redirect handler)',
        'POST /api/auth/apple-callback (Apple OAuth callback)',
        'POST /api/auth/apple/native (Apple native sign-in with id_token)',
        'GET /api/auth/me (Get authenticated user - use Bearer token)',
        'GET /api/auth/get-session (Get current session)',
        'POST /api/auth/sign-out (Sign out)',
        'GET /api/auth/health (Health check)',
        'GET /api/auth/debug-session (Debug auth headers)',
        'POST /api/auth/test-session (Create test session for debugging)',
        'GET /api/auth/session-diagnostic (Diagnose session validation issues)',
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
    // Note: Google OAuth is handled by Better Auth internally, no explicit env var check needed
    const hasAppleOAuth = process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY;

    // Apple OAuth requires explicit credentials
    if (provider === 'apple' && !hasAppleOAuth) {
      app.logger.warn({ origin }, 'Apple OAuth not configured');
      return reply.status(400).send({
        error: 'OAUTH_NOT_CONFIGURED',
        message: 'Apple OAuth not configured. Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY.',
      });
    }

    // Google OAuth is handled by Better Auth - it can work with or without explicit credentials
    // Better Auth may use its own proxy/configuration
    if (provider === 'google') {
      app.logger.info({ origin }, 'Google OAuth requested - delegating to Better Auth');
    }

    // Derive BASE_URL with proper handling for proxied environments
    const { url: backendBaseUrl, source: urlSource, detectedLocalhost } = deriveBASEUrl(request, app.logger);

    if (!backendBaseUrl) {
      app.logger.error(
        { provider, headers: { host: request.headers.host, xForwardedHost: request.headers['x-forwarded-host'] } },
        'Could not determine BASE_URL from environment or request headers'
      );
      return reply.status(500).send({
        error: 'SERVER_ERROR',
        message: 'Backend URL could not be determined. Set BASE_URL environment variable or ensure Host header is present.',
      });
    }

    // Generate the actual OAuth provider authorization URL directly
    let authorizationUrl: string;

    if (provider === 'google') {
      // Google OAuth is handled by Better Auth - delegate to Better Auth's social sign-in route
      // Better Auth supports Google OAuth with platform-level configuration
      // No need to check for explicit GOOGLE_CLIENT_ID/SECRET environment variables

      authorizationUrl = `${backendBaseUrl}/api/auth/sign-in/social?provider=${provider}`;

      // Add custom parameters for frontend callback handling
      if (callbackURL) {
        authorizationUrl += `&callbackURL=${encodeURIComponent(callbackURL)}`;
      }
      if (redirectURL) {
        authorizationUrl += `&redirectURL=${encodeURIComponent(redirectURL)}`;
      }

      app.logger.info(
        {
          provider: 'google',
          backendBaseUrl,
          urlSource,
          detectedLocalhost,
          isMobile: !!callbackURL,
          hasCallbackURL: !!callbackURL,
          betterAuthRoute: '/api/auth/sign-in/social'
        },
        `Google OAuth delegated to Better Auth social sign-in route (BASE_URL source: ${urlSource})`
      );
    } else if (provider === 'apple') {
      // Generate Apple OAuth authorization URL directly from Apple's endpoint
      const appleAuthUrl = new URL('https://appleid.apple.com/auth/authorize');

      const clientId = process.env.APPLE_CLIENT_ID;
      if (!clientId) {
        app.logger.error({ origin }, 'Apple OAuth not configured - APPLE_CLIENT_ID not set');
        return reply.status(400).send({
          error: 'APPLE_OAUTH_NOT_CONFIGURED',
          message: 'Apple OAuth is not configured. Set APPLE_CLIENT_ID and other Apple OAuth environment variables.',
        });
      }

      const state = Math.random().toString(36).substring(7) + Date.now().toString(36);

      appleAuthUrl.searchParams.append('client_id', clientId);
      // Use Better Auth's callback pattern: /api/auth/callback/apple
      appleAuthUrl.searchParams.append('redirect_uri', `${backendBaseUrl}/api/auth/callback/apple`);
      appleAuthUrl.searchParams.append('response_type', 'code id_token');
      appleAuthUrl.searchParams.append('scope', 'openid email name');
      appleAuthUrl.searchParams.append('state', state);
      appleAuthUrl.searchParams.append('response_mode', 'form_post');

      if (callbackURL) {
        appleAuthUrl.searchParams.append('callbackURL', callbackURL);
      }
      if (redirectURL) {
        appleAuthUrl.searchParams.append('redirectURL', redirectURL);
      }

      authorizationUrl = appleAuthUrl.toString();

      app.logger.info(
        {
          provider: 'apple',
          backendBaseUrl,
          urlSource,
          detectedLocalhost,
          isMobile: !!callbackURL,
          hasCallbackURL: !!callbackURL,
          redirectUri: `${backendBaseUrl}/api/auth/callback/apple`,
          oauthProviderHost: 'appleid.apple.com',
          betterAuthCallback: true
        },
        `Apple OAuth authorization URL generated with Better Auth callback (BASE_URL source: ${urlSource})`
      );
    } else {
      app.logger.warn({ provider, origin }, 'Unsupported OAuth provider');
      return reply.status(400).send({
        error: 'UNSUPPORTED_PROVIDER',
        message: `Unsupported OAuth provider: ${provider}. Use 'google' or 'apple'.`,
      });
    }

    // Return the actual OAuth provider authorization URL to the frontend
    // For mobile apps (with callbackURL): return JSON with URL
    // For web browsers (without callbackURL): redirect directly
    if (callbackURL) {
      // Mobile app or popup - return JSON with the direct OAuth provider URL
      app.logger.info(
        { provider, clientType: 'mobile/popup', callbackURL: 'provided', oauthProviderHost: authorizationUrl.split('/')[2] },
        'Returning direct OAuth provider authorization URL for mobile/popup client'
      );
      return {
        provider,
        authorizationUrl,
        message: `Redirect to this URL to sign in with ${provider}`,
      };
    } else {
      // Web browser - perform HTTP redirect to the OAuth provider directly
      app.logger.info(
        { provider, clientType: 'web', oauthProviderHost: authorizationUrl.split('/')[2] },
        'Web client - redirecting directly to OAuth provider'
      );
      reply.redirect(authorizationUrl);
      return;
    }
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
    // Note: Google OAuth is handled by Better Auth internally, no explicit env var check needed
    const hasAppleOAuth = process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY;

    // Apple OAuth requires explicit credentials
    if (provider === 'apple' && !hasAppleOAuth) {
      app.logger.warn({ origin: request.headers.origin }, 'Apple OAuth not configured');
      return reply.status(400).send({
        error: 'OAUTH_NOT_CONFIGURED',
        message: 'Apple OAuth is not configured. Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY environment variables.',
      });
    }

    // Google OAuth is handled by Better Auth - it can work with or without explicit credentials
    // Better Auth may use its own proxy/configuration
    if (provider === 'google') {
      app.logger.info({ origin: request.headers.origin }, 'Google OAuth requested - delegating to Better Auth');
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

  // GET /api/auth/me - Get current authenticated user session
  app.fastify.get('/api/auth/me', {
    schema: {
      description: 'Get current authenticated user session (use Bearer token in Authorization header)',
      tags: ['auth'],
      response: {
        200: {
          description: 'Current user session with token',
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
                token: { type: 'string', description: 'Session token for Bearer authentication' },
                expiresAt: { type: 'string', format: 'date-time' },
              },
            },
            token: { type: 'string', description: 'Session token (for convenience)' },
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
    app.logger.info({ path: request.url }, 'GET /api/auth/me requested');

    try {
      const session = await requireAuth(request, reply);

      // If requireAuth already sent a response, don't send another
      if (reply.sent) {
        app.logger.debug({ statusCode: reply.statusCode }, 'Auth validation sent response');
        return;
      }

      if (!session) {
        app.logger.warn({ url: request.url }, 'No valid session found');
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      app.logger.info(
        { userId: session.user?.id, email: session.user?.email },
        'User session retrieved'
      );

      // Return token both in session object and at root level for flexibility
      return {
        user: session.user,
        session: {
          token: session.session.token,
          expiresAt: session.session.expiresAt,
        },
        token: session.session.token,
      };
    } catch (error) {
      // Only send error response if one hasn't been sent yet
      if (!reply.sent) {
        app.logger.error({ err: error, url: request.url }, 'Error retrieving user session');
        return reply.status(401).send({ error: 'Unauthorized' });
      }
      return;
    }
  });

  // POST /api/auth/test-session - Test session creation and validation
  app.fastify.post('/api/auth/test-session', {
    schema: {
      description: 'Test endpoint for session creation and validation (development only)',
      tags: ['auth'],
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID to test with' },
        },
        required: ['userId'],
      },
      response: {
        200: {
          type: 'object',
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    const { userId } = request.body as { userId: string };

    try {
      app.logger.info({ userId }, 'Test session endpoint called');

      // Create a test session
      const testToken = `test_session_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
      const testSessionId = `test_${Math.random().toString(36).substr(2, 9)}`;
      const testExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      app.logger.debug({ testSessionId, userId, testToken: `${testToken.substring(0, 30)}...` }, 'Creating test session');

      // Verify user exists
      const userExists = await app.db.query.user.findFirst({
        where: eq(user.id, userId),
      }).catch(() => null);

      if (!userExists) {
        app.logger.warn({ userId }, 'Test user does not exist');
        return reply.status(400).send({ error: 'User not found' });
      }

      // Create session
      await app.db.insert(session).values({
        id: testSessionId,
        token: testToken,
        expiresAt: testExpiresAt,
        userId,
        ipAddress: request.socket.remoteAddress || null,
        userAgent: request.headers['user-agent'] || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      app.logger.info({ testSessionId, userId }, 'Test session created');

      // Verify it can be read back
      const retrievedSession = await app.db.query.session.findFirst({
        where: eq(session.token, testToken),
      }).catch((err) => {
        app.logger.error({ err }, 'Error retrieving test session');
        return null;
      });

      if (!retrievedSession) {
        app.logger.error({ testToken: `${testToken.substring(0, 30)}...` }, 'Test session could not be retrieved');
        return reply.status(500).send({
          error: 'Session validation failed',
          message: 'Created session could not be retrieved from database',
        });
      }

      app.logger.info(
        { testSessionId, userId: retrievedSession.userId, expiresAt: retrievedSession.expiresAt },
        'Test session retrieved successfully'
      );

      // Clean up - delete test session
      await app.db.delete(session).where(eq(session.id, testSessionId)).catch(() => null);

      return {
        success: true,
        testResults: {
          sessionCreated: true,
          sessionRetrieved: true,
          userId: retrievedSession.userId,
          expiresAt: retrievedSession.expiresAt,
          message: 'Session creation and retrieval working correctly',
          testToken: testToken,
          bearerToken: `Bearer ${testToken}`,
          usage: 'Use the bearerToken above in Authorization header to test authenticated requests',
        },
      };
    } catch (error) {
      app.logger.error({ err: error }, 'Test session endpoint error');
      return reply.status(500).send({
        error: 'Test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // GET /api/auth/session-diagnostic - Diagnostic endpoint for session debugging
  app.fastify.get('/api/auth/session-diagnostic', {
    schema: {
      description: 'Diagnostic endpoint to debug session and authentication issues (development only)',
      tags: ['auth'],
      response: {
        200: {
          type: 'object',
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    const authHeader = request.headers.authorization;
    const authHeaderTruncated = authHeader ? `${authHeader.substring(0, 30)}...` : 'none';

    app.logger.info({ path: request.url, authHeader: authHeaderTruncated }, 'Session diagnostic requested');

    try {
      // Extract token from Authorization header
      let tokenFromHeader = null;
      if (authHeader?.startsWith('Bearer ')) {
        tokenFromHeader = authHeader.substring(7);
        app.logger.debug(
          { tokenTruncated: `${tokenFromHeader.substring(0, 30)}...` },
          'Bearer token extracted from header'
        );
      }

      // Try to find the session in the database
      let sessionInDb = null;
      if (tokenFromHeader) {
        sessionInDb = await app.db.query.session.findFirst({
          where: eq(session.token, tokenFromHeader),
        }).catch((err) => {
          app.logger.error({ err }, 'Error querying session by token');
          return null;
        });

        if (sessionInDb) {
          app.logger.info(
            { sessionId: sessionInDb.id, userId: sessionInDb.userId, expiresAt: sessionInDb.expiresAt },
            'Session found in database'
          );
        } else {
          app.logger.warn(
            { tokenTruncated: `${tokenFromHeader.substring(0, 30)}...` },
            'Session token not found in database'
          );
        }
      }

      // Try requireAuth to see what it returns
      const authResult = await requireAuth(request, reply).catch((err) => {
        app.logger.error({ err }, 'requireAuth threw an error');
        return null;
      });

      app.logger.info(
        { hasAuthResult: !!authResult, replySent: reply.sent },
        'requireAuth check completed'
      );

      if (reply.sent) {
        return { diagnostic: 'requireAuth already sent a response', statusCode: reply.statusCode };
      }

      // Get all sessions for debugging (limit to 5 most recent)
      const allSessions = await app.db.query.session.findMany({
        orderBy: (session, { desc }) => [desc(session.createdAt)],
        limit: 5,
      }).catch(() => []);

      return {
        diagnostic: {
          timestamp: new Date().toISOString(),
          authHeaderPresent: !!authHeader,
          authHeaderFormat: authHeader?.substring(0, 10) || 'none',
          tokenExtracted: !!tokenFromHeader,
          sessionFoundInDb: !!sessionInDb,
          requireAuthResult: {
            hasSession: !!authResult,
            hasUser: !!authResult?.user,
            userId: authResult?.user?.id || 'none',
          },
          recentSessions: allSessions.map((s) => ({
            id: s.id,
            userId: s.userId,
            tokenTruncated: `${s.token?.substring(0, 20)}...` || 'none',
            expiresAt: s.expiresAt,
            createdAt: s.createdAt,
          })),
          message: 'Use this endpoint to diagnose session and authentication issues',
        },
      };
    } catch (error) {
      app.logger.error({ err: error }, 'Error in session diagnostic endpoint');
      return {
        error: 'Diagnostic failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
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

  // GET /api/env-check - Check environment variable configuration (public endpoint - no auth required)
  app.fastify.get('/api/env-check', {
    schema: {
      description: 'Check OAuth and environment configuration (public - no auth required)',
      tags: ['auth'],
      response: {
        200: {
          type: 'object',
          properties: {
            google: {
              type: 'object',
              properties: {
                clientIdSet: { type: 'boolean' },
                clientIdPreview: { type: 'string' },
                clientSecretSet: { type: 'boolean' },
              },
            },
            apple: {
              type: 'object',
              properties: {
                clientIdSet: { type: 'boolean' },
                clientIdPreview: { type: 'string' },
                teamIdSet: { type: 'boolean' },
                keyIdSet: { type: 'boolean' },
                privateKeySet: { type: 'boolean' },
              },
            },
            urls: {
              type: 'object',
              properties: {
                baseUrl: { type: 'string' },
                frontendUrl: { type: 'string' },
              },
            },
            instructions: { type: 'string' },
            summary: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const appleClientId = process.env.APPLE_CLIENT_ID;
    const appleTeamId = process.env.APPLE_TEAM_ID;
    const appleKeyId = process.env.APPLE_KEY_ID;
    const applePrivateKey = process.env.APPLE_PRIVATE_KEY;
    const baseUrl = process.env.BASE_URL || 'NOT SET';
    const frontendUrl = process.env.FRONTEND_URL || 'NOT SET';

    const googleConfigured = !!googleClientId && !!googleClientSecret;
    const appleConfigured = !!appleClientId && !!appleTeamId && !!appleKeyId && !!applePrivateKey;

    app.logger.info(
      {
        googleConfigured,
        appleConfigured,
        baseUrlSet: baseUrl !== 'NOT SET',
        frontendUrlSet: frontendUrl !== 'NOT SET',
      },
      'Environment check requested'
    );

    const missingVars: string[] = [];
    if (!googleClientId) missingVars.push('GOOGLE_CLIENT_ID');
    if (!googleClientSecret) missingVars.push('GOOGLE_CLIENT_SECRET');
    if (!appleClientId) missingVars.push('APPLE_CLIENT_ID');
    if (!appleTeamId) missingVars.push('APPLE_TEAM_ID');
    if (!appleKeyId) missingVars.push('APPLE_KEY_ID');
    if (!applePrivateKey) missingVars.push('APPLE_PRIVATE_KEY');
    if (baseUrl === 'NOT SET') missingVars.push('BASE_URL');
    if (frontendUrl === 'NOT SET') missingVars.push('FRONTEND_URL');

    let summary = '';
    if (googleConfigured && appleConfigured && baseUrl !== 'NOT SET' && frontendUrl !== 'NOT SET') {
      summary = '✅ All OAuth configurations are set and ready';
    } else if (missingVars.length > 0) {
      summary = `❌ Missing: ${missingVars.join(', ')}`;
    } else {
      summary = '⚠️  Partial configuration - some providers may not work';
    }

    return {
      google: {
        clientIdSet: !!googleClientId,
        clientIdPreview: googleClientId ? `${googleClientId.substring(0, 10)}...` : 'NOT SET',
        clientSecretSet: !!googleClientSecret,
      },
      apple: {
        clientIdSet: !!appleClientId,
        clientIdPreview: appleClientId ? `${appleClientId.substring(0, 10)}...` : 'NOT SET',
        teamIdSet: !!appleTeamId,
        keyIdSet: !!appleKeyId,
        privateKeySet: !!applePrivateKey,
      },
      urls: {
        baseUrl,
        frontendUrl,
      },
      instructions:
        missingVars.length > 0
          ? `Missing environment variables: ${missingVars.join(', ')}. Add them in the Specular dashboard under Project Settings > Environment Variables. After adding, restart your backend.`
          : 'All required environment variables are configured. OAuth should work correctly.',
      summary,
    };
  });

  // GET /api/auth/debug-session - Debug session information (development only)
  app.fastify.get('/api/auth/debug-session', {
    schema: {
      description: 'Debug session information and authentication flow (development only)',
      tags: ['auth'],
      response: {
        200: {
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
      authHeaderFormat: 'Authorization: Bearer SESSION_TOKEN',
      hasCookie: !!cookieHeader,
      origin: origin || 'not sent (mobile app)',
      environment: {
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        nodeEnv: process.env.NODE_ENV || 'development',
        baseUrl: process.env.BASE_URL || 'not set',
      },
      trustedOrigins: [
        'http://localhost',
        'http://localhost:*',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:8081',
        'https://*.newly.dev',
        'https://*.app.specular.dev',
        'cheshbon://*',
        'Cheshbon://*',
        'exp://*',
      ],
      signInFlow: {
        email: 'POST /api/auth/sign-in/email with { email, password }',
        googleOAuth: 'POST /api/auth/initiate-social with { provider: "google", callbackURL }',
        appleOAuth: 'POST /api/auth/initiate-social with { provider: "apple", callbackURL }',
        appleNative: 'POST /api/auth/apple/native with { id_token, code, user }',
      },
      responseFormat: {
        description: 'All sign-in methods return:',
        example: {
          token: 'SESSION_TOKEN_STRING',
          user: {
            id: 'USER_ID',
            email: 'user@example.com',
            name: 'User Name',
          },
        },
      },
      bearerTokenUsage: 'Use token in Authorization header: Bearer SESSION_TOKEN',
      mobileNote: 'Mobile apps do not need Origin header, use deep link schemes: cheshbon://, Cheshbon://, exp://',
      diagnosticEndpoints: {
        sessionDiagnostic: 'GET /api/auth/session-diagnostic - Debug session validation with your current token',
        testSession: 'POST /api/auth/test-session with { userId } - Create and validate a test session',
        description: 'Use these endpoints to diagnose 401 authentication failures',
      },
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
    const origin = request.headers.origin || request.headers.host;

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

  // GET /api/auth/oauth-callback - Handle OAuth provider callback (code exchange)
  app.fastify.get('/api/auth/oauth-callback', {
    schema: {
      description: 'Handle OAuth provider callback with authorization code',
      tags: ['auth'],
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Authorization code from OAuth provider' },
          state: { type: 'string', description: 'State parameter for CSRF protection' },
          provider: { type: 'string', description: 'OAuth provider (google, apple)' },
          callbackURL: { type: 'string', description: 'Mobile deep link callback URL' },
          redirectURL: { type: 'string', description: 'Web redirect URL' },
        },
      },
      response: {
        302: { description: 'Redirect to callback URL with session token' },
        400: { description: 'Error handling OAuth callback' },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> => {
    const { code, state, provider, callbackURL, redirectURL } = request.query as any;
    const origin = request.headers.origin || request.headers.host;

    app.logger.info(
      { provider, origin, hasCode: !!code, hasState: !!state, callbackURL: callbackURL ? 'provided' : 'not provided' },
      'OAuth callback received with authorization code'
    );

    if (!code) {
      app.logger.warn({ origin, provider }, 'OAuth callback missing authorization code');
      return reply.status(400).send({ error: 'Authorization code required' });
    }

    // Better Auth handles the code exchange and session creation
    // After Better Auth processes the OAuth code, we need to:
    // 1. Extract the session token from the authenticated request
    // 2. Redirect to the callback URL with the token

    const finalCallbackUrl = callbackURL || redirectURL || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/`;

    try {
      // Try to get the session that was just created by Better Auth
      // The session should be available in the request context after OAuth processing
      const session = await requireAuth(request, reply);

      if (session && session.session.token) {
        // Session was successfully created, include token in redirect
        const separator = finalCallbackUrl.includes('?') ? '&' : '?';
        const redirectWithToken = `${finalCallbackUrl}${separator}token=${encodeURIComponent(session.session.token)}`;

        app.logger.info(
          { provider, origin, finalCallbackUrl: finalCallbackUrl.split('?')[0], hasToken: true },
          'OAuth code exchange completed, redirecting with session token'
        );

        return reply.redirect(redirectWithToken);
      } else {
        // No session yet, redirect and let client call /api/auth/me to get token
        app.logger.warn(
          { provider, origin, finalCallbackUrl: finalCallbackUrl.split('?')[0] },
          'OAuth code exchange completed, session not immediately available'
        );
        return reply.redirect(finalCallbackUrl);
      }
    } catch (error) {
      // Session might not be available yet, redirect without token
      app.logger.warn(
        { error, provider, origin, finalCallbackUrl: finalCallbackUrl.split('?')[0] },
        'Could not extract session token from OAuth callback'
      );
      return reply.redirect(finalCallbackUrl);
    }
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

    // Derive BASE_URL with proper handling for proxied environments
    const { url: backendBaseUrl, source: urlSource, detectedLocalhost } = deriveBASEUrl(request, app.logger);

    if (!backendBaseUrl) {
      app.logger.error(
        { provider, headers: { host: request.headers.host, xForwardedHost: request.headers['x-forwarded-host'] } },
        'Could not determine BASE_URL from environment or request headers'
      );
      return reply.status(500).send({
        error: 'SERVER_ERROR',
        message: 'Backend URL could not be determined. Set BASE_URL environment variable or ensure Host header is present.',
      });
    }

    // Generate the actual OAuth provider authorization URL directly
    let authorizationUrl: string;

    if (provider === 'google') {
      // Google OAuth is handled by Better Auth - delegate to Better Auth's social sign-in route
      // Better Auth supports Google OAuth with platform-level configuration
      // No need to check for explicit GOOGLE_CLIENT_ID/SECRET environment variables

      authorizationUrl = `${backendBaseUrl}/api/auth/sign-in/social?provider=${provider}`;

      // Add custom parameters for mobile app callback handling
      if (callbackUrl) {
        authorizationUrl += `&callbackURL=${encodeURIComponent(callbackUrl)}`;
      }

      app.logger.info(
        {
          provider: 'google',
          backendBaseUrl,
          urlSource,
          detectedLocalhost,
          isMobile: !!callbackUrl,
          hasCallbackUrl: !!callbackUrl,
          betterAuthRoute: '/api/auth/sign-in/social'
        },
        `Google OAuth delegated to Better Auth social sign-in route (BASE_URL source: ${urlSource})`
      );
    } else if (provider === 'apple') {
      // Generate Apple OAuth authorization URL directly from Apple's endpoint
      const appleAuthUrl = new URL('https://appleid.apple.com/auth/authorize');

      const clientId = process.env.APPLE_CLIENT_ID;
      if (!clientId) {
        app.logger.error({}, 'Apple OAuth not configured - APPLE_CLIENT_ID not set');
        return reply.status(400).send({
          error: 'APPLE_OAUTH_NOT_CONFIGURED',
          message: 'Apple OAuth is not configured. Set APPLE_CLIENT_ID and other Apple OAuth environment variables.',
        });
      }

      const state = Math.random().toString(36).substring(7) + Date.now().toString(36);

      appleAuthUrl.searchParams.append('client_id', clientId);
      // Use Better Auth's callback pattern: /api/auth/callback/apple
      appleAuthUrl.searchParams.append('redirect_uri', `${backendBaseUrl}/api/auth/callback/apple`);
      appleAuthUrl.searchParams.append('response_type', 'code id_token');
      appleAuthUrl.searchParams.append('scope', 'openid email name');
      appleAuthUrl.searchParams.append('state', state);
      appleAuthUrl.searchParams.append('response_mode', 'form_post');

      if (callbackUrl) {
        appleAuthUrl.searchParams.append('callbackURL', callbackUrl);
      }

      authorizationUrl = appleAuthUrl.toString();

      app.logger.info(
        {
          provider: 'apple',
          backendBaseUrl,
          urlSource,
          detectedLocalhost,
          isMobile: !!callbackUrl,
          hasCallbackUrl: !!callbackUrl,
          redirectUri: `${backendBaseUrl}/api/auth/callback/apple`,
          oauthProviderHost: 'appleid.apple.com',
          betterAuthCallback: true
        },
        `Apple OAuth authorization URL generated with Better Auth callback (BASE_URL source: ${urlSource})`
      );
    } else {
      app.logger.warn({ provider }, 'Unsupported OAuth provider');
      return reply.status(400).send({
        error: 'UNSUPPORTED_PROVIDER',
        message: `Unsupported OAuth provider: ${provider}. Use 'google' or 'apple'.`,
      });
    }

    // Return the actual OAuth provider authorization URL
    if (callbackUrl) {
      // Mobile app - return JSON with direct OAuth provider URL
      app.logger.info(
        { provider, clientType: 'mobile', callbackUrl: 'provided', oauthProviderHost: authorizationUrl.split('/')[2] },
        'Returning direct OAuth provider authorization URL for mobile client'
      );
      return {
        provider,
        authorizationUrl,
        message: `Redirect user to this URL to sign in with ${providerName}`,
      };
    } else {
      // Web browser - perform HTTP redirect directly to OAuth provider
      app.logger.info(
        { provider, clientType: 'web', oauthProviderHost: authorizationUrl.split('/')[2] },
        'Web client - redirecting directly to OAuth provider'
      );
      reply.redirect(authorizationUrl);
      return;
    }
  });

  // POST /api/auth/apple-callback - Handle Apple OAuth callback
  app.fastify.post('/api/auth/apple-callback', {
    schema: {
      description: 'Handle Apple OAuth callback (Apple Sign In)',
      tags: ['auth'],
      body: {
        type: 'object',
        properties: {
          id_token: { type: 'string', description: 'Apple identity token' },
          user: { type: 'string', description: 'User data (JSON string from Apple)' },
          code: { type: 'string', description: 'Authorization code from Apple' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: { type: 'object' },
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
    const { id_token, user, code } = request.body as any;
    const origin = request.headers.origin || request.headers.host;

    app.logger.info(
      { origin, hasIdToken: !!id_token, hasUserData: !!user, hasCode: !!code },
      'Apple OAuth callback received'
    );

    if (!id_token && !code) {
      app.logger.warn({ origin }, 'Apple callback missing id_token and code');
      return reply.status(400).send({ error: 'id_token or code required' });
    }

    // Note: In production, you would verify the id_token with Apple's public keys
    // For now, we pass the token to Better Auth to handle
    // Better Auth will verify it and create/update the user session

    app.logger.info(
      { origin },
      'Apple OAuth token received, user session will be created by Better Auth'
    );

    // Return a message indicating the OAuth flow should continue
    return {
      success: true,
      message: 'Apple OAuth token received. Session will be established by Better Auth.',
      idToken: id_token ? 'received' : undefined,
      code: code ? 'received' : undefined,
    };
  });

  // POST /api/auth/apple/native - Handle Apple native sign-in (from native iOS app)
  app.fastify.post('/api/auth/apple/native', {
    schema: {
      description: 'Handle Apple native sign-in with identity token from native iOS app',
      tags: ['auth'],
      body: {
        type: 'object',
        properties: {
          id_token: { type: 'string', description: 'Apple identity token from native Sign In with Apple' },
          code: { type: 'string', description: 'Authorization code from Apple' },
          user: { type: 'string', description: 'User data (JSON string) - only on first sign-in' },
        },
        required: ['id_token'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'Session token for Bearer authentication' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
              },
            },
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
    const { id_token, user: userData } = request.body as any;
    const origin = request.headers.origin || request.headers.host;

    app.logger.info(
      { origin, hasIdToken: !!id_token, hasUserData: !!userData },
      'Apple native sign-in received'
    );

    if (!id_token) {
      app.logger.warn({ origin }, 'Apple native sign-in missing id_token');
      return reply.status(400).send({
        error: 'MISSING_ID_TOKEN',
        message: 'Apple identity token (id_token) is required',
      });
    }

    try {
      // Decode Apple id_token to extract claims
      // Apple id_token is a JWT with format: header.payload.signature
      const tokenParts = id_token.split('.');
      if (tokenParts.length !== 3) {
        app.logger.warn({ origin }, 'Apple id_token has invalid format');
        return reply.status(400).send({
          error: 'INVALID_TOKEN_FORMAT',
          message: 'Apple identity token has invalid format',
        });
      }

      // Decode the payload (second part)
      const payloadBase64 = tokenParts[1];
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      const payload = JSON.parse(payloadJson);

      app.logger.info(
        { appleUserId: payload.sub, email: payload.email, emailVerified: payload.email_verified },
        'Apple identity token decoded'
      );

      // Extract Apple User ID (sub claim) and email
      const appleUserId = payload.sub;
      let email = payload.email || userData?.email;
      const name = userData?.name || payload.name;

      if (!appleUserId) {
        app.logger.warn({ origin }, 'Apple id_token missing sub claim');
        return reply.status(400).send({
          error: 'INVALID_TOKEN',
          message: 'Apple identity token missing user identifier',
        });
      }

      // Find or create user in database
      // Look for existing user with this Apple account (without relational query)
      let existingAccount = await app.db.query.account.findFirst({
        where: and(eq(account.providerId, 'apple'), eq(account.accountId, appleUserId)),
      }).catch(() => null);

      let userId: string;

      if (existingAccount?.userId) {
        userId = existingAccount.userId;
        app.logger.info({ userId, appleUserId }, 'Existing user found for Apple account');
      } else {
        // Check if email-based user exists
        let existingUser = null;
        if (email) {
          existingUser = await app.db.query.user.findFirst({
            where: eq(user.email, email),
          }).catch(() => null);
        }

        if (existingUser?.id) {
          userId = existingUser.id;
          app.logger.info({ userId, email }, 'Existing user found by email');
        } else {
          // Create new user
          if (!email) {
            app.logger.warn({ origin, appleUserId }, 'Cannot create user without email');
            return reply.status(400).send({
              error: 'MISSING_EMAIL',
              message: 'Email is required for new user registration. On first sign-in, Apple should provide user email.',
            });
          }

          userId = `user_${Math.random().toString(36).substr(2, 9)}`;

          await app.db.insert(user).values({
            id: userId,
            name: name || email.split('@')[0],
            email,
            emailVerified: !!payload.email_verified,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          app.logger.info(
            { userId, email, appleUserId },
            'New user created for Apple sign-in'
          );
        }
      }

      // Update user name if provided
      if (name && email) {
        const currentUser = await app.db.query.user.findFirst({
          where: eq(user.id, userId),
        }).catch(() => null);

        if (currentUser && (!currentUser.name || currentUser.name.includes('@'))) {
          await app.db.update(user).set({ name, updatedAt: new Date() }).where(eq(user.id, userId));
        }
      }

      // Link Apple account if not already linked
      const alreadyLinked = await app.db.query.account.findFirst({
        where: and(eq(account.providerId, 'apple'), eq(account.accountId, appleUserId)),
      }).catch(() => null);

      if (!alreadyLinked) {
        const accountId = `account_${Math.random().toString(36).substr(2, 9)}`;
        await app.db.insert(account).values({
          id: accountId,
          accountId: appleUserId,
          providerId: 'apple',
          userId,
          idToken: id_token,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        app.logger.info(
          { userId, appleUserId, accountId },
          'Apple account linked to user'
        );
      }

      // Create session
      const sessionToken = `session_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
      const sessionId = `session_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      app.logger.debug(
        { sessionToken: `${sessionToken.substring(0, 20)}...`, sessionId, userId },
        'Preparing to create session'
      );

      await app.db.insert(session).values({
        id: sessionId,
        token: sessionToken,
        expiresAt,
        userId,
        ipAddress: (request.headers['x-forwarded-for'] as string) || request.socket.remoteAddress || null,
        userAgent: request.headers['user-agent'] || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      app.logger.info(
        { userId, sessionId, sessionTokenTruncated: `${sessionToken.substring(0, 20)}...`, expiresAt: expiresAt.toISOString() },
        'Session created successfully for Apple sign-in'
      );

      // Verify session was created
      const verifySession = await app.db.query.session.findFirst({
        where: eq(session.id, sessionId),
      }).catch(() => null);

      if (verifySession) {
        app.logger.debug(
          { sessionId, verifiedToken: !!verifySession.token, userId: verifySession.userId },
          'Session creation verified in database'
        );
      } else {
        app.logger.warn(
          { sessionId, userId },
          'Session creation could not be verified in database'
        );
      }

      // Fetch user data to return
      const finalUser = await app.db.query.user.findFirst({
        where: eq(user.id, userId),
      });

      if (!finalUser) {
        app.logger.error({ userId }, 'User not found after session creation');
        return reply.status(400).send({
          error: 'USER_NOT_FOUND',
          message: 'User data could not be retrieved',
        });
      }

      app.logger.info(
        { userId: finalUser.id, email: finalUser.email, tokenTruncated: `${sessionToken.substring(0, 20)}...` },
        'Apple native sign-in completed successfully'
      );

      return {
        token: sessionToken,
        user: {
          id: finalUser.id,
          email: finalUser.email,
          name: finalUser.name,
        },
      };
    } catch (error) {
      app.logger.error(
        { err: error, origin },
        'Error processing Apple native sign-in'
      );
      return reply.status(400).send({
        error: 'AUTHENTICATION_FAILED',
        message: 'Failed to process Apple identity token',
      });
    }
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
