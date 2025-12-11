'use client';

import { useEffect, useState } from 'react';

interface BuildInfo {
  commit: string;
  branch: string;
  buildTime: string;
}

export function CommitInfo() {
  const [buildInfo, setBuildInfo] = useState<BuildInfo>({
    commit: 'unknown',
    branch: 'unknown',
    buildTime: new Date().toISOString(),
  });

  useEffect(() => {
    // Fetch build metadata from static JSON file (generated during Docker build)
    fetch('/build-info.json')
      .then((res) => res.json())
      .then((data: BuildInfo) => setBuildInfo(data))
      .catch(() => {
        // Keep default values on error
      });
  }, []);

  return (
    <div className="text-xs opacity-70">
      {buildInfo.branch}@{buildInfo.commit.slice(0, 7)} • Built {buildInfo.buildTime}
    </div>
  );
}
