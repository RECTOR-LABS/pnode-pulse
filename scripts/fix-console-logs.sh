#!/bin/bash
set -euo pipefail

# Script to replace console.log/error/warn with structured logger
# Usage: bash scripts/fix-console-logs.sh

LOG_FILE="console-log-replacement.log"
echo "Starting console.log replacement..." | tee "$LOG_FILE"

# Files to process
FILES=$(grep -rl "console\.\(log\|error\|warn\)" src --include="*.ts" --include="*.tsx" | grep -v "src/lib/logger.ts")

COUNT=0
for file in $FILES; do
  echo "Processing: $file" | tee -a "$LOG_FILE"

  # Add logger import if not present
  if ! grep -q "import.*logger.*from.*@/lib/logger" "$file"; then
    # Check if file has imports
    if grep -q "^import" "$file"; then
      # Add after last import
      sed -i '' '/^import/,/^[^import]/{ /^[^import]/i\
import { logger } from "@/lib/logger";\

      }' "$file" 2>/dev/null || {
        # If sed fails, try simpler approach
        # Add at top after first import
        awk '/^import/{if(!found){print;print "import { logger } from \"@/lib/logger\";";found=1;next}}1' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
      }
    else
      # No imports, add at top
      echo 'import { logger } from "@/lib/logger";' | cat - "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    fi
  fi

  # Replace console.log with logger.info
  sed -i '' 's/console\.log(/logger.info(/g' "$file"

  # Replace console.error with logger.error
  sed -i '' 's/console\.error(/logger.error(/g' "$file"

  # Replace console.warn with logger.warn
  sed -i '' 's/console\.warn(/logger.warn(/g' "$file"

  COUNT=$((COUNT + 1))
done

echo "" | tee -a "$LOG_FILE"
echo "✅ Replaced console statements in $COUNT files" | tee -a "$LOG_FILE"
echo "Log file: $LOG_FILE"
