/**
 * Vercel project configuration.
 *
 * The Vercel-hosted FE proxies every /api/* request to api.pulse.rectorspace.com,
 * which is the existing Next.js app running on the VPS. The Vercel deployment
 * therefore never touches the database — it serves pages only.
 *
 * Rewrites here run at the Vercel edge (not as serverless functions), so /api/*
 * requests do not trigger a Vercel Function invocation.
 *
 * IMPORTANT: This file is the source of truth. vercel.json is generated/kept in
 * sync as a fallback for tooling that doesn't yet support vercel.ts.
 *
 * Required Vercel env vars (set per environment in the Vercel dashboard):
 *   NEXT_PUBLIC_APP_URL=https://pulse.rectorspace.com
 *   DATABASE_URL=postgresql://stub:stub@localhost:5432/stub   # build-time only, never connected
 *   JWT_SECRET=<32+ chars; only needed for the build to type-check JWT helpers>
 *
 * Optional:
 *   NEXT_PUBLIC_SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
 *   NEXT_PUBLIC_GA_ID
 */

type Rewrite = { source: string; destination: string };

interface VercelConfig {
  buildCommand?: string;
  framework?: string;
  regions?: string[];
  rewrites?: Rewrite[];
  github?: { silent?: boolean };
}

const PULSE_API_URL =
  process.env.PULSE_API_URL ?? "https://api.pulse.rectorspace.com";

export const config: VercelConfig = {
  buildCommand: "npx prisma generate && next build",
  framework: "nextjs",
  regions: ["fra1"],
  rewrites: [
    {
      source: "/api/:path*",
      destination: `${PULSE_API_URL}/api/:path*`,
    },
  ],
  github: { silent: true },
};

export default config;
