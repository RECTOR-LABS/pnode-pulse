import { NextResponse } from 'next/server';

// This API route serves build metadata
// Values are set as ENV vars during Docker build
export async function GET() {
  return NextResponse.json({
    commit: process.env.NEXT_PUBLIC_COMMIT_SHA || 'unknown',
    branch: process.env.NEXT_PUBLIC_BRANCH_NAME || 'unknown',
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
  });
}

// Mark as edge runtime to avoid standalone build issues
export const runtime = 'nodejs';
