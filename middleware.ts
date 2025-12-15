import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./src/i18n/config";

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  localeDetection: true,
});

export const config = {
  matcher: [
    // Match all paths except static files and API routes
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
