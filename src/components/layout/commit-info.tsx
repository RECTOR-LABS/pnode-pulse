'use client';

import { BUILD_INFO } from '@/lib/build-info';

export function CommitInfo() {
  const commitSha = BUILD_INFO.commitSha || 'unknown';
  const branchName = BUILD_INFO.branchName || 'unknown';
  const buildTime = BUILD_INFO.buildTime || 'unknown';

  return (
    <div className="text-xs opacity-70">
      {branchName}@{commitSha.slice(0, 7)} • Built {buildTime}
    </div>
  );
}
