/**
 * Standalone collector script
 *
 * Run with: npx tsx scripts/start-collector.ts
 *
 * This runs the data collection worker as a standalone process.
 * In production, this would be run as a separate service/container.
 */

import { startCollector } from "../src/server/workers/collector";

console.log("=================================");
console.log("  pNode Pulse Data Collector");
console.log("=================================");
console.log("");

// Handle graceful shutdown
const cleanup = startCollector();

async function shutdown(signal: string) {
  console.log(`\nReceived ${signal}, shutting down...`);
  await cleanup();
  console.log("Shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Keep process alive
console.log("Collector running. Press Ctrl+C to stop.");
