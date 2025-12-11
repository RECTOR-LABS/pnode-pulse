/**
 * i18n Configuration for pNode Pulse
 *
 * Defines supported locales and default locale for internationalization.
 */

export const locales = ["en", "es", "zh", "ru"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  zh: "中文",
  ru: "Русский",
};

export const localeFlags: Record<Locale, string> = {
  en: "🇺🇸",
  es: "🇪🇸",
  zh: "🇨🇳",
  ru: "🇷🇺",
};

// RTL languages (for future support)
export const rtlLocales: Locale[] = [];

export function isRtlLocale(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}
