/**
 * Replace console.log/error/warn with structured logger
 *
 * Usage: npx tsx scripts/replace-console-with-logger.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const filesToFix = [
  'src/app/api/v1/nodes/route.ts',
  'src/app/api/v1/nodes/[id]/metrics/route.ts',
  'src/app/api/v1/nodes/[id]/route.ts',
  'src/app/api/v1/network/route.ts',
  'src/app/api/v1/network/stats/route.ts',
  'src/app/api/v1/leaderboard/route.ts',
  'src/app/api/metrics/route.ts',
  'src/app/api/realtime/route.ts',
  'src/app/api/badge/[type]/route.ts',
  'src/server/api/trpc.ts',
  'src/server/workers/report-processor.ts',
  'src/server/workers/alert-processor.ts',
  'src/components/export/export-dialog.tsx',
  'src/lib/redis/pubsub.ts',
  'src/lib/redis/index.ts',
  'src/lib/auth/auth-context.tsx',
  'src/lib/prpc/client.ts',
  'src/lib/hooks/use-bookmarks.ts',
  'src/lib/hooks/use-realtime.ts',
  'src/lib/api/rate-limiter.ts',
  'src/lib/notifications/service.ts',
];

const LOGGER_IMPORT = `import { logger } from "@/lib/logger";`;

function processFile(filePath: string): void {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${filePath} (not found)`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  const original = content;

  // Add logger import if not present
  if (!content.includes('from "@/lib/logger"') && !content.includes("from '@/lib/logger'")) {
    // Find the last import statement
    const lines = content.split('\n');
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex >= 0) {
      // Add after last import
      lines.splice(lastImportIndex + 1, 0, LOGGER_IMPORT);
      content = lines.join('\n');
    } else {
      // No imports found, add at the beginning after comments
      const firstNonComment = lines.findIndex(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
      });

      if (firstNonComment >= 0) {
        lines.splice(firstNonComment, 0, LOGGER_IMPORT, '');
        content = lines.join('\n');
      }
    }
  }

  // Replace console statements
  content = content.replace(/console\.log\(/g, 'logger.info(');
  content = content.replace(/console\.error\(/g, 'logger.error(');
  content = content.replace(/console\.warn\(/g, 'logger.warn(');

  // Only write if changed
  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ Fixed ${filePath}`);
  } else {
    console.log(`⏭️  No changes needed for ${filePath}`);
  }
}

function main() {
  console.log('Starting console.log replacement...\n');

  let fixedCount = 0;
  for (const file of filesToFix) {
    try {
      processFile(file);
      fixedCount++;
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error);
    }
  }

  console.log(`\n✅ Processed ${fixedCount} files`);
}

main();
