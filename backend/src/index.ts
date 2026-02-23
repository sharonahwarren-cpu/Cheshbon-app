import { createApplication } from "@specific-dev/framework";
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
import { registerMitzvotCategoryRoutes } from './routes/mitzvot-categories.js';
import { registerMitzvotRoutes } from './routes/mitzvot.js';
import { registerCheshbonRoutes } from './routes/cheshbon.js';

// Combine both schemas
const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Enable authentication with Better Auth
app.withAuth();

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
registerMitzvotCategoryRoutes(app);
registerMitzvotRoutes(app);
registerCheshbonRoutes(app);

await app.run();
app.logger.info('Application running');
