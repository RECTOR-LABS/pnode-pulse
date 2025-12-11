export function CommitInfo() {
  // Read build metadata from NEXT_PUBLIC_ env vars (embedded at build time)
  const commit = process.env.NEXT_PUBLIC_COMMIT_SHA || 'unknown';
  const branch = process.env.NEXT_PUBLIC_BRANCH_NAME || 'unknown';
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();

  return (
    <div className="text-xs opacity-70">
      {branch}@{commit.slice(0, 7)} • Built {buildTime}
    </div>
  );
}
