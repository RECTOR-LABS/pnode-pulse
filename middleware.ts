import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "@/i18n/config";

export default createMiddleware({
  // A list of all locales that are supported
  locales,

  // Used when no locale matches
  defaultLocale,

  // Don't prefix the default locale in the URL
  localePrefix: "as-needed",

  // Detect locale from browser preferences
  localeDetection: true,
});

export const config = {
  // Match all pathnames except for
  // - api routes
  // - static files
  // - internal Next.js paths
  matcher: [
    // Match all pathnames except for
    // - /api (API routes)
    // - /_next (Next.js internals)
    // - /icons, /images (static files)
    // - /sw.js, /manifest.json (PWA files)
    // - /embed (embed routes - no i18n)
    "/((?!api|_next|icons|images|sw\\.js|manifest\\.json|embed|robots\\.txt|sitemap\\.xml|favicon\\.ico).*)",
  ],
};
