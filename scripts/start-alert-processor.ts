/**
 * Start Alert Processor
 *
 * Convenience script to start the alert processing worker.
 * This worker evaluates alert rules and sends notifications.
 *
 * Usage:
 *   npm run alert-processor
 *   # or
 *   npx tsx scripts/start-alert-processor.ts
 */

import "../src/server/workers/alert-processor";
