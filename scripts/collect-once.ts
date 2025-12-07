/**
 * Run a single collection cycle for testing
 *
 * Run with: npx tsx scripts/collect-once.ts
 */

import { runCollection } from "../src/server/workers/collector";

async function main() {
  console.log("Running single collection cycle...\n");

  try {
    const result = await runCollection();

    console.log("\n=== Results ===");
    console.log(`Total nodes polled: ${result.total}`);
    console.log(`Successful: ${result.success}`);
    console.log(`Failed: ${result.failed}`);
    console.log(`New nodes discovered: ${result.discovered}`);

    process.exit(0);
  } catch (error) {
    console.error("Collection failed:", error);
    process.exit(1);
  }
}

main();
