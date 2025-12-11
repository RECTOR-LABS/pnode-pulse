'use client';

import buildInfo from '@/../public/build-info.json';

export function CommitInfo() {
  const commitSha = buildInfo.commitSha || 'unknown';
  const branchName = buildInfo.branchName || 'unknown';
  const buildTime = buildInfo.buildTime || 'unknown';

  return (
    <div className="text-xs opacity-70">
      {branchName}@{commitSha.slice(0, 7)} • Built {buildTime}
    </div>
  );
}
