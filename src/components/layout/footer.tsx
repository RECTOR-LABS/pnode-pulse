// Force this component to be dynamically rendered to read runtime env vars
export const dynamic = 'force-dynamic';

export function Footer() {
  const commitSha = process.env.NEXT_PUBLIC_COMMIT_SHA || 'unknown';
  const branchName = process.env.NEXT_PUBLIC_BRANCH_NAME || 'unknown';
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown';

  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex flex-col gap-1">
            <div>pNode Pulse - Xandeum Network Explorer</div>
            <div className="text-xs opacity-70">
              {branchName}@{commitSha.slice(0, 7)} • Built {buildTime}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://www.xandeum.network"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Xandeum
            </a>
            <a
              href="https://discord.com/invite/mGAxAuwnR9"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Discord
            </a>
            <a
              href="https://github.com/Xandeum"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
