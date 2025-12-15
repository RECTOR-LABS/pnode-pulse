import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Content Security Policy configuration
// Note: Next.js requires 'unsafe-inline' and 'unsafe-eval' for certain features
const ContentSecurityPolicy = [
  "default-src 'self'",
  // Scripts: self + inline/eval for Next.js hydration and dev tools
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Styles: self + inline for Tailwind and component styles
  "style-src 'self' 'unsafe-inline'",
  // Images: self + data URIs + HTTPS sources (for external images)
  "img-src 'self' data: https: blob:",
  // Fonts: self only (add CDN if using external fonts)
  "font-src 'self'",
  // Connections: self + WebSocket for HMR + external APIs
  "connect-src 'self' wss: https://api.sentry.io https://*.ingest.sentry.io",
  // Frames: only allow embedding from same origin (main app)
  "frame-ancestors 'self'",
  // Frame sources: self for any iframes we use
  "frame-src 'self'",
  // Object/embed: none (no Flash/plugins)
  "object-src 'none'",
  // Base URI: self only
  "base-uri 'self'",
  // Form actions: self only
  "form-action 'self'",
  // Upgrade insecure requests in production
  process.env.NODE_ENV === "production" ? "upgrade-insecure-requests" : "",
].filter(Boolean).join("; ");

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",

  // Redirects for non-locale paths to default locale
  async redirects() {
    return [
      {
        source: "/leaderboard",
        destination: "/en/leaderboard",
        permanent: false,
      },
      {
        source: "/analytics",
        destination: "/en/analytics",
        permanent: false,
      },
      {
        source: "/graveyard",
        destination: "/en/graveyard",
        permanent: false,
      },
      {
        source: "/portfolio",
        destination: "/en/portfolio",
        permanent: false,
      },
      {
        source: "/map",
        destination: "/en/map",
        permanent: false,
      },
      {
        source: "/alerts",
        destination: "/en/alerts",
        permanent: false,
      },
      {
        source: "/reports",
        destination: "/en/reports",
        permanent: false,
      },
      {
        source: "/nodes",
        destination: "/en/nodes",
        permanent: false,
      },
      {
        source: "/nodes/:path*",
        destination: "/en/nodes/:path*",
        permanent: false,
      },
      {
        source: "/settings/:path*",
        destination: "/en/settings/:path*",
        permanent: false,
      },
      {
        source: "/privacy",
        destination: "/en/privacy",
        permanent: false,
      },
      {
        source: "/terms",
        destination: "/en/terms",
        permanent: false,
      },
    ];
  },

  // Optimize images
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: [
      "@tanstack/react-query",
      "date-fns",
      "zod",
    ],
  },

  // HTTP headers for caching, CORS, and security
  async headers() {
    return [
      // Security headers for all routes
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: ContentSecurityPolicy },
        ],
      },
      // Static assets - aggressive caching (1 year, immutable)
      {
        source: "/:path*.(ico|png|jpg|jpeg|gif|svg|woff|woff2|webp|avif)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "CDN-Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Next.js static chunks - immutable (hashed filenames)
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "CDN-Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // PWA manifest and service worker
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      // Public API v1 - CORS enabled for external consumers & embeds
      {
        source: "/api/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "Cache-Control", value: "public, s-maxage=30, stale-while-revalidate=60" },
          { key: "CDN-Cache-Control", value: "public, max-age=30, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/api/v1/leaderboard",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
          { key: "CDN-Cache-Control", value: "public, max-age=60, stale-while-revalidate=300" },
        ],
      },
      // Badges - CORS enabled, longer cache (less frequent updates)
      {
        source: "/api/badge/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" },
          { key: "CDN-Cache-Control", value: "public, max-age=300, stale-while-revalidate=600" },
        ],
      },
      // Embed routes - allow iframe embedding from any origin
      // Overrides the default CSP to allow embedding anywhere
      {
        source: "/embed/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
          { key: "Content-Security-Policy", value: ContentSecurityPolicy.replace("frame-ancestors 'self'", "frame-ancestors *") },
        ],
      },
      // Real-time API - no cache
      {
        source: "/api/realtime",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
      // tRPC - short cache for GET requests
      {
        source: "/api/trpc/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=10, stale-while-revalidate=30" },
        ],
      },
    ];
  },

  // Compress responses
  compress: true,

  // Enable strict mode for better performance
  reactStrictMode: true,

  // Minimize bundle size
  poweredByHeader: false,
};

export default withNextIntl(withBundleAnalyzer(nextConfig));
