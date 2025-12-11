'use client';

import { useEffect, useState } from 'react';

interface BuildInfo {
  commit: string;
  branch: string;
  timestamp: string;
}

export function CommitInfo() {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);

  useEffect(() => {
    fetch('/api/build-info')
      .then((res) => res.json())
      .then((data) => setBuildInfo(data))
      .catch(() => {
        setBuildInfo({
          commit: 'unknown',
          branch: 'unknown',
          timestamp: new Date().toISOString(),
        });
      });
  }, []);

  if (!buildInfo) {
    return (
      <div className="text-xs opacity-70">
        loading...
      </div>
    );
  }

  return (
    <div className="text-xs opacity-70">
      {buildInfo.branch}@{buildInfo.commit.slice(0, 7)} • Built {buildInfo.timestamp}
    </div>
  );
}
