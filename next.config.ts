import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

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
      {
        // Cache static assets aggressively
        source: "/:path*.(ico|png|jpg|jpeg|gif|svg|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache JS/CSS with revalidation
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // API routes - short cache with stale-while-revalidate
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=10, stale-while-revalidate=59",
          },
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

export default withBundleAnalyzer(nextConfig);
