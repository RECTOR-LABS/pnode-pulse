/**
 * Quick test script for pRPC client
 * Run with: npx tsx scripts/test-prpc.ts
 */

// Using relative paths for tsx compatibility
import { createClient, PUBLIC_PNODES } from "../src/lib/prpc/client";
import { PRPCError } from "../src/types/prpc";

async function main() {
  console.log("Testing pRPC client...\n");

  const ip = PUBLIC_PNODES[3]; // 192.190.136.36
  const client = createClient(ip, { timeout: 10000 });

  console.log(`Connecting to ${ip}...\n`);

  try {
    // Test get-version
    console.log("1. Testing get-version...");
    const version = await client.getVersion();
    console.log(`   Version: ${version.version}\n`);

    // Test get-stats
    console.log("2. Testing get-stats...");
    const stats = await client.getStats();
    console.log(`   CPU: ${stats.cpu_percent}%`);
    console.log(`   RAM: ${(stats.ram_used / stats.ram_total * 100).toFixed(1)}%`);
    console.log(`   Uptime: ${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m`);
    console.log(`   Storage: ${(stats.file_size / 1e9).toFixed(2)} GB`);
    console.log(`   Active Streams: ${stats.active_streams}\n`);

    // Test get-pods
    console.log("3. Testing get-pods...");
    const pods = await client.getPods();
    console.log(`   Total Pods: ${pods.total_count}`);
    console.log(`   Sample Pod: ${pods.pods[0]?.address} (${pods.pods[0]?.version})\n`);

    console.log("All tests passed!");
  } catch (error) {
    if (error instanceof PRPCError) {
      console.error(`PRPCError [${error.code}]: ${error.message}`);
    } else {
      console.error("Error:", error);
    }
    process.exit(1);
  }
}

main();
