/**
 * Next.js Middleware
 *
 * Handles:
 * - CORS (Cross-Origin Resource Sharing) configuration
 * - Security headers
 * - Request validation
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Allowed origins for CORS
 * In production, restrict to specific domains
 */
const getAllowedOrigins = (): string[] => {
  const nodeEnv = process.env.NODE_ENV;
  const customOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];

  // Development: Allow localhost on common ports
  if (nodeEnv === "development") {
    return [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      ...customOrigins,
    ];
  }

  // Production: Strict whitelist
  return [
    "https://pulse.rectorspace.com",
    "https://staging.pulse.rectorspace.com",
    ...customOrigins,
  ].filter(Boolean);
};

/**
 * Handle CORS preflight requests (OPTIONS)
 */
function handlePreflight(request: NextRequest): NextResponse {
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = getAllowedOrigins();

  const response = new NextResponse(null, { status: 204 });

  // Check if origin is allowed
  if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  response.headers.set("Access-Control-Max-Age", "86400"); // 24 hours

  return response;
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(request: NextRequest, response: NextResponse): void {
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = getAllowedOrigins();

  // Check if origin is allowed
  if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  // Add security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );
}

export function middleware(request: NextRequest) {
  // Handle preflight requests
  if (request.method === "OPTIONS") {
    return handlePreflight(request);
  }

  // Continue with request and add CORS headers to response
  const response = NextResponse.next();
  addCorsHeaders(request, response);

  return response;
}

/**
 * Configure which paths this middleware runs on
 */
export const config = {
  matcher: [
    // Match API routes
    "/api/:path*",
    // Match tRPC routes
    "/api/trpc/:path*",
  ],
};
