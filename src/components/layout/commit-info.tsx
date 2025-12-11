'use client';

export function CommitInfo() {
  // Read from window if available (client-side), otherwise from process.env (SSR)
  const commitSha = process.env.NEXT_PUBLIC_COMMIT_SHA || 'unknown';
  const branchName = process.env.NEXT_PUBLIC_BRANCH_NAME || 'unknown';
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown';

  return (
    <div className="text-xs opacity-70">
      {branchName}@{commitSha.slice(0, 7)} • Built {buildTime}
    </div>
  );
}
