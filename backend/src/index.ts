import { createApplication, resend } from "@specific-dev/framework";
import * as appSchema from './db/schema.js';
import * as authSchema from './db/auth-schema.js';
import { registerJournalRoutes } from './routes/journal.js';
import { registerJournalsRoutes } from './routes/journals.js';
import { registerGoalRoutes } from './routes/goals.js';
import { registerGoalsTrackingRoutes } from './routes/goals-tracking.js';
import { registerLifeAreasRoutes } from './routes/life-areas.js';
import { registerStrategiesRoutes } from './routes/strategies.js';
import { registerCurrenciesRoutes } from './routes/currencies.js';
import { registerCurrenciesTransactionsRoutes } from './routes/currencies-transactions.js';
import { registerPreferencesRoutes } from './routes/preferences.js';
import { registerReportsRoutes } from './routes/reports.js';
import { registerReflectionsRoutes } from './routes/reflections.js';
import { registerGainsLossesRoutes } from './routes/gains-losses.js';
import { registerAlarmsRoutes } from './routes/alarms.js';
import { registerReflectionChatRoutes } from './routes/reflection-chat.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerMitzvotRoutes } from './routes/mitzvot.js';
import { registerMitzvotCategoryRoutes } from './routes/mitzvot-categories.js';
import { registerAuthRoutes } from './routes/auth.js';

// Combine both schemas
const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Enable authentication with Better Auth
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

// Detect BASE_URL - critical for OAuth redirects
// Priority: env var > log warning if missing
let baseUrl = process.env.BASE_URL;

if (!baseUrl) {
  // BASE_URL not set in environment
  // In production, Better Auth will fail to generate correct OAuth redirect URLs
  // The custom endpoints (/api/auth/initiate-social, /api/auth/oauth-start) can derive from request headers
  // But Better Auth's built-in /api/auth/sign-in/social endpoint needs this to be set
  app.logger.warn(
    {
      missingVariable: 'BASE_URL',
      currentDefault: 'http://localhost:3000',
      deployment: 'Production requests may fail if this is not the actual backend URL',
    },
    'CRITICAL: BASE_URL environment variable is NOT set. OAuth redirects may fail. Set BASE_URL to your backend public URL (e.g., https://api.example.com)'
  );
  baseUrl = 'http://localhost:3000'; // Fallback for development
} else {
  app.logger.info(
    { baseUrl, isProduction: process.env.NODE_ENV === 'production' },
    'BASE_URL environment variable is set and will be used for OAuth redirects'
  );
}

// Validate OAuth credentials and log configuration status
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const hasGoogleOAuth = !!googleClientId && !!googleClientSecret;

const appleClientId = process.env.APPLE_CLIENT_ID;
const appleTeamId = process.env.APPLE_TEAM_ID;
const appleKeyId = process.env.APPLE_KEY_ID;
const applePrivateKey = process.env.APPLE_PRIVATE_KEY;
const hasAppleOAuth = !!appleClientId && !!appleTeamId && !!appleKeyId && !!applePrivateKey;

// Log OAuth configuration status at startup
if (hasGoogleOAuth) {
  app.logger.info(
    { clientIdLength: googleClientId!.length },
    'Google OAuth credentials configured - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set'
  );
} else {
  const missing: string[] = [];
  if (!googleClientId) missing.push('GOOGLE_CLIENT_ID');
  if (!googleClientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  app.logger.warn(
    { missingVariables: missing },
    'Google OAuth credentials NOT configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables to enable Google sign-in.'
  );
}

if (hasAppleOAuth) {
  app.logger.info(
    { clientIdLength: appleClientId!.length, teamIdLength: appleTeamId!.length },
    'Apple OAuth credentials configured - all Apple OAuth environment variables are set'
  );
} else {
  const missing: string[] = [];
  if (!appleClientId) missing.push('APPLE_CLIENT_ID');
  if (!appleTeamId) missing.push('APPLE_TEAM_ID');
  if (!appleKeyId) missing.push('APPLE_KEY_ID');
  if (!applePrivateKey) missing.push('APPLE_PRIVATE_KEY');
  app.logger.warn(
    { missingVariables: missing },
    'Apple OAuth credentials NOT configured. Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY environment variables to enable Apple sign-in.'
  );
}

// Build social providers object only with configured providers
const socialProviders: any = {};
if (hasGoogleOAuth) {
  socialProviders.google = {
    clientId: googleClientId!,
    clientSecret: googleClientSecret!,
  };
}
if (hasAppleOAuth) {
  socialProviders.apple = {
    clientId: appleClientId!,
    teamId: appleTeamId!,
    keyId: appleKeyId!,
    privateKey: applePrivateKey!,
  };
}

// Build trusted origins including mobile app schemes
const trustedOrigins = [
  // Allow localhost for development (including dynamic ports)
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://localhost",
  // Allow production origin from env
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  // Allow wildcard domains for deployments
  "https://*.newly.dev",
  "https://*.app.specular.dev",
  // Allow mobile app deep link schemes (native iOS/Android apps)
  "cheshbon://",        // lowercase for native app
  "Cheshbon://",        // uppercase for native app variant
  "exp://",             // Expo Go app
  "exp://520cd74e-164f-40c1-aec1-273dae601c20.newly.dev",  // Specific Expo development environment
];

// Log the OAuth configuration at startup
if (Object.keys(socialProviders).length > 0) {
  app.logger.info(
    {
      providers: Object.keys(socialProviders),
      trustedOriginCount: trustedOrigins.length,
      baseUrlConfigured: !!process.env.BASE_URL,
    },
    'OAuth configuration initialized with configured providers'
  );
  app.logger.info(
    {
      providers: Object.keys(socialProviders),
      recommendedEndpoints: [
        'POST /api/auth/initiate-social (recommended - derives BASE_URL from request headers)',
        'POST /api/auth/oauth-start (recommended - derives BASE_URL from request headers)',
        'POST /api/auth/sign-in/social (Better Auth built-in - uses BASE_URL environment variable)',
      ],
    },
    'OAuth endpoints available'
  );
} else {
  app.logger.warn({
    missingVariables: {
      google: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
      apple: ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'],
    },
  }, 'No OAuth providers configured - set environment variables to enable social sign-in');
}

// Log environment setup at startup with detailed BASE_URL information
app.logger.info(
  {
    baseUrl,
    baseUrlSource: process.env.BASE_URL ? 'environment variable (BASE_URL)' : 'fallback to localhost:3000 - DEVELOPMENT ONLY',
    baseUrlIsLocalhost: baseUrl?.includes('localhost') || false,
    frontendUrl,
    nodeEnv: process.env.NODE_ENV || 'development',
    googleOAuthConfigured: hasGoogleOAuth,
    appleOAuthConfigured: hasAppleOAuth,
    oauthProvidersCount: Object.keys(socialProviders).length,
  },
  'Backend configuration - BASE_URL will be used for OAuth redirects'
);

app.withAuth({
  emailAndPassword: {
    sendResetPassword: async ({ user, url, token }) => {
      // Create reset link pointing to frontend with the token from Better Auth
      const resetLink = `${frontendUrl}/reset-password?token=${token}`;

      app.logger.info({ userEmail: user.email, resetLink }, 'Sending password reset email');

      // Don't await to prevent timing attacks - let the email send in background
      resend.emails.send({
        from: 'Specular <noreply@specular.app>',
        to: user.email,
        subject: 'Reset your password',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
            <p style="color: #666;">We received a request to reset the password for your account.</p>
            <p style="margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
            </p>
            <p style="color: #666; font-size: 14px;">Or copy and paste this link in your browser:</p>
            <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px;">
              ${resetLink}
            </p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px;">
              This password reset link will expire in 24 hours.<br>
              If you didn't request this, you can safely ignore this email.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">The Specular Team</p>
          </div>
        `,
      }).then(() => {
        app.logger.info({ userEmail: user.email }, 'Password reset email sent successfully');
      }).catch((error) => {
        app.logger.error({ err: error, userEmail: user.email }, 'Failed to send password reset email');
      });
    },
  },
  socialProviders,
  trustedOrigins: [
    // Localhost for development (all ports)
    "http://localhost",
    "http://localhost:*",
    // Specific localhost ports
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://localhost:8081",
    // Specific origins
    "https://520cd74e-164f-40c1-aec1-273dae601c20.newly.dev",
    // Environment-configured origin
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    // Wildcard subdomains with protocol
    "https://*.newly.dev",
    "https://*.app.specular.dev",
    // Mobile app deep link schemes (with wildcard for path)
    "cheshbon://*",
    "Cheshbon://*",
    "exp://*",
  ],
});

// Enable storage for file uploads and management
app.withStorage();

// Add hook BEFORE route registration to handle missing Origin header for mobile clients
// This must run before Better Auth validates the origin
app.fastify.addHook('onRequest', async (request, reply) => {
  // For mobile clients that don't send Origin header, set a default
  // This allows native iOS/Android apps to make OAuth requests
  if (!request.headers.origin && request.url.includes('/api/auth/')) {
    // Set origin to the request host for mobile apps that don't send Origin header
    request.headers.origin = request.headers.host || 'http://localhost';
    app.logger.debug({ url: request.url, host: request.headers.host }, 'Mobile OAuth request - origin header set');
  }
});

// Register routes - add your route modules here
// IMPORTANT: Always use registration functions to avoid circular dependency issues
registerJournalRoutes(app);
registerJournalsRoutes(app);
registerGoalRoutes(app);
registerGoalsTrackingRoutes(app);
registerLifeAreasRoutes(app);
registerStrategiesRoutes(app);
registerCurrenciesRoutes(app);
registerCurrenciesTransactionsRoutes(app);
registerPreferencesRoutes(app);
registerReportsRoutes(app);
registerReflectionsRoutes(app);
registerGainsLossesRoutes(app);
registerAlarmsRoutes(app);
registerReflectionChatRoutes(app);
registerHealthRoutes(app);
registerMitzvotCategoryRoutes(app);
registerMitzvotRoutes(app);
registerAuthRoutes(app);

// Log registered auth endpoints with BASE_URL configuration details
app.logger.info(
  {
    baseUrlConfiguration: {
      configured: !!process.env.BASE_URL,
      value: baseUrl,
      critical: 'BASE_URL is essential for OAuth redirects - if not set, redirects will fail',
      detectionPriority: [
        '1. process.env.BASE_URL (if set)',
        '2. x-forwarded-host header (custom endpoints only)',
        '3. host header (fallback)',
      ],
      note: 'Custom endpoints (/api/auth/initiate-social, /api/auth/oauth-start) detect BASE_URL from request headers. Better Auth built-in uses environment BASE_URL.',
    },
    oauthEndpoints: {
      recommended: [
        'POST /api/auth/initiate-social (detects BASE_URL from request headers)',
        'POST /api/auth/oauth-start (detects BASE_URL from request headers)',
      ],
      builtin: [
        'POST /api/auth/sign-in/social (Better Auth - uses environment BASE_URL)',
      ],
    },
    oauthProviders: Object.keys(socialProviders).length > 0 ? Object.keys(socialProviders) : ['NONE - check environment variables'],
    trustedOrigins: {
      patterns: trustedOrigins,
      count: trustedOrigins.length,
    },
    mobileSupport: {
      deepLinkSchemes: ['cheshbon://*', 'Cheshbon://*', 'exp://*'],
      bearerTokenSupport: 'Session tokens can be used as Bearer tokens in Authorization header',
    },
  },
  'Authentication system ready - BASE_URL is critical for OAuth redirects'
);

await app.run();
app.logger.info('Application running');
