/**
 * Quick test script for v0.7.0 get-pods-with-stats API
 * Run with: npx tsx test-v070-api.ts
 */

import { createClient } from "./src/lib/prpc";

async function testGetPodsWithStats() {
  console.log("Testing get-pods-with-stats API on public pNodes...\n");

  // Test against known public pNode
  const publicNodes = [
    "192.190.136.36",
    "192.190.136.37",
    "192.190.136.38",
    "192.190.136.28",
    "192.190.136.29",
  ];

  for (const ip of publicNodes) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Testing: ${ip}`);
    console.log("=".repeat(60));

    try {
      const client = createClient(ip, { timeout: 10000 });

      // Test new method
      console.log("\n[1/2] Testing get-pods-with-stats...");
      const result = await client.getPodsWithStats();

      console.log(`\n✅ Success! Received ${result.total_count} pods`);
      console.log(`\nFirst pod (sample data):`);
      const firstPod = result.pods[0];
      if (firstPod) {
        console.log(JSON.stringify(firstPod, null, 2));

        // Analyze the data
        const v070Pods = result.pods.filter((p) => p.version.startsWith("0.7"));
        const publicPods = result.pods.filter((p) => p.is_public === true);
        const privatePods = result.pods.filter((p) => p.is_public === null || p.is_public === false);

        console.log(`\n📊 Statistics:`);
        console.log(`  - Total pods: ${result.total_count}`);
        console.log(`  - v0.7.0+ pods: ${v070Pods.length}`);
        console.log(`  - Public RPC: ${publicPods.length}`);
        console.log(`  - Private RPC: ${privatePods.length}`);

        // Check if we have storage stats
        const withStorageStats = result.pods.filter((p) => p.storage_committed !== null);
        console.log(`  - With storage stats: ${withStorageStats.length}`);
      }

      // Compare with legacy method
      console.log("\n[2/2] Testing legacy get-pods (for comparison)...");
      const legacyResult = await client.getPods();
      console.log(`\n✅ Legacy method returned ${legacyResult.total_count} pods`);
      console.log(`\n💡 Improvement: +${result.total_count - legacyResult.total_count} more pods with new API!`);

      // Success, no need to test other nodes
      break;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`\n❌ Error: ${error.message}`);
      }
    }
  }
}

testGetPodsWithStats().catch(console.error);
