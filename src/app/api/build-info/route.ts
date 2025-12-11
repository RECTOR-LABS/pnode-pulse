import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    commit: process.env.GIT_COMMIT_HASH || 'unknown',
    branch: process.env.GIT_BRANCH || 'unknown',
    timestamp: process.env.BUILD_TIME || new Date().toISOString(),
  });
}
