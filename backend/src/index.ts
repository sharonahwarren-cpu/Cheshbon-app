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

// Validate OAuth credentials
const hasGoogleOAuth = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
const hasAppleOAuth = process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY;

if (!hasGoogleOAuth) {
  app.logger.warn('Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
}
if (!hasAppleOAuth) {
  app.logger.warn('Apple OAuth credentials not configured. Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY environment variables.');
}

// Build social providers object only with configured providers
const socialProviders: any = {};
if (hasGoogleOAuth) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  };
  app.logger.info('Google OAuth provider enabled');
}
if (hasAppleOAuth) {
  socialProviders.apple = {
    clientId: process.env.APPLE_CLIENT_ID!,
    teamId: process.env.APPLE_TEAM_ID!,
    keyId: process.env.APPLE_KEY_ID!,
    privateKey: process.env.APPLE_PRIVATE_KEY!,
  };
  app.logger.info('Apple OAuth provider enabled');
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
    { providers: Object.keys(socialProviders), trustedOriginCount: trustedOrigins.length },
    'OAuth configuration initialized'
  );
  app.logger.info(
    { providers: Object.keys(socialProviders) },
    'OAuth endpoints available: /api/auth/sign-in/social, /api/auth/sign-in/social-v1'
  );
} else {
  app.logger.warn('No OAuth providers configured. Set GOOGLE_CLIENT_ID/SECRET and/or APPLE_CLIENT_ID/SECRET to enable social sign-in.');
  app.logger.warn('OAuth endpoints available but will return configuration errors: /api/auth/sign-in/social, /api/auth/sign-in/social-v1');
}

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
  trustedOrigins,
});

// Enable storage for file uploads and management
app.withStorage();

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

// Log registered auth endpoints
app.logger.info(
  {
    authEndpoints: [
      'POST /api/auth/sign-in/social (Better Auth - automatic)',
      'POST /api/auth/sign-in/social-v1 (custom wrapper)',
      'POST /api/auth/sign-in/email',
      'POST /api/auth/sign-up/email',
      'POST /api/auth/callback',
      'POST /api/auth/oauth-start',
      'POST /api/auth/oauth-redirect',
      'GET /api/auth/me',
      'GET /api/auth/health',
      'GET /api/auth/oauth-test',
      'GET /api/auth/debug-session',
    ],
  },
  'Authentication endpoints registered'
);

await app.run();
app.logger.info('Application running');
