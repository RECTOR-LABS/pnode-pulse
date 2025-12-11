'use client';

import { useEffect, useState } from 'react';

interface BuildInfo {
  commitSha: string;
  branchName: string;
  buildTime: string;
}

export function CommitInfo() {
  const [buildInfo, setBuildInfo] = useState<BuildInfo>({
    commitSha: 'loading',
    branchName: 'loading',
    buildTime: 'loading',
  });

  useEffect(() => {
    fetch('/api/build-info')
      .then((res) => res.json())
      .then((data) => setBuildInfo(data))
      .catch(() => {
        setBuildInfo({
          commitSha: 'error',
          branchName: 'error',
          buildTime: 'error',
        });
      });
  }, []);

  return (
    <div className="text-xs opacity-70">
      {buildInfo.branchName}@{buildInfo.commitSha.slice(0, 7)} • Built {buildInfo.buildTime}
    </div>
  );
}
