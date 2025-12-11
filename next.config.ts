import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",

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

  // HTTP headers for caching
  async headers() {
    return [
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
      // Public API v1 - edge cached with SWR
      {
        source: "/api/v1/network/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=30, stale-while-revalidate=60" },
          { key: "CDN-Cache-Control", value: "public, max-age=30, stale-while-revalidate=60" },
          { key: "Vercel-CDN-Cache-Control", value: "public, max-age=30, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/api/v1/nodes",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=30, stale-while-revalidate=60" },
          { key: "CDN-Cache-Control", value: "public, max-age=30, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/api/v1/leaderboard",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
          { key: "CDN-Cache-Control", value: "public, max-age=60, stale-while-revalidate=300" },
        ],
      },
      // Badges - longer cache (less frequent updates)
      {
        source: "/api/badge/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" },
          { key: "CDN-Cache-Control", value: "public, max-age=300, stale-while-revalidate=600" },
        ],
      },
      // Embed routes - moderate cache
      {
        source: "/embed/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
          { key: "X-Frame-Options", value: "ALLOWALL" },
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
