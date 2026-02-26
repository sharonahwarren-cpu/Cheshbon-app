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
const appUrl = process.env.APP_URL || 'http://localhost:3000';
const resetPasswordUrl = `${appUrl}/reset-password`;

app.withAuth({
  emailAndPassword: {
    sendResetPassword: async ({ user, url }) => {
      // Extract token from URL and create reset link with custom format
      const token = url.split('token=')[1];
      const resetLink = `${resetPasswordUrl}?token=${token}`;

      try {
        await resend.emails.send({
          from: 'Specular <noreply@specular.app>',
          to: user.email,
          subject: 'Reset your password',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Password Reset Request</h2>
              <p>We received a request to reset the password for your account.</p>
              <p><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
              <p>Or copy and paste this link in your browser:</p>
              <p><code>${resetLink}</code></p>
              <p>This link will expire in 24 hours.</p>
              <p>If you didn't request this, you can safely ignore this email.</p>
              <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
              <p style="color: #666; font-size: 12px;">Specular Team</p>
            </div>
          `,
        });
      } catch (error) {
        app.logger.error({ err: error, userEmail: user.email }, 'Failed to send password reset email');
      }
    },
  },
  trustedOrigins: [
    // Allow localhost for development
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    // Allow production origin from env
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ],
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

await app.run();
app.logger.info('Application running');
