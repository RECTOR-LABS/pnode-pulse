import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    commitSha: process.env.NEXT_PUBLIC_COMMIT_SHA || 'unknown',
    branchName: process.env.NEXT_PUBLIC_BRANCH_NAME || 'unknown',
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown',
  });
}
